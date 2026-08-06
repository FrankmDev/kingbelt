import type {
  CollectionFacets,
  CollectionFacetValue,
  CollectionPriceRange,
  ProductSummary,
} from './catalog';

/**
 * Reglas de filtrado del catálogo, compartidas por build y navegador.
 *
 * El controlador cliente y cualquier futuro adaptador remoto consumen este
 * mismo contrato: la selección (`CatalogFilterSelection`), el predicado
 * (`matchesCatalogSelection`) y la serialización URL. Ningún componente
 * reimplementa el matching.
 */

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

/**
 * Contrato mínimo que el filtro necesita por producto. `ProductSummary` lo
 * satisface vía `toFilterableProduct`; el navegador lo reconstruye desde el
 * DOM una sola vez por tarjeta.
 */
export interface CatalogFilterable {
  productType: string;
  colors: readonly { label: string }[];
  /** Precio de entrada (`priceRange.min`), el mismo que muestra la tarjeta. */
  fromPriceMinor: number;
  purchasable: boolean;
}

/**
 * Rangos declarativos y disjuntos sobre el precio de entrada: el límite
 * inferior se incluye y el superior se excluye, de modo que cada producto
 * pertenece exactamente a un rango. La suma de sus contadores coincide
 * siempre con el total de la colección.
 */
export const COLLECTION_PRICE_RANGES: readonly CollectionPriceRange[] = [
  { id: 'lt-80', label: 'Menos de 80 €', maxMinor: 8_000 },
  { id: '80-90', label: '80 € – 90 €', minMinor: 8_000, maxMinor: 9_001 },
  { id: 'gt-90', label: 'Más de 90 €', minMinor: 9_001 },
];

export const matchesPriceRange = (fromPriceMinor: number, priceRangeId?: string): boolean => {
  if (!priceRangeId) return true;
  const range = COLLECTION_PRICE_RANGES.find((item) => item.id === priceRangeId);
  if (!range) return true;
  if (range.minMinor !== undefined && fromPriceMinor < range.minMinor) return false;
  if (range.maxMinor !== undefined && fromPriceMinor >= range.maxMinor) return false;
  return true;
};

export const matchesCatalogSelection = (
  product: CatalogFilterable,
  selection: CatalogFilterSelection
): boolean => {
  const types = new Set((selection.productTypes ?? []).map(normalizeFilterValue));
  const colors = new Set((selection.colors ?? []).map(normalizeFilterValue));
  if (types.size && !types.has(normalizeFilterValue(product.productType))) return false;
  if (
    colors.size &&
    !product.colors.some((color) => colors.has(normalizeFilterValue(color.label)))
  ) return false;
  if (!matchesPriceRange(product.fromPriceMinor, selection.priceRange)) return false;
  if (selection.availableOnly && !product.purchasable) return false;
  return true;
};

export const toFilterableProduct = (product: ProductSummary): CatalogFilterable => ({
  productType: product.productType,
  colors: product.colors,
  fromPriceMinor: product.priceRange.min.amountMinor,
  purchasable: product.purchasable,
});

export const filterProductSummaries = (
  products: readonly ProductSummary[],
  selection: CatalogFilterSelection
): ProductSummary[] =>
  products.filter((product) => matchesCatalogSelection(toFilterableProduct(product), selection));

/** Claves de query string que representan la selección en la URL. */
export const CATALOG_FILTER_PARAMS = {
  productTypes: 'tipo',
  colors: 'color',
  priceRange: 'precio',
  availableOnly: 'disponible',
} as const;

/** Valor del checkbox de faceta «solo disponibles» (formulario y facets). */
export const AVAILABLE_ONLY_FACET_VALUE = 'Disponibles';

/**
 * Lee una selección desde la URL. Los valores llegan normalizados (los
 * escribe `serializeCatalogFilterParams`); el formulario los contrasta con
 * sus opciones reales, de modo que un valor desconocido nunca entra en la
 * selección. Un id de rango inválido se descarta como «sin filtro».
 */
export const parseCatalogFilterParams = (
  search: string | URLSearchParams
): CatalogFilterSelection => {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const list = (key: string) => params.getAll(key).map(normalizeFilterValue).filter(Boolean);
  const priceRange = params.get(CATALOG_FILTER_PARAMS.priceRange) ?? undefined;
  return {
    productTypes: list(CATALOG_FILTER_PARAMS.productTypes),
    colors: list(CATALOG_FILTER_PARAMS.colors),
    priceRange: COLLECTION_PRICE_RANGES.some((range) => range.id === priceRange)
      ? priceRange
      : undefined,
    availableOnly: params.get(CATALOG_FILTER_PARAMS.availableOnly) === '1',
  };
};

export const serializeCatalogFilterParams = (
  selection: CatalogFilterSelection
): URLSearchParams => {
  const params = new URLSearchParams();
  selection.productTypes?.forEach((value) =>
    params.append(CATALOG_FILTER_PARAMS.productTypes, normalizeFilterValue(value)));
  selection.colors?.forEach((value) =>
    params.append(CATALOG_FILTER_PARAMS.colors, normalizeFilterValue(value)));
  if (selection.priceRange && COLLECTION_PRICE_RANGES.some((range) => range.id === selection.priceRange)) {
    params.set(CATALOG_FILTER_PARAMS.priceRange, selection.priceRange);
  }
  if (selection.availableOnly) params.set(CATALOG_FILTER_PARAMS.availableOnly, '1');
  return params;
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

/**
 * Facetas de una colección. Los contadores son potenciales por valor —los
 * resultados al aplicar solo ese valor dentro de la colección— y se calculan
 * con el mismo predicado que filtra, así que tipo y precio suman el total.
 */
export const getCollectionFacets = (
  products: readonly ProductSummary[]
): CollectionFacets => ({
  productTypes: countFacets(products.map((product) => ({ value: product.productType }))),
  colors: countFacets(products.flatMap((product) =>
    product.colors.map((color) => ({ value: color.label, swatch: color.swatch }))
  )),
  priceRanges: COLLECTION_PRICE_RANGES.map((range) => ({
    ...range,
    count: products.filter((product) =>
      matchesPriceRange(product.priceRange.min.amountMinor, range.id)).length,
  })),
  availability: [
    {
      value: AVAILABLE_ONLY_FACET_VALUE,
      count: products.filter((product) => product.purchasable).length,
    },
  ],
});
