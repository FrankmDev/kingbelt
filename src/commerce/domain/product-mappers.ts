import { commerceRules } from './commerce-rules';
import {
  getVariantAvailability,
  isVariantPurchasable,
  TECHNICAL_LINE_QUANTITY_LIMIT,
} from './inventory';
import type { AvailabilityStatus, LineAvailability } from './inventory';
import { calculatePriceRange } from './variants';
import { getPrimaryProductImage, getVariantImage } from './product-media';
import type { CartProduct, SelectedOptionLabel } from './cart';
import type {
  Collection,
  CollectionReference,
  OptionSelection,
  Product,
  ProductSummary,
  ProductVariant,
} from './catalog';

/**
 * Disponibilidad compacta para la ficha. Sin cantidad exacta ni mensajes.
 * `purchasable` se deriva de `status` en el cliente.
 */
export interface PublicBuyBoxAvailability {
  status: AvailabilityStatus;
  maxQuantity: number;
  limitReason: LineAvailability['limitReason'];
  backorder?: true;
}

/**
 * Proyección pública de variante para el buy box.
 * Omite inventario exacto salvo que la política confirme exponerlo.
 */
export interface PublicBuyBoxVariant {
  id: ProductVariant['id'];
  optionValues: OptionSelection[];
  price: number;
  compareAtPrice?: number;
  imageId?: ProductVariant['imageId'];
  availability: PublicBuyBoxAvailability;
  inventory?: ProductVariant['inventory'];
}

export const isPublicBuyBoxPurchasable = (
  availability: PublicBuyBoxAvailability
): boolean =>
  availability.status !== 'out_of_stock' && availability.status !== 'unavailable';

/**
 * Tope visible en ficha/HTML. Con `exposeExactInventory: false` no publica el
 * techo de almacén: usa límite comercial o técnico. El carrito sigue siendo
 * autoridad y ajustará o rechazará cantidades.
 */
export const toPublicBuyBoxAvailability = (
  variant: Pick<ProductVariant, 'salesStatus' | 'inventory' | 'inventoryPolicy' | 'purchaseLimit'>
): PublicBuyBoxAvailability => {
  const availability = getVariantAvailability(variant);
  const base = {
    status: availability.status,
    ...(availability.backorder ? { backorder: true as const } : {}),
  };

  if (
    !availability.purchasable ||
    commerceRules.availability.exposeExactInventory ||
    availability.limitReason !== 'inventory'
  ) {
    return {
      ...base,
      maxQuantity: availability.maxQuantity,
      limitReason: availability.limitReason,
    };
  }

  const purchaseLimit =
    Number.isSafeInteger(variant.purchaseLimit) && Number(variant.purchaseLimit) > 0
      ? Number(variant.purchaseLimit)
      : undefined;

  if (purchaseLimit !== undefined) {
    return {
      ...base,
      maxQuantity: purchaseLimit,
      limitReason: 'purchase_limit',
    };
  }

  return {
    ...base,
    maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
    limitReason: 'technical',
  };
};

export const toPublicBuyBoxVariant = (variant: ProductVariant): PublicBuyBoxVariant => {
  const projection: PublicBuyBoxVariant = {
    id: variant.id,
    optionValues: variant.optionValues,
    price: variant.price.amountMinor,
    availability: toPublicBuyBoxAvailability(variant),
  };
  if (variant.compareAtPrice) projection.compareAtPrice = variant.compareAtPrice.amountMinor;
  if (variant.imageId) projection.imageId = variant.imageId;
  if (commerceRules.availability.exposeExactInventory) {
    projection.inventory = variant.inventory;
  }
  return projection;
};

/** Mensaje de ficha derivado de la proyección pública (sin cifrar stock). */
export const getPublicBuyBoxMessage = (
  availability: PublicBuyBoxAvailability
): string => {
  switch (availability.status) {
    case 'unavailable':
      return 'Esta variante no está disponible.';
    case 'out_of_stock':
      return 'Producto agotado.';
    case 'limited':
      return 'Quedan pocas unidades.';
    case 'available':
      return availability.backorder ? 'Disponible para pedir.' : 'Disponible.';
    default: {
      const _exhaustive: never = availability.status;
      return _exhaustive;
    }
  }
};

export const toCollectionReference = (collection: Collection): CollectionReference => ({
  id: collection.id,
  handle: collection.handle,
  title: collection.title,
});

export const toProductSummary = (
  product: Product,
  primaryCollection: CollectionReference
): ProductSummary => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  reference: product.reference,
  primaryCollection,
  productType: product.productType,
  primaryImage: getPrimaryProductImage(product),
  summary: product.summary,
  priceRange: calculatePriceRange(product.variants),
  purchasable: product.variants.some(isVariantPurchasable),
  colors: product.options.find((option) => option.purpose === 'color')?.values ?? [],
  badge: product.badge,
});

export const getSelectedOptionLabels = (
  product: Pick<Product, 'options'>,
  variant: Pick<ProductVariant, 'optionValues'>
): SelectedOptionLabel[] => product.options.flatMap((option) => {
  const selection = variant.optionValues.find((item) => item.optionId === option.id);
  const value = option.values.find((item) => item.id === selection?.valueId);
  return value ? [{ name: option.name, value: value.label }] : [];
});

export const toCartProduct = (
  product: Product,
  variant: ProductVariant,
  primaryCollection: CollectionReference
): CartProduct => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  collection: primaryCollection.title,
  reference: product.reference,
  unitPrice: variant.price,
  image: getVariantImage(product, variant),
  href: `/productos/${product.handle}`,
});
