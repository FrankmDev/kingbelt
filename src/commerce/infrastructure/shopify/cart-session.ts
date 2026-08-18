import { createHmac, timingSafeEqual } from 'node:crypto';

export const SHOPIFY_CART_COOKIE_NAME = 'kingbelt_cart';
const MAX_CART_ID_LENGTH = 512;

const encode = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const signature = (value: string, secret: string): string =>
  createHmac('sha256', secret).update(value).digest('base64url');

export const signCartId = (cartId: string, secret: string): string => {
  if (!cartId || cartId.length > MAX_CART_ID_LENGTH || !secret || secret.length < 32) return '';
  const encoded = encode(cartId);
  return `${encoded}.${signature(encoded, secret)}`;
};

export const verifyCartCookie = (value: string | undefined, secret: string | undefined): string | undefined => {
  if (!value || !secret || secret.length < 32) return undefined;
  const [encoded, received] = value.split('.');
  if (!encoded || !received || received.length > 128) return undefined;
  const expected = Buffer.from(signature(encoded, secret));
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  try {
    const cartId = decode(encoded);
    return cartId && cartId.length <= MAX_CART_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(cartId)
      ? cartId
      : undefined;
  } catch {
    return undefined;
  }
};
