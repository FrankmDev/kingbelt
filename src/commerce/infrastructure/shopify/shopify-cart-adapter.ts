import type { CartProvider } from '../../application/cart-provider';
import type { CheckoutResult } from '../../application/checkout';
import type { AddToCartInput, Cart, CartOperationResult } from '../../domain/cart';

class ShopifyCartHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

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

const request = async (command: Record<string, unknown>): Promise<CartResponse> => {
  const response = await fetch('/api/cart', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(command),
  });
  let body: CartResponse;
  try { body = await response.json(); } catch { throw new ShopifyCartHttpError(response.status, 'invalid_response'); }
  if (!response.ok && response.status !== 410) throw new ShopifyCartHttpError(response.status, body.message ?? 'cart_request_failed');
  return body;
};

export const createShopifyCartAdapter = (): CartProvider => ({
  async initialize() {
    const response = await request({ command: 'refresh' });
    if (!response.cart) throw new Error('cart_response_missing');
    return response.cart;
  },
  async refresh() {
    const response = await request({ command: 'refresh' });
    if (!response.cart) throw new Error('cart_response_missing');
    return response.cart;
  },
  async addItem(input: AddToCartInput) {
    const response = await request({ command: 'add', variantId: input.variantId, quantity: input.quantity });
    if (!response.cart) throw new Error('cart_response_missing');
    return {
      success: Boolean(response.success),
      cart: response.cart,
      ...(response.error ? { error: response.error } : {}),
      ...(response.notice ? { notice: response.notice } : {}),
      ...(response.adjustedQuantity === undefined ? {} : { adjustedQuantity: response.adjustedQuantity }),
    };
  },
  async updateItem(lineId: string, quantity: number) {
    const response = await request({ command: 'update', lineId, quantity });
    if (!response.cart) throw new Error('cart_response_missing');
    return { success: Boolean(response.success), cart: response.cart, ...(response.error ? { error: response.error } : {}) };
  },
  async removeItem(lineId: string) {
    const response = await request({ command: 'remove', lineId });
    if (!response.cart) throw new Error('cart_response_missing');
    return { success: Boolean(response.success), cart: response.cart, ...(response.error ? { error: response.error } : {}) };
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

export const createHybridCartAdapter = (
  remote: CartProvider,
  fallback: CartProvider,
): CartProvider => {
  let active = remote;
  return {
    async initialize() {
      try { return await active.initialize(); }
      catch (error) {
        if (error instanceof ShopifyCartHttpError && error.status === 503) {
          active = fallback;
          return active.initialize();
        }
        throw error;
      }
    },
    refresh: () => active.refresh(),
    addItem: (input) => active.addItem(input),
    updateItem: (lineId, quantity) => active.updateItem(lineId, quantity),
    removeItem: (lineId) => active.removeItem(lineId),
    checkout: (cart) => active.checkout(cart),
    subscribeToExternalChanges: (listener) => active.subscribeToExternalChanges?.(listener) ?? (() => undefined),
  };
};
