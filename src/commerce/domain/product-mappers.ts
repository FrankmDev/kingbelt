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
  minimum: number;
  increment: number;
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

type PublicAvailabilityCode = 'a' | 'l' | 'o' | 'u';
type PublicLimitCode = 'i' | 'q' | 't' | 'u';

export type CompactPublicBuyBoxVariant = readonly [
  id: ProductVariant['id'],
  optionValueIds: readonly string[],
  priceMinor: number,
  compareAtPriceMinor: number | null,
  imageId: string | null,
  availability: PublicAvailabilityCode,
  maxQuantity: number,
  minimum: number,
  increment: number,
  limitReason: PublicLimitCode,
  backorder: 0 | 1,
];

export interface CompactPublicBuyBoxPayload {
  /** Moneda única del producto. */
  c: string;
  /** IDs de opciones en el orden usado por cada tupla de variante. */
  o: string[];
  /** Tuplas compactas sin SKU, inventario, nombres ni objetos repetidos. */
  v: CompactPublicBuyBoxVariant[];
}

const availabilityCodes: Record<AvailabilityStatus, PublicAvailabilityCode> = {
  available: 'a',
  limited: 'l',
  out_of_stock: 'o',
  unavailable: 'u',
};

const limitCodes: Record<LineAvailability['limitReason'], PublicLimitCode> = {
  inventory: 'i',
  quantity_rule: 'q',
  technical: 't',
  unavailable: 'u',
};

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
  variant: Pick<ProductVariant, 'salesStatus' | 'inventory' | 'inventoryPolicy' | 'quantityRule'>
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
      minimum: availability.minimum,
      increment: availability.increment,
      maxQuantity: availability.maxQuantity,
      limitReason: availability.limitReason,
    };
  }

  const quantityMaximum =
    Number.isSafeInteger(variant.quantityRule.maximum) && Number(variant.quantityRule.maximum) > 0
      ? Number(variant.quantityRule.maximum)
      : undefined;

  if (quantityMaximum !== undefined) {
    return {
      ...base,
      minimum: variant.quantityRule.minimum,
      increment: variant.quantityRule.increment,
      maxQuantity: quantityMaximum,
      limitReason: 'quantity_rule',
    };
  }

  return {
    ...base,
    minimum: variant.quantityRule.minimum,
    increment: variant.quantityRule.increment,
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

export const toCompactPublicBuyBoxPayload = (
  product: Pick<Product, 'options' | 'variants'>
): CompactPublicBuyBoxPayload => {
  const currency = product.variants[0]?.price.currency;
  if (!currency) throw new Error('No se puede crear el payload público de un producto sin variantes.');
  return {
    c: currency,
    o: product.options.map((option) => option.id),
    v: product.variants.map((variant) => {
      const publicVariant = toPublicBuyBoxVariant(variant);
      const valuesByOption = new Map(
        variant.optionValues.map((selection) => [selection.optionId, selection.valueId])
      );
      return [
        publicVariant.id,
        product.options.map((option) => valuesByOption.get(option.id) ?? ''),
        publicVariant.price,
        publicVariant.compareAtPrice ?? null,
        publicVariant.imageId ?? null,
        availabilityCodes[publicVariant.availability.status],
        publicVariant.availability.maxQuantity,
        publicVariant.availability.minimum,
        publicVariant.availability.increment,
        limitCodes[publicVariant.availability.limitReason],
        publicVariant.availability.backorder ? 1 : 0,
      ];
    }),
  };
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
