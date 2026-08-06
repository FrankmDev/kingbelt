import type {
  CollectionFacets,
  CollectionFacetValue,
  CommerceProductSummary,
} from './types';

export const normalizeFilterValue = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export interface CatalogFilterSelection {
  productTypes?: readonly string[];
  colors?: readonly string[];
  priceRange?: string;
  availableOnly?: boolean;
}

export const COLLECTION_PRICE_RANGES = [
  { id: 'lt-80', label: 'Menos de 80 €' },
  { id: '80-90', label: '80 € – 90 €' },
  { id: 'gt-90', label: 'Más de 90 €' },
] as const;

const matchesPrice = (product: CommerceProductSummary, priceRange?: string): boolean => {
  if (!priceRange) return true;
  const min = product.priceRange.min.amountMinor;
  const max = product.priceRange.max.amountMinor;
  if (priceRange === 'lt-80') return min < 8_000;
  if (priceRange === '80-90') return max >= 8_000 && min <= 9_000;
  if (priceRange === 'gt-90') return max > 9_000;
  return true;
};

export const filterProductSummaries = (
  products: readonly CommerceProductSummary[],
  selection: CatalogFilterSelection
): CommerceProductSummary[] => {
  const types = new Set((selection.productTypes ?? []).map(normalizeFilterValue));
  const colors = new Set((selection.colors ?? []).map(normalizeFilterValue));

  return products.filter((product) => {
    if (types.size && !types.has(normalizeFilterValue(product.productType))) return false;
    if (
      colors.size &&
      !product.colors.some((color) => colors.has(normalizeFilterValue(color.value)))
    ) return false;
    if (!matchesPrice(product, selection.priceRange)) return false;
    if (selection.availableOnly && !product.availableForSale) return false;
    return true;
  });
};

const countFacets = (
  values: readonly { value: string; swatch?: string }[]
): CollectionFacetValue[] => {
  const counts = new Map<string, CollectionFacetValue>();
  values.forEach(({ value, swatch }) => {
    const key = normalizeFilterValue(value);
    const current = counts.get(key);
    counts.set(key, { value: current?.value ?? value, count: (current?.count ?? 0) + 1, swatch });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
};

export const getCollectionFacets = (
  products: readonly CommerceProductSummary[]
): CollectionFacets => ({
  productTypes: countFacets(products.map((product) => ({ value: product.productType }))),
  colors: countFacets(products.flatMap((product) => product.colors)),
  priceRanges: [...COLLECTION_PRICE_RANGES],
  availability: [
    {
      value: 'available',
      count: products.filter((product) => product.availableForSale).length,
    },
  ],
});
