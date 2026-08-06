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
   * Crea o regenera checkout delegado en el proveedor de pago externo (Shopify al conectar).
   * Debe reconciliar `cart` contra la autoridad remota y devolver hosts permitidos explícitos.
   */
  checkout(cart: Cart): Promise<CheckoutResult>;
  subscribeToExternalChanges?(listener: () => void): () => void;
}
