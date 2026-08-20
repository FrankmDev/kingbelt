import type { APIRoute } from 'astro';
import { CHECKOUT_EXPIRED_MESSAGE, type CheckoutStatus } from '@commerce/application/checkout';
import { emptyCart } from '@commerce/application/cart-service';
import { isDemoCommerce } from '@commerce/commerce-source';
import type { CartOperationResult } from '@commerce/domain/cart';
import { isTechnicalLineQuantity } from '@commerce/domain/inventory';

export const prerender = false;

const SHOPIFY_CART_SESSION_KEY = 'shopifyCartId' as const;
const CART_REQUEST_MAX_BYTES = 2_048;
const SHOPIFY_RESOURCE_ID_MAX_LENGTH = 256;

type Command =
  | { command: 'refresh' }
  | { command: 'add'; variantId: string; quantity: number }
  | { command: 'update'; lineId: string; quantity: number }
  | { command: 'remove'; lineId: string }
  | { command: 'checkout' };

type LimitedBody =
  | { ok: true; text: string }
  | { ok: false; error: 'payload_too_large' | 'invalid_json' };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const isJsonContentType = (value: string | null): boolean =>
  typeof value === 'string'
  && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(value);

const readLimitedRequestBody = async (
  request: Request,
  maxBytes: number
): Promise<LimitedBody> => {
  if (!request.body) return { ok: false, error: 'invalid_json' };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { ok: false, error: 'invalid_json' };
  }

  const buffer = new Uint8Array(maxBytes);
  let offset = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (offset + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: 'payload_too_large' };
      }
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, error: 'invalid_json' };
  }

  if (offset === 0) return { ok: false, error: 'invalid_json' };
  try {
    return {
      ok: true,
      text: new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset)),
    };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
};

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

const isShopifyResourceId = (value: unknown, resource: 'ProductVariant' | 'CartLine'): value is string => {
  if (typeof value !== 'string' || value.length > SHOPIFY_RESOURCE_ID_MAX_LENGTH) return false;
  if (/[\u0000-\u0020\u007f]/.test(value) || /\s/.test(value)) return false;
  return new RegExp(`^gid://shopify/${resource}/[^/?#\\s]+$`).test(value);
};

const isCommandQuantity = (value: unknown): value is number =>
  typeof value === 'number' && isTechnicalLineQuantity(value);

const parseCommand = (value: unknown): Command | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.command !== 'string') return undefined;

  switch (input.command) {
    case 'refresh':
    case 'checkout':
      return hasExactKeys(input, ['command']) ? { command: input.command } : undefined;
    case 'remove':
      return hasExactKeys(input, ['command', 'lineId']) && isShopifyResourceId(input.lineId, 'CartLine')
        ? { command: 'remove', lineId: input.lineId }
        : undefined;
    case 'add':
      return hasExactKeys(input, ['command', 'variantId', 'quantity'])
        && isShopifyResourceId(input.variantId, 'ProductVariant')
        && isCommandQuantity(input.quantity)
        ? { command: 'add', variantId: input.variantId, quantity: input.quantity }
        : undefined;
    case 'update':
      return hasExactKeys(input, ['command', 'lineId', 'quantity'])
        && isShopifyResourceId(input.lineId, 'CartLine')
        && isCommandQuantity(input.quantity)
        ? { command: 'update', lineId: input.lineId, quantity: input.quantity }
        : undefined;
    default:
      return undefined;
  }
};

const withoutRemoteCartId = <T extends { cartId?: string }>(result: T) => {
  const { cartId: _cartId, ...rest } = result;
  return rest;
};

const expiredCart = () =>
  json(
    {
      success: false,
      cart: emptyCart(),
      error: { code: 'not_found', message: 'El carrito ha caducado.' },
    },
    410
  );

const expiredCheckout = () =>
  json(
    { success: false, status: 'expired', cart: emptyCart(), message: CHECKOUT_EXPIRED_MESSAGE },
    410
  );

type CartMutationResult = CartOperationResult & { cartId?: string };

const mutationJson = (result: CartMutationResult) =>
  json(withoutRemoteCartId(result), result.success ? 200 : 422);

