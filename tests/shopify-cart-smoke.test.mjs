import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emptyCart } from '../src/commerce/application/cart-service.ts';
import { SESSION_COOKIE_NAME as RUNTIME_SESSION_COOKIE_NAME } from '../src/session-driver.ts';
import {
  assertPublicCartResponseSafe,
  assertSafeCheckoutUrl,
  CART_ID_LEAK_ERROR,
  DEMO_DEPLOYMENT_ERROR,
  extractSessionCookie,
  formatCartSmokeFailure,
  NO_PURCHASABLE_VARIANT_ERROR,
  parseSmokeBaseUrl,
  parseSmokeProductHandle,
  runShopifyCartSmoke,
  runShopifyCartSmokeCli,
  sanitizeSmokeText,
  selectPurchasableSmokeVariant,
  SESSION_COOKIE_NAME,
  SMOKE_BASE_URL_ERROR,
  ShopifyCartSmokeError,
} from '../scripts/shopify-cart-smoke.ts';

const root = resolve(import.meta.dir, '..');
const HANDLE = 'cinturon-atlas';
const VARIANT_ID = 'gid://shopify/ProductVariant/111';
const LINE_CREATE = 'gid://shopify/CartLine/create-1';
const LINE_EXISTING = 'gid://shopify/CartLine/existing-2';
const BASE_URL = 'https://preview.example.test';
const ORIGIN = 'https://preview.example.test';
const TOKEN = 'test-private-storefront-token';
const COOKIE_VALUE = 'opaque123';
const COOKIE_PAIR = `${SESSION_COOKIE_NAME}=${COOKIE_VALUE}`;
const SET_COOKIE = `${COOKIE_PAIR}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const CHECKOUT_HOST = 'kingbelt-test.myshopify.com';
const CHECKOUT_URL = `https://${CHECKOUT_HOST}/checkouts/cn/secret-session`;
const ALLOWED_HOSTS = [CHECKOUT_HOST, 'checkout.shopify.com'];

const validEnv = (overrides = {}) => ({
  COMMERCE_SOURCE: 'shopify',
  SHOPIFY_SMOKE_BASE_URL: BASE_URL,
  SHOPIFY_SMOKE_PRODUCT_HANDLE: HANDLE,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN,
  SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: HANDLE,
  ...overrides,
});

const captureIO = () => {
  const stdout = [];
  const stderr = [];
  return {
    stdout: { write(chunk) { stdout.push(String(chunk)); return true; } },
    stderr: { write(chunk) { stderr.push(String(chunk)); return true; } },
    success: () => stdout.join(''),
    failure: () => stderr.join(''),
  };
};

const variant = (overrides = {}) => ({
  id: VARIANT_ID,
  sku: 'ATL-001',
  optionValues: [],
  price: { amountMinor: 4900, currency: 'EUR' },
  salesStatus: 'active',
  inventory: { kind: 'unknown' },
  inventoryPolicy: 'deny',
  quantityRule: { minimum: 1, increment: 1 },
  ...overrides,
});

const smokeProduct = (variants = [variant()]) => ({
  handle: HANDLE,
  variants,
});

const cartLine = (id, overrides = {}) => ({
  id,
  variantId: VARIANT_ID,
  product: {
    id: 'gid://shopify/Product/1',
    handle: HANDLE,
    title: 'Atlas',
    collection: 'Sport',
    reference: 'ATL',
    unitPrice: { amountMinor: 4900, currency: 'EUR' },
    href: '/productos/cinturon-atlas',
  },
  selectedOptions: [],
  quantity: 1,
  availability: {
    purchasable: true,
    status: 'available',
    maxQuantity: 8,
    minimum: 1,
    increment: 1,
    limitReason: 'technical',
    quantityKnown: false,
    backorder: false,
    message: 'Disponible.',
  },
  lineTotal: { amountMinor: 4900, currency: 'EUR' },
  ...overrides,
});

const filledCart = (id, lineOverrides = {}) => ({
  lines: [cartLine(id, lineOverrides)],
  itemCount: 1,
  subtotal: { amountMinor: 4900, currency: 'EUR' },
  lineErrors: [],
  status: 'idle',
  canCheckout: true,
});

