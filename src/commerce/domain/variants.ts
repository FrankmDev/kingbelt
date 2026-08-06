import { getVariantAvailability, isVariantPurchasable, TECHNICAL_LINE_QUANTITY_LIMIT } from './inventory';
import type {
  OptionSelection,
  Product,
  ProductOption,
  ProductVariant,
} from './catalog';
import type { Money, PriceRange } from './money';

/** Límite técnico de una línea; nunca debe interpretarse como stock. */
export const MAX_CART_QUANTITY = TECHNICAL_LINE_QUANTITY_LIMIT;

interface VariantSelectionShape {
  optionValues: OptionSelection[];
}

interface ProductSelectionShape<TVariant extends VariantSelectionShape = VariantSelectionShape> {
  options: ProductOption[];
  variants: TVariant[];
}

const selectionMatches = (
  variant: VariantSelectionShape,
  selection: readonly OptionSelection[]
): boolean =>
  selection.every((selected) =>
    variant.optionValues.some(
      (option) => option.optionId === selected.optionId && option.valueId === selected.valueId
    )
  );

const isValidSelection = (
  product: ProductSelectionShape,
  selection: readonly OptionSelection[]
): boolean => {
  if (new Set(selection.map((item) => item.optionId)).size !== selection.length) return false;
  return selection.every((selected) => {
    const option = product.options.find((item) => item.id === selected.optionId);
    return option?.values.some((value) => value.id === selected.valueId) ?? false;
  });
};

export const getVariantBySelectedOptions = <TVariant extends VariantSelectionShape>(
  product: ProductSelectionShape<TVariant>,
  selection: readonly OptionSelection[]
): TVariant | undefined => {
  if (selection.length !== product.options.length || !isValidSelection(product, selection)) {
    return undefined;
  }
  return product.variants.find((variant) => selectionMatches(variant, selection));
};

export const getFirstAvailableVariant = (
  product: Pick<Product, 'variants'>
): ProductVariant | undefined => product.variants.find(isVariantPurchasable);

export const getCompatibleOptionValues = <TVariant extends VariantSelectionShape>(
  product: ProductSelectionShape<TVariant>,
  selection: readonly OptionSelection[],
  optionId: string,
  variantFilter?: (variant: TVariant) => boolean
): string[] => {
  const withoutCurrent = selection.filter((selected) => selected.optionId !== optionId);
  const values = new Set<string>();

  product.variants.forEach((variant) => {
    if (variantFilter && !variantFilter(variant)) return;
    if (!selectionMatches(variant, withoutCurrent)) return;
    const option = variant.optionValues.find((selected) => selected.optionId === optionId);
    if (option) values.add(option.valueId);
  });

  return product.options
    .find((option) => option.id === optionId)
    ?.values.map((value) => value.id)
    .filter((valueId) => values.has(valueId)) ?? [];
};

/** Conserva el valor recién cambiado y descarta selecciones incompatibles. */
export const reconcileSelectedOptions = (
  product: ProductSelectionShape,
  selection: readonly OptionSelection[],
  changedOptionId: string
): OptionSelection[] => {
  const changed = selection.find((option) => option.optionId === changedOptionId);
  if (!changed || !isValidSelection(product, [changed])) return [];

  const reconciled: OptionSelection[] = [changed];
  product.options.forEach((option) => {
    if (option.id === changedOptionId) return;
    const selected = selection.find((item) => item.optionId === option.id);
    if (!selected) return;
    if (product.variants.some((variant) => selectionMatches(variant, [...reconciled, selected]))) {
      reconciled.push(selected);
    }
  });

  return product.options
    .map((option) => reconciled.find((selected) => selected.optionId === option.id))
    .filter((selected): selected is OptionSelection => Boolean(selected));
};

export const calculatePriceRange = (
  variants: readonly ProductVariant[]
): PriceRange => {
  if (!variants.length) throw new TypeError('No se puede calcular el precio de un producto sin variantes.');

  const currency = variants[0].price.currency;
  if (variants.some((variant) => variant.price.currency !== currency)) {
    throw new TypeError('Todas las variantes de un producto deben compartir moneda.');
  }

  const amounts = variants.map((variant) => variant.price.amountMinor);
  const money = (amountMinor: number): Money => ({ amountMinor, currency });
  return { min: money(Math.min(...amounts)), max: money(Math.max(...amounts)) };
};

export const getMaxSelectableQuantity = (
  variant: Pick<ProductVariant, 'salesStatus' | 'inventory' | 'inventoryPolicy' | 'purchaseLimit'> | undefined,
  hardLimit = MAX_CART_QUANTITY
): number => variant ? getVariantAvailability(variant, hardLimit).maxQuantity : 0;

export const countAvailableVariants = (product: Pick<Product, 'variants'>): number =>
  product.variants.filter(isVariantPurchasable).length;
