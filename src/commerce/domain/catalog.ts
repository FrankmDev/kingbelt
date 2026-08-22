import type { Money, PriceRange } from './money';
import type { ProductId, Sku, VariantId } from './identifiers';

/** Contratos neutrales de catálogo. Ningún tipo depende de un proveedor externo. */
export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  /** Dimensiones conocidas del origen; obligatorias para reservar el layout. */
  width: number;
  height: number;
  /** Posición de encuadre CSS (`object-position`); por defecto centrado. */
  position?: string;
}

export interface ProductMediaGroup {
  id: string;
  optionValueId: string;
  imageIds: string[];
}

/** Cardinalidad objetivo de una galería estructurada: portada, detalle y contexto. */
export const COLOR_GALLERY_IMAGE_COUNT = 3;

export interface ProductOptionValue {
  id: string;
  label: string;
  /** Muestra visual proporcionada por el origen; nunca se infiere en la UI. */
  swatch?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  purpose?: 'color' | 'size';
  values: ProductOptionValue[];
}

export interface OptionSelection {
  optionId: string;
  valueId: string;
}

export interface ProductWeight {
  value: number;
  unit: 'g' | 'kg' | 'oz' | 'lb';
}

export type VariantInventory =
  | { kind: 'known'; quantity: number }
  | { kind: 'unknown' };

export type InventoryPolicy = 'deny' | 'continue';
export type VariantSalesStatus = 'active' | 'unavailable';

export interface QuantityRule {
  minimum: number;
  increment: number;
  maximum?: number;
}

export interface ProductVariant {
  id: VariantId;
  sku: Sku;
  title?: string;
  optionValues: OptionSelection[];
  price: Money;
  compareAtPrice?: Money;
  salesStatus: VariantSalesStatus;
  inventory: VariantInventory;
  inventoryPolicy: InventoryPolicy;
  /** Regla comercial autoritativa de cantidad normalizada desde el origen. */
  quantityRule: QuantityRule;
  /** Imagen asociada realmente a la variante por el proveedor. Con Color, validada contra la portada de su galería. */
  imageId?: string;
  weight?: ProductWeight;
}

export interface ProductSeo {
  title?: string;
  description?: string;
}

export interface OfficialProductCategory {
  id: string;
  name: string;
}

export type ProductPublicationStatus = 'published' | 'unpublished';

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image?: ProductImage;
  featured?: boolean;
  badge?: string;
  tagline?: string;
}

export interface CollectionReference {
  id: string;
  handle: string;
  title: string;
}

export interface ProductSummary {
  id: ProductId;
  handle: string;
  title: string;
  reference: string;
  primaryCollection: CollectionReference;
  productType: string;
  primaryImage?: ProductImage;
  summary: string;
  priceRange: PriceRange;
  purchasable: boolean;
  colors: ProductOptionValue[];
  badge?: string;
}

export interface Product {
  id: ProductId;
  reference: string;
  handle: string;
  title: string;
  description: string;
  summary: string;
  vendor: string;
  productType: string;
  category: OfficialProductCategory;
  publicationStatus: ProductPublicationStatus;
  primaryCollectionId: string;
  collectionIds: string[];
  badge?: string;
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  primaryImageId?: string;
  mediaGroups: ProductMediaGroup[];
  specifications: ProductSpecification[];
  seo?: ProductSeo;
}

export interface CollectionFacetValue {
  value: string;
  count: number;
  swatch?: string;
}

export interface CollectionPriceRange {
  id: string;
  label: string;
  /** Límite inferior incluido, en unidades mínimas. */
  minMinor?: number;
  /** Límite superior excluido, en unidades mínimas. Los rangos nunca se solapan. */
  maxMinor?: number;
}

export interface CollectionPriceRangeFacet extends CollectionPriceRange {
  count: number;
}

export interface CollectionFacets {
  productTypes: CollectionFacetValue[];
  colors: CollectionFacetValue[];
  priceRanges: CollectionPriceRangeFacet[];
  availability: CollectionFacetValue[];
}

export interface CollectionPage {
  collection: Collection;
  products: ProductSummary[];
  facets: CollectionFacets;
}
