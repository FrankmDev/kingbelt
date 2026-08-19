import type { APIRoute } from 'astro';
import { emptyCart } from '@commerce/application/cart-service';
import { isDemoCommerce } from '@commerce/commerce-source';

export const prerender = false;

const SHOPIFY_CART_SESSION_KEY = 'shopifyCartId' as const;

type Command =
  | { command: 'refresh' }
  | { command: 'add'; variantId: string; quantity: number }
  | { command: 'update'; lineId: string; quantity: number }
  | { command: 'remove'; lineId: string }
  | { command: 'checkout' };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const isCommand = (value: unknown): value is Command => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (!['refresh', 'add', 'update', 'remove', 'checkout'].includes(String(input.command))) return false;
  if (input.command === 'add') return typeof input.variantId === 'string' && Number.isSafeInteger(input.quantity);
  if (input.command === 'update') return typeof input.lineId === 'string' && Number.isSafeInteger(input.quantity);
  if (input.command === 'remove') return typeof input.lineId === 'string';
  return true;
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

export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  if (isDemoCommerce()) return json({ error: 'not_found' }, 404);

  const { createConfiguredShopifyCartService } = await import('@commerce/cart-server');
  let service: ReturnType<typeof createConfiguredShopifyCartService>;
  try {
    service = createConfiguredShopifyCartService(clientAddress);
  } catch {
    return json({ error: 'commerce_unavailable' }, 503);
  }

  if (!session) return json({ error: 'commerce_unavailable' }, 503);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'origin_not_allowed' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!isCommand(body)) return json({ error: 'invalid_command' }, 400);

  let shopifyCartId: string | undefined;
  try {
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
      return json(withoutRemoteCartId(result), result.success ? 200 : 422);
    }

    if (!shopifyCartId) return expiredCart();

    if (body.command === 'update') {
      const result = await service.update(shopifyCartId, body.lineId, body.quantity);
      return json(withoutRemoteCartId(result), result.success ? 200 : 422);
    }

    if (body.command === 'remove') {
      const result = await service.remove(shopifyCartId, body.lineId);
      return json(withoutRemoteCartId(result), result.success ? 200 : 422);
    }

    const result = await service.checkout(shopifyCartId);
    if (result.status === 'expired') forgetRemoteCart();
    return json(
      { success: result.status === 'ready', ...withoutRemoteCartId(result) },
      result.status === 'ready' ? 200 : 422
    );
  } catch {
    return json({ error: 'provider_error' }, 502);
  }
};
