/** Modelo de dominio neutral. Ningún tipo de esta capa depende de Shopify. */

export type CurrencyCode = 'EUR';

/**
 * El importe se guarda en la unidad mínima para evitar errores de coma flotante.
 * Un adaptador de Shopify debe convertir su decimal a este formato en el borde.
 */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface CommerceImage {
  src: string;
  alt: string;
  position?: string;
}

/** Instantánea pública y normalizada que necesita la UI del carrito. */
export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  reference: string;
  unitPrice: Money;
  sizeUnit?: string;
  image?: CommerceImage;
  href: string;
}

export interface LocalCatalogProduct {
  product: CartProduct;
  colors: readonly string[];
  sizes: readonly string[];
}

export type AvailabilityStatus = 'available' | 'out_of_stock' | 'unavailable' | 'limited';

export interface LineAvailability {
  status: AvailabilityStatus;
  maxQuantity: number;
  message?: string;
}

export interface CartLine {
  id: string;
  productId: string;
  product: CartProduct;
  color: string;
  size: string;
  quantity: number;
  availability: LineAvailability;
  lineTotal: Money;
}

export type CartLineErrorCode =
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'unavailable'
  | 'quantity_adjusted'
  | 'product_removed';

export interface CartLineError {
  lineId: string;
  code: CartLineErrorCode;
  message: string;
  severity?: 'error' | 'notice';
}

export type CartStatus = 'idle' | 'loading' | 'updating' | 'recovering' | 'error';

export interface Cart {
  lines: CartLine[];
  itemCount: number;
  subtotal: Money;
  lineErrors: CartLineError[];
  status: CartStatus;
  canCheckout: boolean;
  globalError?: string;
}

export interface AddToCartInput {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export type CartOperationErrorCode =
  | 'validation'
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'unavailable'
  | 'not_found'
  | 'provider_error';

export interface CartOperationMessage {
  code: CartOperationErrorCode | 'quantity_adjusted' | 'product_removed';
  message: string;
  field?: 'color' | 'size' | 'quantity';
}

export interface CartOperationResult {
  success: boolean;
  cart: Cart;
  error?: CartOperationMessage;
  notice?: CartOperationMessage;
  adjustedQuantity?: number;
}

export type CheckoutStatus = 'idle' | 'preparing' | 'unavailable' | 'error';

export interface CheckoutResult {
  status: CheckoutStatus;
  /** URL externa ya obtenida por el proveedor. La UI vuelve a validarla antes de navegar. */
  url?: string;
  /** Hosts exactos permitidos para la redirección. Nunca incluir patrones amplios. */
  allowedHosts?: readonly string[];
  message?: string;
}

/**
 * Único contrato que consume el estado cliente. La integración Shopify futura
 * sustituirá la implementación, no los componentes ni las operaciones de UI.
 */
export interface CommerceProvider {
  initialize(): Promise<Cart>;
  addItem(input: AddToCartInput): Promise<CartOperationResult>;
  updateItem(lineId: string, quantity: number): Promise<CartOperationResult>;
  removeItem(lineId: string): Promise<CartOperationResult>;
  checkout(): Promise<CheckoutResult>;
}
