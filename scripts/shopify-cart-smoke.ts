import type { Product, ProductVariant } from '../src/commerce/domain/catalog.ts';
import { getSafeCheckoutUrl } from '../src/commerce/application/checkout-redirect.ts';
import { getVariantAvailability, isQuantityAllowed } from '../src/commerce/domain/inventory.ts';
import { createShopifyCatalogQueries } from '../src/commerce/infrastructure/shopify/catalog-runtime-query.ts';
import {
  getShopifyStorefrontConfig,
  ShopifyConfigurationError,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_STOREFRONT_API_VERSION,
} from '../src/commerce/infrastructure/shopify/config.ts';
import { createShopifyStorefrontGateway } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';
import {
  parseSmokeBaseUrl as parseValidatedSmokeBaseUrl,
  parseSmokeProductHandle as parseValidatedSmokeProductHandle,
  SMOKE_BASE_URL_ERROR,
} from './shopify-smoke-url.ts';

const CART_SMOKE_TIMEOUT_MS = 20_000;
export const SESSION_COOKIE_NAME = '__Host-kingbelt-session';
export { SMOKE_BASE_URL_ERROR };
export const CART_ID_LEAK_ERROR = 'Remote Shopify Cart ID leaked through the public BFF response.';
export const NO_PURCHASABLE_VARIANT_ERROR = 'Smoke product has no variant purchasable at quantity 1.';
export const DEMO_DEPLOYMENT_ERROR =
  'The target deployment does not expose the Shopify cart BFF. Check COMMERCE_SOURCE=shopify.';

const QUANTITY = 1;
const CART_GID = 'gid://shopify/Cart/';
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

export type ShopifyCartSmokeEnv = Record<string, string | undefined>;
export type ShopifyCartSmokeStage =
  | 'configuration'
  | 'storefront product'
  | 'initial empty cart'
  | 'cart create'
  | 'session cookie'
  | 'session persistence'
  | 'cart remove'
  | 'cart add existing'
  | 'cart update'
  | 'checkout'
  | 'cleanup';

export class ShopifyCartSmokeError extends Error {
  readonly name = 'ShopifyCartSmokeError';

  constructor(
    readonly stage: ShopifyCartSmokeStage,
    readonly reason: string,
    readonly httpStatus?: number,
    readonly cleanupFailed = false
  ) {
    super(reason);
  }
}

export interface ShopifyCartSmokeIO {
  fetch?: typeof fetch;
  resolveProduct?: (handle: string) => Promise<Product | undefined>;
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
}

type CartCommand =
  | { command: 'refresh' }
  | { command: 'add'; variantId: string; quantity: number }
  | { command: 'update'; lineId: string; quantity: number }
  | { command: 'remove'; lineId: string }
  | { command: 'checkout' };

interface SmokeLine {
  id: string;
  variantId: string;
  quantity: number;
  handle: string;
}