const asIdempotentRemove = (result: CartMutationResult, lineId: string): CartMutationResult => {
  if (
    result.success
    || result.error?.code !== 'not_found'
    || result.cart.lines.some((line) => line.id === lineId)
  ) {
    return result;
  }
  return {
    success: true,
    cart: result.cart,
    cartId: result.cartId,
    notice: { code: 'product_removed', message: 'Producto eliminado del carrito.' },
  };
};

const checkoutHttpStatus = (status: CheckoutStatus): number => {
  switch (status) {
    case 'ready':
      return 200;
    case 'blocked':
    case 'unavailable':
      return 422;
    case 'expired':
      return 410;
    case 'error':
      return 502;
  }
};

export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  if (isDemoCommerce()) return json({ error: 'not_found' }, 404);
  if (!session) return json({ error: 'commerce_unavailable' }, 503);

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return json({ error: 'request_not_allowed' }, 403);
  }

  // Astro security.checkOrigin no cubre application/json; Origin exacto es obligatorio aquí.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ error: 'origin_not_allowed' }, 403);
  }

  if (!isJsonContentType(request.headers.get('content-type'))) {
    return json({ error: 'unsupported_media_type' }, 415);
  }

  const rawContentLength = request.headers.get('content-length');
  if (rawContentLength !== null) {
    if (!/^[0-9]+$/.test(rawContentLength)) {
      return json({ error: 'invalid_content_length' }, 400);
    }
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength)) {
      return json({ error: 'invalid_content_length' }, 400);
    }
    if (contentLength > CART_REQUEST_MAX_BYTES) {
      return json({ error: 'payload_too_large' }, 413);
    }
  }

  const bodyResult = await readLimitedRequestBody(request, CART_REQUEST_MAX_BYTES);
  if (!bodyResult.ok) {
    return json(
      { error: bodyResult.error },
      bodyResult.error === 'payload_too_large' ? 413 : 400
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyResult.text);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const body = parseCommand(parsed);
  if (!body) return json({ error: 'invalid_command' }, 400);

  const { createConfiguredShopifyCartService } = await import('@commerce/cart-server');
  let service: ReturnType<typeof createConfiguredShopifyCartService>;
  let shopifyCartId: string | undefined;
  try {
    service = createConfiguredShopifyCartService(clientAddress);
    shopifyCartId = await session.get(SHOPIFY_CART_SESSION_KEY);
  } catch {
    return json({ error: 'commerce_unavailable' }, 503);
  }

  const rememberRemoteCart = (cartId: string | undefined) => {
    if (!cartId) return;
    session.set(SHOPIFY_CART_SESSION_KEY, cartId);
  };
  const forgetRemoteCart = () => {
    session.delete(SHOPIFY_CART_SESSION_KEY);
  };

  try {
    if (body.command === 'refresh') {
      if (!shopifyCartId) return json({ success: true, cart: emptyCart() });
      const result = await service.get(shopifyCartId);
      if (!result.cartId) forgetRemoteCart();
      return json({ success: true, cart: result.cart });
    }

    if (body.command === 'add') {
      const result = await service.add(shopifyCartId, body.variantId, body.quantity);
      rememberRemoteCart(result.cartId);
      return mutationJson(result);
    }

    if (!shopifyCartId) {
      return body.command === 'checkout' ? expiredCheckout() : expiredCart();
    }
    const remoteCartId = shopifyCartId;

    const reconcileNotFound = async (result: CartMutationResult) => {
      if (result.success || result.error?.code !== 'not_found') return result;
      const current = await service.get(remoteCartId);
      if (!current.cartId) {
        forgetRemoteCart();
        return undefined;
      }
      return { ...result, cart: current.cart, cartId: current.cartId };
    };

    if (body.command === 'update') {
      const result = await reconcileNotFound(
        await service.update(remoteCartId, body.lineId, body.quantity)
      );
      return result ? mutationJson(result) : expiredCart();
    }

    if (body.command === 'remove') {
      const result = await reconcileNotFound(
        await service.remove(remoteCartId, body.lineId)
      );
      return result
        ? mutationJson(asIdempotentRemove(result, body.lineId))
        : expiredCart();
    }

    const result = await service.checkout(remoteCartId);
    if (result.status === 'expired') {
      forgetRemoteCart();
      return expiredCheckout();
    }
    return json(
      { success: result.status === 'ready', ...withoutRemoteCartId(result) },
      checkoutHttpStatus(result.status)
    );
  } catch {
    return json({ error: 'provider_error' }, 502);
  }
};
