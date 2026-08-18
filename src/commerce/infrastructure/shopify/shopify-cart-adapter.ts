import type { CartProvider } from '../../application/cart-provider';
import type { CheckoutResult } from '../../application/checkout';
import type { AddToCartInput, Cart, CartOperationResult } from '../../domain/cart';

class ShopifyCartHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const CART_REQUEST_TIMEOUT_MS = 20_000;

interface CartResponse extends Partial<CartOperationResult> {
  success?: boolean;
  cart?: Cart;
  error?: CartOperationResult['error'];
  notice?: CartOperationResult['notice'];
  adjustedQuantity?: number;
  status?: CheckoutResult['status'];
  url?: string;
  allowedHosts?: readonly string[];
  message?: string;
  priceChanged?: boolean;
}

const toOperationResult = (response: CartResponse): CartOperationResult => {
  if (!response.cart) throw new Error('cart_response_missing');
  return {
    success: Boolean(response.success),
    cart: response.cart,
    ...(response.error ? { error: response.error } : {}),
    ...(response.notice ? { notice: response.notice } : {}),
    ...(response.adjustedQuantity === undefined ? {} : { adjustedQuantity: response.adjustedQuantity }),
  };
};

const request = async (command: Record<string, unknown>): Promise<CartResponse> => {
  const response = await fetch('/api/cart', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(CART_REQUEST_TIMEOUT_MS),
  });
  let body: CartResponse;
  try { body = await response.json(); } catch { throw new ShopifyCartHttpError(response.status, 'invalid_response'); }
  if (!response.ok && response.status !== 410 && response.status !== 422) {
    throw new ShopifyCartHttpError(response.status, body.message ?? 'cart_request_failed');
  }
  return body;
};

const loadCart = async (): Promise<Cart> => {
  const response = await request({ command: 'refresh' });
  if (!response.cart) throw new Error('cart_response_missing');
  return response.cart;
};

export const createShopifyCartAdapter = (): CartProvider => ({
  initialize: loadCart,
  refresh: loadCart,
  async addItem(input: AddToCartInput) {
    return toOperationResult(await request({ command: 'add', variantId: input.variantId, quantity: input.quantity }));
  },
  async updateItem(lineId: string, quantity: number) {
    return toOperationResult(await request({ command: 'update', lineId, quantity }));
  },
  async removeItem(lineId: string) {
    return toOperationResult(await request({ command: 'remove', lineId }));
  },
  async checkout() {
    const response = await request({ command: 'checkout' });
    return {
      status: response.status ?? 'error',
      ...(response.url ? { url: response.url } : {}),
      ...(response.allowedHosts ? { allowedHosts: response.allowedHosts } : {}),
      ...(response.cart ? { cart: response.cart } : {}),
      ...(response.message ? { message: response.message } : {}),
      ...(response.priceChanged === undefined ? {} : { priceChanged: response.priceChanged }),
    } satisfies CheckoutResult;
  },
});
