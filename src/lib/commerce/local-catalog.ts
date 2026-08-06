import {
  localCollections,
  localFeaturedProductHandles,
  localProducts,
} from '../../data/catalog';
import { getCollectionFacets } from './catalog-filters';
import { toProductSummary } from './product-mapper';
import type {
  CatalogProvider,
  CommerceCollection,
  CommerceProduct,
  ProductVariant,
} from './types';

export interface LocalVariantRecord {
  product: CommerceProduct;
  variant: ProductVariant;
}

interface LocalCatalogSource {
  products: readonly CommerceProduct[];
  collections: readonly CommerceCollection[];
  featuredHandles?: readonly string[];
}

const createIndexes = (source: LocalCatalogSource) => {
  const productsByHandle = new Map(source.products.map((product) => [product.handle, product]));
  const productsByLegacyId = new Map(
    source.products.map((product) => [product.reference.toLocaleLowerCase('es'), product])
  );
  const variantsById = new Map<string, LocalVariantRecord>();
  source.products.forEach((product) => {
    product.variants.forEach((variant) => variantsById.set(variant.id, { product, variant }));
  });
  return { productsByHandle, productsByLegacyId, variantsById };
};

const activeSource: LocalCatalogSource = {
  products: localProducts,
  collections: localCollections,
  featuredHandles: localFeaturedProductHandles,
};
const activeIndexes = createIndexes(activeSource);

export const getLocalVariant = (variantId: string): LocalVariantRecord | undefined =>
  activeIndexes.variantsById.get(variantId);

export const resolveLegacyVariant = (
  productId: string,
  color: string,
  size: string
): ProductVariant | undefined => {
  const product = activeIndexes.productsByLegacyId.get(productId.toLocaleLowerCase('es'));
  if (!product) return undefined;
  const matches = product.variants.filter((variant) =>
    variant.selectedOptions.some((option) => option.name === 'Color' && option.value === color) &&
    variant.selectedOptions.some((option) => option.name === 'Talla' && option.value === size)
  );
  return matches.length === 1 ? matches[0] : undefined;
};

export const createLocalCatalogProvider = (
  source: LocalCatalogSource = activeSource
): CatalogProvider => {
  const indexes = source === activeSource ? activeIndexes : createIndexes(source);

  return {
    async getCollections() {
      return [...source.collections];
    },
    async getCollectionHandles() {
      return source.collections.map((collection) => collection.handle);
    },
    async getCollectionByHandle(handle) {
      const collection = source.collections.find((item) => item.handle === handle);
      if (!collection) return undefined;
      const products = source.products
        .filter((product) => product.collections.some((item) => item.handle === handle))
        .map(toProductSummary);
      return { collection, products, facets: getCollectionFacets(products) };
    },
    async getProductHandles() {
      return source.products.map((product) => product.handle);
    },
    async getProductByHandle(handle) {
      return indexes.productsByHandle.get(handle);
    },
    async getFeaturedProducts(limit) {
      if (!Number.isInteger(limit) || limit < 0) return [];
      return (source.featuredHandles ?? [])
        .map((handle) => indexes.productsByHandle.get(handle))
        .filter((product): product is CommerceProduct => Boolean(product))
        .slice(0, limit)
        .map(toProductSummary);
    },
    async getRelatedProducts(product, limit) {
      if (!Number.isInteger(limit) || limit < 0) return [];
      return source.products
        .filter(
          (candidate) =>
            candidate.handle !== product.handle &&
            candidate.collections.some((collection) =>
              product.collections.some((current) => current.id === collection.id)
            )
        )
        .slice(0, limit)
        .map(toProductSummary);
    },
  };
};

export const localCatalogProvider = createLocalCatalogProvider();
