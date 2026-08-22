import type { AddToCartInput, Cart, CartOperationResult } from '../domain/cart';
import type { CheckoutResult } from './checkout';

export const CART_UNRECOVERABLE_MESSAGE =
  'El carrito ya no puede recuperarse porque uno de sus productos ha cambiado.';

/**
 * Estado remoto existente que Shopify devolvió correctamente pero que incumple
 * una invariante determinista del carrito. No incluye IDs ni datos del payload.
 */
export class UnrecoverableCartStateError extends Error {
  readonly name = 'UnrecoverableCartStateError';

  constructor() {
    super('The authoritative Shopify cart failed deterministic integrity validation.');
  }
}

/** Puerto del carrito; el adaptador activo se elige fuera de componentes visuales. */
export interface CartProvider {
  initialize(): Promise<Cart>;
  refresh(): Promise<Cart>;
  addItem(input: AddToCartInput): Promise<CartOperationResult>;
  updateItem(lineId: string, quantity: number): Promise<CartOperationResult>;
  removeItem(lineId: string): Promise<CartOperationResult>;
  /** Abandona de forma explícita la referencia local al carrito actual. */
  resetCart(): Promise<CartOperationResult>;
  /**
   * Prepara y reconcilia checkout en una sola operación.
   * El provider remoto devuelve el Cart autoritativo y hosts permitidos explícitos.
   */
  checkout(): Promise<CheckoutResult>;
  subscribeToExternalChanges?(listener: () => void): () => void;
}
