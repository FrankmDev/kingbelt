import { commerceRules } from './commerce-rules';
import {
  getVariantAvailability,
  isVariantPurchasable,
  TECHNICAL_LINE_QUANTITY_LIMIT,
} from './inventory';
import type { AvailabilityStatus, LineAvailability } from './inventory';
import { formatMoney, type PriceRange } from './money';
import { calculatePriceRange } from './variants';
import { getPrimaryProductImage, getVariantImage } from './product-media';
import type { CartProduct, SelectedOptionLabel } from './cart';
import type {
  Collection,
  CollectionReference,
  OptionSelection,
  Product,
  ProductOption,
  ProductOptionValue,
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

const availabilityFromCode: Record<PublicAvailabilityCode, AvailabilityStatus> = {
  a: 'available',
  l: 'limited',
  o: 'out_of_stock',
  u: 'unavailable',
};

const limitFromCode: Record<PublicLimitCode, LineAvailability['limitReason']> = {
  i: 'inventory',
  q: 'quantity_rule',
  t: 'technical',
  u: 'unavailable',
};

export const parseProductOptionPurpose = (
  value: string | undefined
): ProductOption['purpose'] =>
  value === 'color' || value === 'size' ? value : undefined;

export const toPublicBuyBoxOptions = (
  optionIds: readonly string[],
  groups: ReadonlyArray<{
    id: string;
    name: string;
    purpose?: string;
    values: ReadonlyArray<{ id: string; label: string }>;
  }>
): ProductOption[] | null => {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const options: ProductOption[] = [];
  for (const id of optionIds) {
    const group = byId.get(id);
    if (!group?.name || !group.values.length) return null;
    if (group.values.some((value) => !value.id || !value.label)) return null;
    const purpose = parseProductOptionPurpose(group.purpose);
    options.push({
      id,
      name: group.name,
      ...(purpose ? { purpose } : {}),
      values: group.values.map((value) => ({ id: value.id, label: value.label })),
    });
  }
  return options;
};

export const expandCompactPublicBuyBoxVariant = (
  tuple: CompactPublicBuyBoxVariant,
  optionIds: readonly string[]
): PublicBuyBoxVariant => {
  const [
    id,
    optionValueIds,
    price,
    compareAtPrice,
    imageId,
    status,
    maxQuantity,
    minimum,
    increment,
    limitReason,
    backorder,
  ] = tuple;
  const projection: PublicBuyBoxVariant = {
    id,
    optionValues: optionIds.map((optionId, index) => ({
      optionId,
      valueId: optionValueIds[index] ?? '',
    })),
    price,
    availability: {
      status: availabilityFromCode[status],
      maxQuantity,
      minimum,
      increment,
      limitReason: limitFromCode[limitReason],
      ...(backorder === 1 ? { backorder: true as const } : {}),
    },
  };
  if (compareAtPrice !== null) projection.compareAtPrice = compareAtPrice;
  if (imageId !== null) projection.imageId = imageId;
  return projection;
};

export const expandCompactPublicBuyBoxPayload = (
  payload: CompactPublicBuyBoxPayload
): PublicBuyBoxVariant[] =>
  payload.v.map((tuple) => expandCompactPublicBuyBoxVariant(tuple, payload.o));

const isAvailabilityCode = (value: unknown): value is PublicAvailabilityCode =>
  value === 'a' || value === 'l' || value === 'o' || value === 'u';

const isLimitCode = (value: unknown): value is PublicLimitCode =>
  value === 'i' || value === 'q' || value === 't' || value === 'u';

export const parseCompactPublicBuyBoxPayload = (
  value: unknown
): CompactPublicBuyBoxPayload | null => {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<CompactPublicBuyBoxPayload>;
  if (
    typeof payload.c !== 'string' ||
    !Array.isArray(payload.o) ||
    payload.o.some((optionId) => typeof optionId !== 'string') ||
    !Array.isArray(payload.v) ||
    payload.v.length > 2_048
  ) {
    return null;
  }

  const variants: CompactPublicBuyBoxVariant[] = [];
  for (const tuple of payload.v) {
    if (!Array.isArray(tuple) || tuple.length !== 11) return null;
    const [
      id,
      optionValueIds,
      price,
      compareAtPrice,
      imageId,
      status,
      max,
      minimum,
      increment,
      limit,
      backorder,
    ] = tuple;
    if (
      typeof id !== 'string' ||
      !Array.isArray(optionValueIds) ||
      optionValueIds.length !== payload.o.length ||
      optionValueIds.some((item) => typeof item !== 'string') ||
      !Number.isSafeInteger(price) ||
      (compareAtPrice !== null && !Number.isSafeInteger(compareAtPrice)) ||
      (imageId !== null && typeof imageId !== 'string') ||
      !isAvailabilityCode(status) ||
      !Number.isSafeInteger(max) ||
      Number(max) < 0 ||
      !Number.isSafeInteger(minimum) ||
      Number(minimum) < 1 ||
      !Number.isSafeInteger(increment) ||
      Number(increment) < 1 ||
      !isLimitCode(limit) ||
      (backorder !== 0 && backorder !== 1)
    ) {
      return null;
    }
    variants.push([
      id as ProductVariant['id'],
      optionValueIds,
      Number(price),
      compareAtPrice === null ? null : Number(compareAtPrice),
      imageId === null ? null : imageId,
      status,
      Number(max),
      Number(minimum),
      Number(increment),
      limit,
      backorder,
    ]);
  }

  return { c: payload.c, o: [...payload.o], v: variants };
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

export const toCollectionReference = (
  collection: Pick<Collection, 'id' | 'handle' | 'title'>
): CollectionReference => ({
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

export const formatProductPriceLabel = (priceRange: PriceRange): string =>
  priceRange.min.amountMinor !== priceRange.max.amountMinor
    ? `Desde ${formatMoney(priceRange.min)}`
    : formatMoney(priceRange.min);

export const formatProductColorLabel = (colors: readonly ProductOptionValue[]): string =>
  colors.length === 1 ? colors[0].label : `${colors.length} colores`;

export const getSelectedOptionLabels = (
  product: Pick<Product, 'options'>,
  variant: Pick<ProductVariant, 'optionValues'>
): SelectedOptionLabel[] => product.options.flatMap((option) => {
  const selection = variant.optionValues.find((item) => item.optionId === option.id);
  const value = option.values.find((item) => item.id === selection?.valueId);
  return value ? [{ name: option.name, value: value.label }] : [];
});

export const toCartProduct = (
  product: Pick<Product, 'id' | 'handle' | 'title' | 'reference' | 'images' | 'primaryImageId'>,
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
