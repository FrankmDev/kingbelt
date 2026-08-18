import type { APIRoute } from 'astro';
import { emptyCart } from '@commerce/application/cart-service';
import { commerceSource } from '@commerce/commerce-source';

export const prerender = false;

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

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (commerceSource === 'demo') return json({ error: 'not_found' }, 404);

  const {
    SHOPIFY_CART_COOKIE_NAME,
    createConfiguredShopifyCartService,
    getShopifyCartCookieSecret,
    signCartId,
    verifyCartCookie,
  } = await import('@commerce/cart-server');

  let service: ReturnType<typeof createConfiguredShopifyCartService>;
  let cartCookieSecret: string;
  try {
    service = createConfiguredShopifyCartService(clientAddress);
    cartCookieSecret = getShopifyCartCookieSecret();
  } catch {
    return json({ error: 'commerce_unavailable' }, 503);
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'origin_not_allowed' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!isCommand(body)) return json({ error: 'invalid_command' }, 400);

  const clearCookie = () => {
    cookies.delete(SHOPIFY_CART_COOKIE_NAME, { path: '/' });
  };
  const setCartCookie = (cartId: string | undefined) => {
    if (!cartId) return clearCookie();
    const value = signCartId(cartId, cartCookieSecret);
    if (!value) return clearCookie();
    cookies.set(SHOPIFY_CART_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  };

  const cartId = verifyCartCookie(cookies.get(SHOPIFY_CART_COOKIE_NAME)?.value, cartCookieSecret);
  const publicBody = <T extends { cartId?: string }>(result: T) => {
    const { cartId: _cartId, ...rest } = result;
    return rest;
  };

  try {
    if (body.command === 'refresh') {
      if (!cartId) return json({ success: true, cart: emptyCart() });
      const result = await service.get(cartId);
      if (!result.cartId) clearCookie();
      return json({ success: true, cart: result.cart });
    }
    if (body.command === 'add') {
      const result = await service.add(cartId, body.variantId, body.quantity);
      setCartCookie(result.cartId ?? cartId);
      return json(publicBody(result), result.success ? 200 : 422);
    }
    if (!cartId) return json({ success: false, cart: emptyCart(), error: { code: 'not_found', message: 'El carrito ha caducado.' } }, 410);
    if (body.command === 'update') {
      const result = await service.update(cartId, body.lineId, body.quantity);
      return json(publicBody(result), result.success ? 200 : 422);
    }
    if (body.command === 'remove') {
      const result = await service.remove(cartId, body.lineId);
      return json(publicBody(result), result.success ? 200 : 422);
    }
    const result = await service.checkout(cartId);
    if (result.status === 'expired') clearCookie();
    return json(
      { success: result.status === 'ready', ...publicBody(result) },
      result.status === 'ready' ? 200 : 422
    );
  } catch {
    return json({ error: 'provider_error' }, 502);
  }
};
