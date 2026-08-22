import type { ProductImage } from './catalog';
import type { ProductId, VariantId } from './identifiers';
import type { LineAvailability } from './inventory';
import type { Money } from './money';
import { commerceRules } from './commerce-rules';

/** Instantánea resuelta por el proveedor para presentar una línea. */
export interface CartProduct {
  id: ProductId;
  handle: string;
  title: string;
  collection: string;
  reference: string;
  unitPrice: Money;
  image?: ProductImage;
  href: string;
}

export interface SelectedOptionLabel {
  name: string;
  value: string;
}

export interface CartLine {
  id: string;
  variantId: VariantId;
  product: CartProduct;
  selectedOptions: SelectedOptionLabel[];
  quantity: number;
  availability: LineAvailability;
  lineTotal: Money;
}

export type CartLineErrorCode =
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'quantity_limit'
  | 'unavailable'
  | 'quantity_adjusted'
  | 'product_removed';

export interface CartLineError {
  lineId: string;
  code: CartLineErrorCode;
  message: string;
  severity?: 'error' | 'notice';
}

export const MAX_CART_LINES = commerceRules.cart.maximumDistinctLines;
export const MAX_CART_LINES_MESSAGE =
  `El carrito admite un máximo de ${MAX_CART_LINES} productos distintos.`;

export type CartStatus =
  | 'idle'
  | 'loading'
  | 'updating'
  | 'recovering'
  | 'checkout'
  | 'error';

export interface Cart {
  lines: CartLine[];
  itemCount: number;
  subtotal: Money;
  lineErrors: CartLineError[];
  status: CartStatus;
  canCheckout: boolean;
  globalError?: string;
  globalNotice?: string;
  recovery?: 'reset_required';
}

export interface AddToCartInput {
  variantId: VariantId;
  quantity: number;
}

export type CartOperationErrorCode =
  | 'validation'
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'quantity_limit'
  | 'unavailable'
  | 'not_found'
  | 'cart_unrecoverable'
  | 'provider_error';

export interface CartOperationMessage {
  code: CartOperationErrorCode | 'quantity_adjusted' | 'product_removed' | 'cart_updated';
  message: string;
  field?: 'variant' | 'quantity';
}

export interface CartOperationResult {
  success: boolean;
  cart: Cart;
  error?: CartOperationMessage;
  notice?: CartOperationMessage;
  adjustedQuantity?: number;
}