const jsonResponse = (body, { status = 200, setCookie } = {}) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
};

const headerMap = (headers) => {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
};

const recordFetch = (handler) => {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = String(input);
    const headers = headerMap(init.headers);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({
      url,
      method: init.method,
      headers,
      body,
      redirect: init.redirect,
      signal: init.signal,
    });
    return handler(requests.at(-1), requests.length);
  };
  return { requests, fetch };
};

const flowFetch = (options = {}) => {
  let adds = 0;
  let removes = 0;
  let updates = 0;
  let checkouts = 0;
  const responses = options.responses ?? {};

  return recordFetch(async (request) => {
    const command = request.body.command;
    if (command === 'add') adds += 1;
    if (command === 'remove') removes += 1;
    if (command === 'update') updates += 1;
    if (command === 'checkout') checkouts += 1;

    if (responses[command]) return responses[command](request, { adds, removes, updates, checkouts });

    if (command === 'refresh') {
      if (!request.headers.cookie) return jsonResponse({ success: true, cart: emptyCart() });
      if (adds === 1 && removes === 0) return jsonResponse({ success: true, cart: filledCart(LINE_CREATE) });
      if (adds >= 1 && removes >= 1 && adds === removes) {
        return jsonResponse({ success: true, cart: emptyCart() });
      }
      if (adds === 2 && removes === 1) return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
      return jsonResponse({ success: true, cart: emptyCart() });
    }

    if (command === 'add') {
      if (adds === 1) return jsonResponse({ success: true, cart: filledCart(LINE_CREATE) }, { setCookie: SET_COOKIE });
      return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
    }

    if (command === 'remove') {
      return jsonResponse({ success: true, cart: emptyCart() });
    }

    if (command === 'update') {
      return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
    }

    if (command === 'checkout') {
      if (options.checkoutBody) return jsonResponse(options.checkoutBody);
      return jsonResponse({
        success: true,
        status: 'ready',
        url: CHECKOUT_URL,
        allowedHosts: ALLOWED_HOSTS,
        cart: filledCart(LINE_EXISTING),
      });
    }

    return jsonResponse({ error: 'invalid_command' }, { status: 400 });
  });
};

const runSmoke = (env, io) => runShopifyCartSmoke(env, {
  resolveProduct: async () => smokeProduct(),
  ...io,
});

describe('parseSmokeBaseUrl', () => {
  test('acepta un origin HTTPS y normaliza la barra final', () => {
    expect(parseSmokeBaseUrl('https://example.com')).toBe('https://example.com');
    expect(parseSmokeBaseUrl('https://example.com/')).toBe('https://example.com');
  });

  test('rechaza HTTP, path, query, fragment, credenciales, relativo y whitespace', () => {
    const invalid = [
      'http://example.com',
      'javascript:alert(1)',
      'data:text/html,hi',
      'ftp://example.com',
      'https://user:pass@example.com',
      'https://example.com/foo',
      'https://example.com?x=1',
      'https://example.com#x',
      'https://example.com:8443',
      '/relative',
      'example.com',
      ' https://example.com',
      'https://example.com ',
      'https://example.com\n',
      '',
    ];
    for (const value of invalid) {
      expect(() => parseSmokeBaseUrl(value)).toThrow(SMOKE_BASE_URL_ERROR);
    }
  });
});

describe('parseSmokeProductHandle', () => {
  test('acepta un handle de catálogo', () => {
    expect(parseSmokeProductHandle('cinturon-atlas')).toBe('cinturon-atlas');
    expect(parseSmokeProductHandle('cinturon-caballero-al-corte-tintado-seta-5009-35'))
      .toBe('cinturon-caballero-al-corte-tintado-seta-5009-35');
    expect(parseSmokeProductHandle('cinturon-ensamblado-serraje-pintado-contorno-5365-35'))
      .toBe('cinturon-ensamblado-serraje-pintado-contorno-5365-35');
  });

  test('rechaza handles inválidos', () => {
    for (const value of ['Cinturon-Atlas', '/cinturon-atlas', 'cinturon atlas', 'https://example.com', 'foo/bar', '']) {
      expect(() => parseSmokeProductHandle(value)).toThrow(ShopifyCartSmokeError);
    }
  });
});

