import type { AddToCartInput, Cart, CartOperationResult } from '../domain/cart';
import type { CheckoutResult } from './checkout';

/** Puerto del carrito; el adaptador activo se elige fuera de componentes visuales. */
export interface CartProvider {
  initialize(): Promise<Cart>;
  refresh(): Promise<Cart>;
  addItem(input: AddToCartInput): Promise<CartOperationResult>;
  updateItem(lineId: string, quantity: number): Promise<CartOperationResult>;
  removeItem(lineId: string): Promise<CartOperationResult>;
  /**
   * Prepara y reconcilia checkout en una sola operación.
   * El provider remoto devuelve el Cart autoritativo y hosts permitidos explícitos.
   */
  checkout(): Promise<CheckoutResult>;
  subscribeToExternalChanges?(listener: () => void): () => void;
}