interface SmokeCart {
  lines: SmokeLine[];
  itemCount: number;
  canCheckout: boolean;
  checkoutUrl?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function fail(
  stage: ShopifyCartSmokeStage,
  reason: string,
  httpStatus?: number,
  cleanupFailed = false
): never {
  throw new ShopifyCartSmokeError(stage, reason, httpStatus, cleanupFailed);
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown Shopify cart smoke error.';

export const sanitizeSmokeText = (value: string, env: ShopifyCartSmokeEnv = {}): string => {
  const token = env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  return (token ? value.split(token).join('[redacted]') : value)
    .replace(/gid:\/\/shopify\/Cart\/[^\s"'\\]*/gi, '[redacted-cart-id]')
    .replace(/(__Host-kingbelt-session=)[^;\s]+/gi, '$1[redacted]')
    .replace(
      /https:\/\/[^\s"'\\]+\/(?:checkouts|cart\/c)\/[^\s"'\\]*|https:\/\/checkout\.shopify\.com\/[^\s"'\\]*/gi,
      '[redacted-checkout-url]'
    )
    .replace(/(?:authorization|shopify-storefront-private-token)\s*[:=]\s*\S+/gi, '[redacted-header]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 500);
};

export const parseSmokeBaseUrl = (raw: unknown): string => {
  try {
    return parseValidatedSmokeBaseUrl(raw);
  } catch (error) {
    fail('configuration', error instanceof Error ? error.message : SMOKE_BASE_URL_ERROR);
  }
};

export const parseSmokeProductHandle = (raw: unknown): string => {
  try {
    return parseValidatedSmokeProductHandle(raw);
  } catch (error) {
    fail(
      'configuration',
      error instanceof Error ? error.message : 'SHOPIFY_SMOKE_PRODUCT_HANDLE must be a catalog handle.'
    );
  }
};

export const extractSessionCookie = (setCookieHeaders: readonly string[]): string => {
  const matches = setCookieHeaders.filter((header) => header.split('=', 1)[0]?.trim() === SESSION_COOKIE_NAME);
  if (matches.length !== 1) fail('session cookie', 'Deployment did not emit the KingBelt session cookie.');

  const header = matches[0];
  if (header.includes(CART_GID)) fail('session cookie', CART_ID_LEAK_ERROR);

  const parts = header.split(';').map((part) => part.trim()).filter(Boolean);
  const pair = parts[0];
  if (!pair.startsWith(`${SESSION_COOKIE_NAME}=`) || pair.length <= SESSION_COOKIE_NAME.length + 1) {
    fail('session cookie', 'Deployment did not emit the KingBelt session cookie.');
  }

  const attr = (name: string): string | undefined => {
    const found = parts.slice(1).find((part) => part.split('=', 1)[0]?.trim().toLowerCase() === name);
    return found?.includes('=') ? found.slice(found.indexOf('=') + 1).trim() : found ? '' : undefined;
  };

  if (attr('secure') === undefined) fail('session cookie', 'Session cookie is missing Secure.');
  if (attr('httponly') === undefined) fail('session cookie', 'Session cookie is missing HttpOnly.');
  if (attr('samesite')?.toLowerCase() !== 'lax') fail('session cookie', 'Session cookie is missing SameSite=Lax.');
  if (attr('path') !== '/') fail('session cookie', 'Session cookie is missing Path=/.');
  if (attr('domain') !== undefined) fail('session cookie', 'Session cookie must not set Domain.');
  return pair;
};

export const assertPublicCartResponseSafe = (
  body: unknown,
  env: ShopifyCartSmokeEnv = {},
  stage: ShopifyCartSmokeStage = 'configuration'
): void => {
  const json = JSON.stringify(body);
  if (/"cartId"\s*:/.test(json) || json.includes(CART_GID)) fail(stage, CART_ID_LEAK_ERROR);
  const token = env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  if (token && json.includes(token)) {
    fail(stage, 'Storefront token leaked through the public BFF response.');
  }
};

export const selectPurchasableSmokeVariant = (product: Product): ProductVariant => {
  const variant = product.variants.find((candidate) => {
    const availability = getVariantAvailability(candidate);
    return availability.purchasable && isQuantityAllowed(QUANTITY, availability);
  });
  if (!variant) fail('storefront product', NO_PURCHASABLE_VARIANT_ERROR);
  return variant;
};

const publicError = (body: unknown): string | undefined => {
  if (!isRecord(body)) return undefined;
  if (typeof body.error === 'string') return body.error;
  return isRecord(body.error) && typeof body.error.code === 'string' ? body.error.code : undefined;
};

const requireCurrency = (value: unknown, stage: ShopifyCartSmokeStage): void => {
  if (!isRecord(value) || value.currency !== SHOPIFY_MARKET_CONTEXT.currency) {
    fail(stage, `Cart currency is not ${SHOPIFY_MARKET_CONTEXT.currency}.`);
  }
};

const parseLine = (value: unknown, stage: ShopifyCartSmokeStage): SmokeLine => {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) fail(stage, 'Cart line is missing.');
  if (typeof value.variantId !== 'string' || !value.variantId) {
    fail(stage, 'Smoke cart line does not match the pilot product.');
  }
  if (typeof value.quantity !== 'number' || !Number.isSafeInteger(value.quantity)) {
    fail(stage, 'Cart line quantity is invalid.');
  }
  if (!isRecord(value.availability) || value.availability.purchasable !== true) {
    fail(stage, 'Smoke cart line is not purchasable.');
  }
  if (!isRecord(value.product) || typeof value.product.handle !== 'string') {
    fail(stage, 'Smoke cart line does not match the pilot product.');
  }
  requireCurrency(value.product.unitPrice, stage);
  requireCurrency(value.lineTotal, stage);
  return { id: value.id, variantId: value.variantId, quantity: value.quantity, handle: value.product.handle };
};

const parseCart = (body: unknown, stage: ShopifyCartSmokeStage): SmokeCart => {
  if (!isRecord(body) || !isRecord(body.cart)) fail(stage, 'Cart BFF response is missing cart.');
  const cart = body.cart;
  if (!Array.isArray(cart.lines)) fail(stage, 'Cart BFF response is missing cart lines.');
  if (typeof cart.itemCount !== 'number' || !Number.isSafeInteger(cart.itemCount)) {
    fail(stage, 'Cart itemCount is invalid.');
  }
  if (typeof cart.canCheckout !== 'boolean') fail(stage, 'Cart canCheckout is invalid.');
  requireCurrency(cart.subtotal, stage);
  return {
    lines: cart.lines.map((line) => parseLine(line, stage)),
    itemCount: cart.itemCount,
    canCheckout: cart.canCheckout,
    checkoutUrl: cart.checkoutUrl,
  };
};

const assertEmpty = (cart: SmokeCart, body: unknown, stage: ShopifyCartSmokeStage): void => {
  if (cart.lines.length !== 0 || cart.itemCount !== 0 || cart.canCheckout) {
    fail(stage, 'Cart was not empty.');
  }
  if (cart.checkoutUrl || (isRecord(body) && typeof body.url === 'string')) {
    fail(stage, 'Empty cart must not include checkoutUrl.');
  }
};

const assertPilot = (
  cart: SmokeCart,
  stage: ShopifyCartSmokeStage,
  expected: { variantId: string; handle: string }
): SmokeLine => {
  const [line] = cart.lines;
  if (
    cart.lines.length !== 1
    || line.variantId !== expected.variantId
    || line.handle !== expected.handle
    || line.quantity !== QUANTITY
  ) {
    fail(stage, 'Smoke cart line does not match the pilot product.');
  }
  if (cart.itemCount !== QUANTITY || !cart.canCheckout) fail(stage, 'Cart cannot checkout.');
  return line;
};

export const assertSafeCheckoutUrl = (
  urlValue: unknown,
  allowedHosts: unknown,
  stage: ShopifyCartSmokeStage = 'checkout'
): string => {
  if (
    typeof urlValue !== 'string'
    || !urlValue
    || !Array.isArray(allowedHosts)
    || allowedHosts.length === 0
    || allowedHosts.some((host) => typeof host !== 'string' || !host)
  ) {
    fail(stage, 'checkout URL was not accepted');
  }
  const safe = getSafeCheckoutUrl({
    status: 'ready',
    url: urlValue,
    allowedHosts: allowedHosts as string[],
  });
  if (!safe) fail(stage, 'checkout URL was not accepted');
  return safe.hostname;
};

const readSetCookieHeaders = (headers: Headers): string[] => {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
};

const requestCart = async (input: {
  stage: ShopifyCartSmokeStage;
  baseUrl: string;
  command: CartCommand;
  cookie?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; body: unknown; setCookieHeaders: readonly string[] }> => {
  const origin = new URL(input.baseUrl).origin;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: origin,
  };
  if (input.cookie) headers.Cookie = input.cookie;

  let response: Response;
  try {
    response = await (input.fetchImpl ?? globalThis.fetch)(`${origin}/api/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input.command),
      redirect: 'manual',
      signal: AbortSignal.timeout(CART_SMOKE_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    fail(input.stage, timedOut ? 'request timed out' : errorMessage(error));
  }

  if (REDIRECT_STATUSES.has(response.status) || response.type === 'opaqueredirect') {
    fail(input.stage, 'Cart BFF returned a redirect instead of JSON.', response.status);
  }

  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    fail(input.stage, 'Cart BFF returned invalid JSON.', response.status);
  }

  return { status: response.status, body, setCookieHeaders: readSetCookieHeaders(response.headers) };
};

export interface ShopifyCartSmokeSummary {
  hostname: string;
  handle: string;
  checkoutHost: string;
}

export const formatCartSmokeSuccess = (summary: ShopifyCartSmokeSummary): string =>
  [
    'Shopify cart smoke passed',
    '',
    `Deployment: ${summary.hostname}`,
    `Product: ${summary.handle}`,
    'Storefront product: OK',
    'Initial empty cart: OK',
    'Cart create: OK',
    'Session cookie: OK',
    'Session persistence: OK',
    'Cart remove: OK',
    'Cart add existing: OK',
    'Cart update: OK',
    `Market: ${SHOPIFY_MARKET_CONTEXT.country}`,
    `Currency: ${SHOPIFY_MARKET_CONTEXT.currency}`,
    'Checkout URL: OK',
    `Checkout host: ${summary.checkoutHost}`,
    'Cleanup: OK',
    'Order created: NO',
    'Payment attempted: NO',
  ].join('\n');

export const formatCartSmokeFailure = (error: unknown, env: ShopifyCartSmokeEnv = {}): string => {
  const smokeError = error instanceof ShopifyCartSmokeError ? error : undefined;
  const lines = [
    'Shopify cart smoke failed',
    `stage: ${smokeError?.stage ?? 'configuration'}`,
  ];
  if (smokeError?.httpStatus !== undefined) lines.push(`HTTP: ${smokeError.httpStatus}`);
  lines.push(`reason: ${sanitizeSmokeText(errorMessage(error), env)}`);
  if (smokeError?.cleanupFailed) lines.push('cleanup also failed');
  return lines.join('\n');
};

export const runShopifyCartSmoke = async (
  env: ShopifyCartSmokeEnv,
  io: ShopifyCartSmokeIO = {}
): Promise<ShopifyCartSmokeSummary> => {
  if (env.COMMERCE_SOURCE !== 'shopify') {
    fail('configuration', 'Shopify cart smoke requires COMMERCE_SOURCE=shopify.');
  }
  if (env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN) {
    fail('configuration', 'PUBLIC_SHOPIFY_STOREFRONT_TOKEN is not used. Use SHOPIFY_STOREFRONT_PRIVATE_TOKEN only.');
  }

  const baseUrl = parseSmokeBaseUrl(env.SHOPIFY_SMOKE_BASE_URL);
  const handle = parseSmokeProductHandle(env.SHOPIFY_SMOKE_PRODUCT_HANDLE);
  const manifest = env.SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES;
  if (manifest !== undefined) {
    const expectedHandles = manifest.split(',').map((value) => value.trim()).filter(Boolean);
    if (!expectedHandles.length) {
      fail(
        'configuration',
        'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES must be a comma-separated list of handles.'
      );
    }
    if (!expectedHandles.includes(handle)) {
      fail(
        'configuration',
        'SHOPIFY_SMOKE_PRODUCT_HANDLE is not in SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES.'
      );
    }
  }

  const resolveProduct = io.resolveProduct ?? (async (productHandle: string) => {
    const gateway = createShopifyStorefrontGateway(getShopifyStorefrontConfig({
      storeDomain: env.SHOPIFY_STORE_DOMAIN,
      apiVersion: env.SHOPIFY_API_VERSION || SHOPIFY_STOREFRONT_API_VERSION,
      storefrontToken: env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    }));
    return createShopifyCatalogQueries(gateway).getProductByHandle(productHandle);
  });

  let product: Product | undefined;
  try {
    product = await resolveProduct(handle);
  } catch (error) {
    if (error instanceof ShopifyConfigurationError) fail('configuration', error.message);
    fail('storefront product', errorMessage(error));
  }
  if (!product) fail('storefront product', 'Smoke product was not found in Storefront.');

  const variant = selectPurchasableSmokeVariant(product);
  const expected = { variantId: variant.id, handle };
  const hostname = new URL(baseUrl).hostname;
  let cookie: string | undefined;
  let lineId: string | undefined;

  const read = async (stage: ShopifyCartSmokeStage, command: CartCommand) => {
    const response = await requestCart({
      stage,
      baseUrl,
      command,
      cookie,
      fetchImpl: io.fetch,
    });
    if (response.status === 404) fail(stage, DEMO_DEPLOYMENT_ERROR, response.status);
    if (response.status === 503) {
      fail(
        stage,
        publicError(response.body) ?? 'Cart BFF is unavailable. Check session / Upstash / Shopify runtime config.',
        response.status
      );
    }
    assertPublicCartResponseSafe(response.body, env, stage);
    if (response.status !== 200 || !isRecord(response.body) || response.body.success !== true) {
      fail(stage, publicError(response.body) ?? 'Cart BFF request failed.', response.status);
    }
    return { ...response, body: response.body, cart: parseCart(response.body, stage) };
  };

  const expectEmpty = async (stage: ShopifyCartSmokeStage, command: CartCommand) => {
    const result = await read(stage, command);
    assertEmpty(result.cart, result.body, stage);
    return result;
  };

  const expectPilot = async (stage: ShopifyCartSmokeStage, command: CartCommand) => {
    const result = await read(stage, command);
    lineId = assertPilot(result.cart, stage, expected).id;
    return result;
  };

  const cleanup = async () => {
    if (!cookie || !lineId) return;
    try {
      await read('cleanup', { command: 'remove', lineId });
    } catch (error) {
      if (error instanceof ShopifyCartSmokeError && error.reason === CART_ID_LEAK_ERROR) throw error;
    }
    const refreshed = await read('cleanup', { command: 'refresh' });
    if (refreshed.cart.lines.length !== 0 || refreshed.cart.itemCount !== 0) {
      fail('cleanup', 'Smoke cart line could not be removed.');
    }
  };

  try {
    await expectEmpty('initial empty cart', { command: 'refresh' });

    const created = await expectPilot('cart create', {
      command: 'add',
      variantId: variant.id,
      quantity: QUANTITY,
    });
    cookie = extractSessionCookie(created.setCookieHeaders);

    await expectPilot('session persistence', { command: 'refresh' });
    await expectEmpty('cart remove', { command: 'remove', lineId: lineId! });
    lineId = undefined;
    await expectEmpty('cart remove', { command: 'refresh' });

    await expectPilot('cart add existing', {
      command: 'add',
      variantId: variant.id,
      quantity: QUANTITY,
    });
    await expectPilot('cart update', { command: 'update', lineId: lineId!, quantity: QUANTITY });

    const checkout = await expectPilot('checkout', { command: 'checkout' });
    if (checkout.body.status !== 'ready') fail('checkout', 'Checkout is not ready.', checkout.status);
    const checkoutHost = assertSafeCheckoutUrl(checkout.body.url, checkout.body.allowedHosts);

    await expectEmpty('cleanup', { command: 'remove', lineId: lineId! });
    lineId = undefined;
    await expectEmpty('cleanup', { command: 'refresh' });
    return { hostname, handle, checkoutHost };
  } catch (error) {
    let cleanupFailed = false;
    try {
      await cleanup();
    } catch {
      cleanupFailed = true;
    }
    if (cleanupFailed && error instanceof ShopifyCartSmokeError) {
      fail(error.stage, error.reason, error.httpStatus, true);
    }
    throw error;
  }
};

export const runShopifyCartSmokeCli = async (
  env: ShopifyCartSmokeEnv = process.env,
  io: ShopifyCartSmokeIO = {}
): Promise<number> => {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    stdout.write(`${formatCartSmokeSuccess(await runShopifyCartSmoke(env, io))}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${formatCartSmokeFailure(error, env)}\n`);
    return 1;
  }
};