describe('extractSessionCookie', () => {
  test('extrae el par opaco y exige flags host-only', () => {
    expect(extractSessionCookie([SET_COOKIE])).toBe(COOKIE_PAIR);
    expect(SESSION_COOKIE_NAME).toBe(RUNTIME_SESSION_COOKIE_NAME);
  });

  test('falla si faltan Secure, HttpOnly, SameSite=Lax, Path=/ o aparece Domain', () => {
    const base = `${COOKIE_PAIR}; Path=/; HttpOnly; Secure; SameSite=Lax`;
    expect(() => extractSessionCookie([`${COOKIE_PAIR}; Path=/; HttpOnly; SameSite=Lax`])).toThrow('Secure');
    expect(() => extractSessionCookie([`${COOKIE_PAIR}; Path=/; Secure; SameSite=Lax`])).toThrow('HttpOnly');
    expect(() => extractSessionCookie([`${COOKIE_PAIR}; Path=/; HttpOnly; Secure`])).toThrow('SameSite=Lax');
    expect(() => extractSessionCookie([`${COOKIE_PAIR}; HttpOnly; Secure; SameSite=Lax`])).toThrow('Path=/');
    expect(() => extractSessionCookie([`${base}; Domain=example.test`])).toThrow('Domain');
    expect(extractSessionCookie([base])).toBe(COOKIE_PAIR);
  });

  test('falla si el valor contiene un Cart ID remoto', () => {
    expect(() => extractSessionCookie([
      `${SESSION_COOKIE_NAME}=gid://shopify/Cart/secret; Path=/; HttpOnly; Secure; SameSite=Lax`,
    ])).toThrow(CART_ID_LEAK_ERROR);
  });
});

describe('assertPublicCartResponseSafe', () => {
  test('falla si aparece cartId o un Cart GID anidado', () => {
    expect(() => assertPublicCartResponseSafe({ success: true, cartId: 'gid://shopify/Cart/secret' }))
      .toThrow(CART_ID_LEAK_ERROR);
    expect(() => assertPublicCartResponseSafe({
      success: true,
      cart: { note: 'gid://shopify/Cart/secret' },
    })).toThrow(CART_ID_LEAK_ERROR);
  });

  test('falla si el token Storefront aparece en la respuesta pública', () => {
    expect(() => assertPublicCartResponseSafe(
      { success: true, cart: emptyCart(), debug: TOKEN },
      { SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN }
    )).toThrow('Storefront token leaked through the public BFF response.');
  });
});

describe('selectPurchasableSmokeVariant', () => {
  test('elige la primera variante comprable a cantidad 1 y no la primera arbitraria', () => {
    const selected = selectPurchasableSmokeVariant(smokeProduct([
      variant({ id: 'gid://shopify/ProductVariant/unavailable', salesStatus: 'unavailable' }),
      variant({ id: VARIANT_ID }),
    ]));
    expect(selected.id).toBe(VARIANT_ID);
  });

  test('falla si ninguna variante admite cantidad 1', () => {
    expect(() => selectPurchasableSmokeVariant(smokeProduct([
      variant({ salesStatus: 'unavailable' }),
      variant({ quantityRule: { minimum: 2, increment: 1 } }),
    ]))).toThrow(NO_PURCHASABLE_VARIANT_ERROR);
  });
});

describe('assertSafeCheckoutUrl', () => {
  test('acepta HTTPS con host exacto permitido', () => {
    expect(assertSafeCheckoutUrl(CHECKOUT_URL, ALLOWED_HOSTS)).toBe(CHECKOUT_HOST);
  });

  test('rechaza HTTP, credenciales, host no permitido, puerto alternativo y URL inválida', () => {
    const cases = [
      [`http://${CHECKOUT_HOST}/checkouts/cn/x`, ALLOWED_HOSTS],
      [`https://user:pass@${CHECKOUT_HOST}/checkouts/cn/x`, ALLOWED_HOSTS],
      [`https://evil.example/checkouts/cn/x`, ALLOWED_HOSTS],
      [`https://${CHECKOUT_HOST}:8443/checkouts/cn/x`, ALLOWED_HOSTS],
      ['not-a-url', ALLOWED_HOSTS],
    ];
    for (const [url, hosts] of cases) {
      expect(() => assertSafeCheckoutUrl(url, hosts)).toThrow('checkout URL was not accepted');
    }
  });
});

