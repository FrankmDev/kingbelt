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
  options: readonly ProductOption[];
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

export const getSelectedColorValueId = (
  product: { readonly options: readonly ProductOption[] },
  selection: readonly OptionSelection[]
): string | undefined => {
  const colorOptions = product.options.filter((option) => option.purpose === 'color');
  if (colorOptions.length !== 1) return undefined;
  return selection.find((item) => item.optionId === colorOptions[0].id)?.valueId;
};

/** Conserva el valor recién cambiado y descarta selecciones incompatibles. */
export const reconcileSelectedOptions = (
  product: ProductSelectionShape,
  selection: readonly OptionSelection[],
  changedOptionId: string
): OptionSelection[] => {
  const changed = selection.find((option) => option.optionId === changedOptionId);
  if (!changed || !isValidSelection(product, [changed])) return [];

  const remaining = selection
    .filter((item) => item.optionId !== changedOptionId)
    .slice()
    .sort((left, right) => left.optionId.localeCompare(right.optionId));

  const reconciled: OptionSelection[] = [changed];
  remaining.forEach((selected) => {
    if (!isValidSelection(product, [selected])) return;
    if (product.variants.some((variant) => selectionMatches(variant, [...reconciled, selected]))) {
      reconciled.push(selected);
    }
  });

  const kept = new Map(reconciled.map((selected) => [selected.optionId, selected]));
  return product.options.flatMap((option) => {
    const selected = kept.get(option.id);
    return selected ? [selected] : [];
  });
};

export interface ProductBuyBoxSelectionState<TVariant extends VariantSelectionShape> {
  selection: OptionSelection[];
  selectedVariant: TVariant | undefined;
  colorValueId: string | undefined;
  compatibleValueIds: ReadonlyMap<string, readonly string[]>;
}

export const applyProductBuyBoxSelection = <TVariant extends VariantSelectionShape>(
  product: ProductSelectionShape<TVariant>,
  selection: readonly OptionSelection[],
  changedOptionId?: string
): ProductBuyBoxSelectionState<TVariant> => {
  const nextSelection = changedOptionId
    ? reconcileSelectedOptions(product, selection, changedOptionId)
    : [...selection];
  const compatibleValueIds = new Map(
    product.options.map((option) => [
      option.id,
      getCompatibleOptionValues(product, nextSelection, option.id),
    ])
  );

  return {
    selection: nextSelection,
    selectedVariant: getVariantBySelectedOptions(product, nextSelection),
    colorValueId: getSelectedColorValueId(product, nextSelection),
    compatibleValueIds,
  };
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
  variant: Pick<ProductVariant, 'salesStatus' | 'inventory' | 'inventoryPolicy' | 'quantityRule'> | undefined,
  hardLimit = MAX_CART_QUANTITY
): number => variant ? getVariantAvailability(variant, hardLimit).maxQuantity : 0;

export const countAvailableVariants = (product: Pick<Product, 'variants'>): number =>
  product.variants.filter(isVariantPurchasable).length;
