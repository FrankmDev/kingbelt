import type {
  CommerceProduct,
  Money,
  PriceRange,
  ProductImage,
  ProductVariant,
  SelectedOption,
} from './types';

export const MAX_CART_QUANTITY = 99;

interface VariantSelectionShape {
  selectedOptions: SelectedOption[];
  availableForSale: boolean;
}

interface ProductSelectionShape<TVariant extends VariantSelectionShape = VariantSelectionShape> {
  options: CommerceProduct['options'];
  variants: TVariant[];
}

const selectionMatches = (
  variant: VariantSelectionShape,
  selection: readonly SelectedOption[]
): boolean =>
  selection.every((selected) =>
    variant.selectedOptions.some(
      (option) => option.name === selected.name && option.value === selected.value
    )
  );

export const getVariantBySelectedOptions = <TVariant extends VariantSelectionShape>(
  product: ProductSelectionShape<TVariant>,
  selection: readonly SelectedOption[]
): TVariant | undefined => {
  if (selection.length !== product.options.length) return undefined;
  return product.variants.find((variant) => selectionMatches(variant, selection));
};

export const getFirstAvailableVariant = (
  product: Pick<CommerceProduct, 'variants'>
): ProductVariant | undefined => product.variants.find((variant) => variant.availableForSale);

export const getCompatibleOptionValues = (
  product: ProductSelectionShape,
  selection: readonly SelectedOption[],
  optionName: string,
  availableOnly = false
): string[] => {
  const withoutCurrent = selection.filter((selected) => selected.name !== optionName);
  const values = new Set<string>();

  product.variants.forEach((variant) => {
    if (availableOnly && !variant.availableForSale) return;
    if (!selectionMatches(variant, withoutCurrent)) return;
    const option = variant.selectedOptions.find((selected) => selected.name === optionName);
    if (option) values.add(option.value);
  });

  return product.options
    .find((option) => option.name === optionName)
    ?.values.map((value) => value.value)
    .filter((value) => values.has(value)) ?? [];
};

export const isOptionValueSelectable = (
  product: ProductSelectionShape,
  selection: readonly SelectedOption[],
  optionName: string,
  optionValue: string
): boolean =>
  getCompatibleOptionValues(product, selection, optionName).includes(optionValue);

/** Conserva el valor recién cambiado y descarta selecciones incompatibles. */
export const reconcileSelectedOptions = (
  product: ProductSelectionShape,
  selection: readonly SelectedOption[],
  changedOptionName: string
): SelectedOption[] => {
  const changed = selection.find((option) => option.name === changedOptionName);
  if (!changed) return [...selection];

  const reconciled: SelectedOption[] = [changed];
  product.options.forEach((option) => {
    if (option.name === changedOptionName) return;
    const selected = selection.find((item) => item.name === option.name);
    if (!selected) return;
    if (product.variants.some((variant) => selectionMatches(variant, [...reconciled, selected]))) {
      reconciled.push(selected);
    }
  });

  return product.options
    .map((option) => reconciled.find((selected) => selected.name === option.name))
    .filter((selected): selected is SelectedOption => Boolean(selected));
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

export const getVariantImage = (
  variant: ProductVariant | undefined,
  product: Pick<CommerceProduct, 'primaryImage'>
): ProductImage | undefined => variant?.image ?? product.primaryImage;

export const getMaxSelectableQuantity = (
  variant: ProductVariant | undefined,
  hardLimit = MAX_CART_QUANTITY
): number => {
  if (!variant?.availableForSale) return 0;
  if (variant.quantityAvailable === undefined) return hardLimit;
  return Math.max(0, Math.min(variant.quantityAvailable, hardLimit));
};

export const countAvailableVariants = (product: Pick<CommerceProduct, 'variants'>): number =>
  product.variants.filter((variant) => variant.availableForSale).length;