describe('sanitizeSmokeText', () => {
  test('redacta token, Cart ID, cookie y checkout URL', () => {
    const sanitized = sanitizeSmokeText(
      `token=${TOKEN} cookie ${COOKIE_PAIR} cart gid://shopify/Cart/secret-id ${CHECKOUT_URL}`,
      { SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN }
    );
    expect(sanitized).toContain('[redacted]');
    expect(sanitized).toContain('[redacted-cart-id]');
    expect(sanitized).toContain(`${SESSION_COOKIE_NAME}=[redacted]`);
    expect(sanitized).toContain('[redacted-checkout-url]');
    expect(sanitized).not.toContain(TOKEN);
    expect(sanitized).not.toContain('secret-id');
    expect(sanitized).not.toContain(COOKIE_VALUE);
    expect(sanitized).not.toContain('/checkouts/cn/');
  });
});

describe('flujo Shopify cart smoke', () => {
  test('certifica el flujo BFF completo, Origin, cookie opaca y ausencia de token', async () => {
    const { requests, fetch } = flowFetch();
    const io = captureIO();
    const code = await runShopifyCartSmokeCli(validEnv(), {
      ...io,
      fetch,
      resolveProduct: async () => smokeProduct(),
    });

    expect(code).toBe(0);
    expect(io.success()).toBe([
      'Shopify cart smoke passed',
      '',
      'Deployment: preview.example.test',
      `Product: ${HANDLE}`,
      'Storefront product: OK',
      'Initial empty cart: OK',
      'Cart create: OK',
      'Session cookie: OK',
      'Session persistence: OK',
      'Cart remove: OK',
      'Cart add existing: OK',
      'Cart update: OK',
      'Market: ES',
      'Currency: EUR',
      'Checkout URL: OK',
      `Checkout host: ${CHECKOUT_HOST}`,
      'Cleanup: OK',
      'Order created: NO',
      'Payment attempted: NO',
      '',
    ].join('\n'));
    expect(io.failure()).toBe('');
    expect(io.success()).not.toContain(TOKEN);
    expect(io.success()).not.toContain(COOKIE_VALUE);
    expect(io.success()).not.toContain('gid://shopify/Cart/');
    expect(io.success()).not.toContain(VARIANT_ID);
    expect(io.success()).not.toContain('/checkouts/');

    expect(requests.map((request) => request.body.command)).toEqual([
      'refresh',
      'add',
      'refresh',
      'remove',
      'refresh',
      'add',
      'update',
      'checkout',
      'remove',
      'refresh',
    ]);
    expect(requests[3].body.lineId).toBe(LINE_CREATE);
    expect(requests[5].body.variantId).toBe(VARIANT_ID);
    expect(requests[6].body).toEqual({ command: 'update', lineId: LINE_EXISTING, quantity: 1 });

    requests.forEach((request) => {
      expect(request.url).toBe(`${ORIGIN}/api/cart`);
      expect(request.method).toBe('POST');
      expect(request.redirect).toBe('manual');
      expect(request.headers.origin).toBe(ORIGIN);
      expect(request.headers.accept).toBe('application/json');
      expect(request.headers['content-type']).toBe('application/json');
      expect(request.headers.authorization).toBeUndefined();
      expect(request.headers['shopify-storefront-private-token']).toBeUndefined();
      expect(request.headers['x-forwarded-for']).toBeUndefined();
      expect(request.headers['x-real-ip']).toBeUndefined();
      expect(request.headers['shopify-storefront-buyer-ip']).toBeUndefined();
      expect(request.signal).toBeDefined();
    });

    expect(requests[0].headers.cookie).toBeUndefined();
    expect(requests[1].headers.cookie).toBeUndefined();
    requests.slice(2).forEach((request) => {
      expect(request.headers.cookie).toBe(COOKIE_PAIR);
      expect(request.headers.cookie).not.toContain('Secure');
      expect(request.headers.cookie).not.toContain('HttpOnly');
    });
  });

  test('un 404 en refresh indica que el deployment no expone el BFF Shopify', async () => {
    const { fetch } = recordFetch(async () => jsonResponse({ error: 'not_found' }, { status: 404 }));
    const io = captureIO();
    const code = await runShopifyCartSmokeCli(validEnv(), {
      ...io,
      fetch,
      resolveProduct: async () => smokeProduct(),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('stage: initial empty cart');
    expect(io.failure()).toContain('HTTP: 404');
    expect(io.failure()).toContain(DEMO_DEPLOYMENT_ERROR);
  });

  test('un 503 commerce_unavailable no se reintenta', async () => {
    let calls = 0;
    const { fetch } = recordFetch(async () => {
      calls += 1;
      return jsonResponse({ error: 'commerce_unavailable' }, { status: 503 });
    });
    await expect(runSmoke(validEnv(), { fetch })).rejects.toMatchObject({
      stage: 'initial empty cart',
      reason: 'commerce_unavailable',
      httpStatus: 503,
    });
    expect(calls).toBe(1);
  });

  test('un add 422 hace fallar el smoke con el código público', async () => {
    const { fetch } = recordFetch(async (request) => {
      if (request.body.command === 'refresh') return jsonResponse({ success: true, cart: emptyCart() });
      return jsonResponse({
        success: false,
        cart: emptyCart(),
        error: { code: 'out_of_stock', message: 'Producto agotado.' },
      }, { status: 422 });
    });
    const io = captureIO();
    const code = await runShopifyCartSmokeCli(validEnv(), {
      ...io,
      fetch,
      resolveProduct: async () => smokeProduct(),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('stage: cart create');
    expect(io.failure()).toContain('HTTP: 422');
    expect(io.failure()).toContain('out_of_stock');
    expect(io.failure()).not.toContain(JSON.stringify({ code: 'out_of_stock' }));
  });

  test('falla si el handle del producto no coincide con el piloto', async () => {
    const { fetch } = flowFetch({
      responses: {
        add: async () => jsonResponse({
          success: true,
          cart: filledCart(LINE_CREATE, {
            product: { ...cartLine(LINE_CREATE).product, handle: 'otro-producto' },
          }),
        }, { setCookie: SET_COOKIE }),
      },
    });
    await expect(runSmoke(validEnv(), { fetch })).rejects.toMatchObject({
      stage: 'cart create',
      reason: 'Smoke cart line does not match the pilot product.',
    });
  });

  test('falla si aparece una moneda distinta de EUR', async () => {
    const usdCart = {
      ...filledCart(LINE_CREATE),
      subtotal: { amountMinor: 4900, currency: 'USD' },
    };
    const { fetch } = recordFetch(async (request) => {
      if (request.body.command === 'refresh') return jsonResponse({ success: true, cart: emptyCart() });
      return jsonResponse({ success: true, cart: usdCart }, { setCookie: SET_COOKIE });
    });
    await expect(runSmoke(validEnv(), { fetch })).rejects.toMatchObject({
      stage: 'cart create',
      reason: 'Cart currency is not EUR.',
    });
  });

  test('falla una checkout URL insegura y no navega a ella', async () => {
    const { requests, fetch } = flowFetch({
      checkoutBody: {
        success: true,
        status: 'ready',
        url: 'http://evil.example/checkouts/cn/x',
        allowedHosts: ALLOWED_HOSTS,
        cart: filledCart(LINE_EXISTING),
      },
    });
    await expect(runSmoke(validEnv(), { fetch })).rejects.toMatchObject({
      stage: 'checkout',
      reason: 'checkout URL was not accepted',
    });
    expect(requests.some((request) => String(request.url).includes('evil.example'))).toBe(false);
    expect(requests.every((request) => request.url === `${ORIGIN}/api/cart`)).toBe(true);
  });

  test('intenta cleanup en finally si falla después de checkout', async () => {
    const { requests, fetch } = flowFetch({
      checkoutBody: {
        success: true,
        status: 'ready',
        url: CHECKOUT_URL,
        allowedHosts: ALLOWED_HOSTS,
        cart: { ...filledCart(LINE_EXISTING), canCheckout: false },
      },
    });
    await expect(runSmoke(validEnv(), { fetch })).rejects.toMatchObject({
      stage: 'checkout',
    });
    expect(requests.map((request) => request.body.command)).toEqual([
      'refresh',
      'add',
      'refresh',
      'remove',
      'refresh',
      'add',
      'update',
      'checkout',
      'remove',
      'refresh',
    ]);
    expect(requests.at(-2).body).toEqual({ command: 'remove', lineId: LINE_EXISTING });
    expect(requests.at(-2).headers.cookie).toBe(COOKIE_PAIR);
    expect(requests.at(-1).body).toEqual({ command: 'refresh' });
    expect(requests.at(-1).headers.cookie).toBe(COOKIE_PAIR);
  });

  test('si el smoke falla y el cleanup también, conserva el error original', async () => {
    const { fetch } = flowFetch({
      checkoutBody: {
        success: true,
        status: 'ready',
        url: CHECKOUT_URL,
        allowedHosts: ALLOWED_HOSTS,
        cart: { ...filledCart(LINE_EXISTING), canCheckout: false },
      },
      responses: {
        remove: async (_request, state) => {
          if (state.checkouts >= 1) return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
          return jsonResponse({ success: true, cart: emptyCart() });
        },
        refresh: async (request, state) => {
          if (!request.headers.cookie) return jsonResponse({ success: true, cart: emptyCart() });
          if (state.checkouts >= 1) return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
          if (state.adds === 1 && state.removes === 0) {
            return jsonResponse({ success: true, cart: filledCart(LINE_CREATE) });
          }
          if (state.adds === 2 && state.removes === 1) {
            return jsonResponse({ success: true, cart: filledCart(LINE_EXISTING) });
          }
          return jsonResponse({ success: true, cart: emptyCart() });
        },
      },
    });
    const io = captureIO();
    const code = await runShopifyCartSmokeCli(validEnv(), {
      ...io,
      fetch,
      resolveProduct: async () => smokeProduct(),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('stage: checkout');
    expect(io.failure()).toContain('cleanup also failed');
    expect(io.failure()).not.toContain(COOKIE_VALUE);
    expect(io.failure()).not.toContain(CHECKOUT_URL);
  });

  test('exige COMMERCE_SOURCE=shopify y una base URL explícita', async () => {
    await expect(runSmoke(validEnv({ COMMERCE_SOURCE: 'demo' }))).rejects.toThrow(
      'Shopify cart smoke requires COMMERCE_SOURCE=shopify.'
    );
    await expect(runSmoke(validEnv({ SHOPIFY_SMOKE_BASE_URL: undefined }))).rejects.toThrow(SMOKE_BASE_URL_ERROR);
  });

  test('exige que el piloto pertenezca al manifiesto cuando está definido', async () => {
    await expect(runSmoke(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'otro-cinturon',
    }))).rejects.toThrow('SHOPIFY_SMOKE_PRODUCT_HANDLE is not in SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES.');
  });

  test('no llama Shopify Storefront cuando el resolver está inyectado', async () => {
    let storefrontCalls = 0;
    const { fetch } = flowFetch();
    const wrapped = async (input, init) => {
      storefrontCalls += String(input).includes('myshopify.com') ? 1 : 0;
      return fetch(input, init);
    };
    await runSmoke(validEnv(), { fetch: wrapped });
    expect(storefrontCalls).toBe(0);
  });
});

describe('contrato del comando shopify:cart-smoke', () => {
  test('el smoke de Storefront sigue siendo read-only y el de carrito no entra en CI público', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const workflow = readFileSync(join(root, '.github/workflows/quality.yml'), 'utf8');
    const storefrontSmoke = readFileSync(join(root, 'scripts/shopify-storefront-smoke.mjs'), 'utf8');
    const cartSmoke = readFileSync(join(root, 'scripts/shopify-cart-smoke.ts'), 'utf8');
    const example = readFileSync(join(root, '.env.example'), 'utf8');

    expect(pkg.scripts['shopify:smoke']).toBe('bun scripts/shopify-storefront-smoke.mjs');
    expect(pkg.scripts['shopify:cart-smoke']).toBe('bun scripts/shopify-cart-smoke.mjs');
    expect(pkg.scripts['shopify:release-gate']).toBe('bun scripts/shopify-release-gate.mjs');
    expect(pkg.scripts.validate).not.toContain('shopify:cart-smoke');
    expect(pkg.scripts.validate).not.toContain('shopify:release-gate');
    expect(pkg.scripts.validate).not.toContain('shopify:smoke');
    expect(pkg.scripts.build).not.toContain('shopify:cart-smoke');
    expect(pkg.scripts['shopify:preflight']).not.toContain('shopify:cart-smoke');
    expect(workflow).not.toContain('shopify:cart-smoke');
    expect(workflow).not.toContain('SHOPIFY_SMOKE_BASE_URL');

    expect(storefrontSmoke).toContain('query StorefrontConnection');
    expect(storefrontSmoke).toContain('shop {');
    expect(storefrontSmoke).not.toContain('cartCreate');
    expect(storefrontSmoke).not.toContain('/api/cart');

    expect(cartSmoke).toContain('createShopifyStorefrontGateway');
    expect(cartSmoke).toContain('createShopifyCatalogQueries');
    expect(cartSmoke).toContain('getProductByHandle');
    expect(cartSmoke).toContain('getVariantAvailability');
    expect(cartSmoke).toContain('isQuantityAllowed');
    expect(cartSmoke).toContain("command: 'checkout'");
    expect(cartSmoke).toContain('AbortSignal.timeout');
    expect(cartSmoke).toContain('CART_SMOKE_TIMEOUT_MS');
    expect(cartSmoke).toContain('20_000');
    expect(cartSmoke).toContain("redirect: 'manual'");
    expect(cartSmoke).not.toContain('createShopifyCartService');
    expect(cartSmoke).not.toContain('createConfiguredShopifyCartService');
    expect(cartSmoke).not.toContain('buyerIp');
    expect(cartSmoke).not.toContain('Shopify-Storefront-Buyer-IP');
    expect(cartSmoke).not.toContain('X-Forwarded-For');
    expect(cartSmoke).not.toContain('X-Smoke-Test');
    expect(cartSmoke).not.toContain('session.get');
    expect(cartSmoke).not.toContain('deliveryAddress');
    expect(cartSmoke).not.toContain('Playwright');
    expect(cartSmoke).not.toContain('Admin');
    expect(cartSmoke).not.toContain('cartDelete');
    expect(cartSmoke).toContain('Upstash');
    const walk = (directory) => readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
    const smokeEnvHits = [
      join(root, 'astro.config.mjs'),
      ...walk(join(root, 'src')),
    ].filter((path) => {
      const text = readFileSync(path, 'utf8');
      return text.includes('SHOPIFY_SMOKE_BASE_URL') || text.includes('SHOPIFY_SMOKE_PRODUCT_HANDLE');
    }).map((path) => path.slice(root.length + 1));
    expect(smokeEnvHits).toEqual([]);
    expect(example).toContain('SHOPIFY_SMOKE_BASE_URL=');
    expect(example).toContain('SHOPIFY_SMOKE_PRODUCT_HANDLE=');
    expect(example).toContain('CLI de smoke y release gate contra un deployment real');
    expect(example).not.toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN=shpat_');
  });

  test('formatCartSmokeFailure no imprime cuerpos ni secretos', () => {
    const formatted = formatCartSmokeFailure(
      new ShopifyCartSmokeError('checkout', `cookie ${COOKIE_PAIR} ${CHECKOUT_URL} ${TOKEN}`, 422, true),
      { SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN }
    );
    expect(formatted).toContain('Shopify cart smoke failed');
    expect(formatted).toContain('stage: checkout');
    expect(formatted).toContain('HTTP: 422');
    expect(formatted).toContain('cleanup also failed');
    expect(formatted).not.toContain(COOKIE_VALUE);
    expect(formatted).not.toContain(TOKEN);
    expect(formatted).not.toContain(CHECKOUT_URL);
  });
});
