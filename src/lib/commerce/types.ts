/** Dominio de comercio neutral. Ningún tipo de esta capa depende de Shopify. */

export type CurrencyCode = 'EUR';

/** Los importes se guardan siempre en unidades mínimas. */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface PriceRange {
  min: Money;
  max: Money;
}

export interface ProductImage {
  url: string;
  altText: string;
  width?: number;
  height?: number;
  position?: string;
  /** Permite conservar medios provisionales aprobados sin tratarlos como datos finales. */
  placeholder?: boolean;
}

export interface ProductMediaGroup {
  optionName: string;
  optionValue: string;
  images: ProductImage[];
}

export interface ProductOptionValue {
  value: string;
  /** Muestra visual proporcionada por el origen; nunca se infiere en la UI. */
  swatch?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: ProductOptionValue[];
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductWeight {
  value: number;
  unit: 'g' | 'kg';
}

export interface ProductVariant {
  id: string;
  sku: string;
  title?: string;
  selectedOptions: SelectedOption[];
  price: Money;
  compareAtPrice?: Money;
  availableForSale: boolean;
  quantityAvailable?: number;
  currentlyNotInStock?: boolean;
  image?: ProductImage;
  weight?: ProductWeight;
}

export interface SEOData {
  title?: string;
  description?: string;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface CommerceCollection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image?: ProductImage;
  featured?: boolean;
  badge?: string;
  tagline?: string;
  /** Relación opcional útil para validar imports antes de construir el proveedor. */
  productHandles?: string[];
}

export interface ProductCollectionReference {
  id: string;
  handle: string;
  title: string;
}

export interface CommerceProductSummary {
  id: string;
  handle: string;
  title: string;
  reference: string;
  primaryCollection: ProductCollectionReference;
  productType: string;
  primaryImage?: ProductImage;
  shortDescription: string;
  priceRange: PriceRange;
  availableForSale: boolean;
  colors: ProductOptionValue[];
  badge?: string;
}

export interface CommerceProduct extends CommerceProductSummary {
  description: string;
  vendor: string;
  collections: ProductCollectionReference[];
  options: ProductOption[];
  variants: ProductVariant[];
  gallery: ProductImage[];
  mediaGroups?: ProductMediaGroup[];
  specifications: ProductSpecification[];
  seo: SEOData;
}

export interface CollectionFacetValue {
  value: string;
  count: number;
  swatch?: string;
}

export interface CollectionPriceRange {
  id: string;
  label: string;
}

export interface CollectionFacets {
  productTypes: CollectionFacetValue[];
  colors: CollectionFacetValue[];
  priceRanges: CollectionPriceRange[];
  availability?: CollectionFacetValue[];
}

export interface CommerceCollectionPage {
  collection: CommerceCollection;
  products: CommerceProductSummary[];
  facets: CollectionFacets;
}

export interface CatalogProvider {
  getCollections(): Promise<CommerceCollection[]>;
  getCollectionByHandle(handle: string): Promise<CommerceCollectionPage | undefined>;
  getProductHandles(): Promise<string[]>;
  getCollectionHandles(): Promise<string[]>;
  getProductByHandle(handle: string): Promise<CommerceProduct | undefined>;
  getFeaturedProducts(limit: number): Promise<CommerceProductSummary[]>;
  getRelatedProducts(
    product: CommerceProduct,
    limit: number
  ): Promise<CommerceProductSummary[]>;
}

export type AvailabilityStatus = 'available' | 'out_of_stock' | 'unavailable' | 'limited';

export interface LineAvailability {
  status: AvailabilityStatus;
  /** 99 es el límite de la demo cuando el proveedor no comunica stock. */
  maxQuantity: number;
  quantityKnown: boolean;
  message?: string;
}

/** Instantánea resuelta por el proveedor para presentar una línea. */
export interface CartProduct {
  id: string;
  handle: string;
  title: string;
  collection: string;
  reference: string;
  unitPrice: Money;
  image?: ProductImage;
  href: string;
}

export interface CartLine {
  id: string;
  variantId: string;
  product: CartProduct;
  selectedOptions: SelectedOption[];
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
  globalNotice?: string;
}

export interface AddToCartInput {
  variantId: string;
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
  field?: 'variant' | 'quantity';
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
  url?: string;
  allowedHosts?: readonly string[];
  message?: string;
}

/** El carrito y el catálogo mantienen fronteras sustituibles independientes. */
export interface CommerceProvider {
  initialize(): Promise<Cart>;
  addItem(input: AddToCartInput): Promise<CartOperationResult>;
  updateItem(lineId: string, quantity: number): Promise<CartOperationResult>;
  removeItem(lineId: string): Promise<CartOperationResult>;
  checkout(): Promise<CheckoutResult>;
}
