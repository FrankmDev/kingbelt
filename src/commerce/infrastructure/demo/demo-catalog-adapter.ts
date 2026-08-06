import {
  demoCollections,
  demoFeaturedProductHandles,
  demoProducts,
} from '@demo-catalog';
import { publicSecurityConfig } from '@config/security';
import { getCollectionFacets } from '../../domain/catalog-filters';
import { assertValidCatalog } from '../../application/catalog-validation';
import { toCollectionReference, toProductSummary } from '../../domain/product-mappers';
import type { CartCatalog, CartCatalogVariant } from '../../application/cart-service';
import type { CatalogProvider } from '../../application/catalog-provider';
import type {
  Collection,
  Product,
  ProductVariant,
} from '../../domain/catalog';

interface DemoCatalogSource {
  products: readonly Product[];
  collections: readonly Collection[];
  featuredHandles?: readonly string[];
}

const createIndexes = (source: DemoCatalogSource) => {
  const productsByHandle = new Map(source.products.map((product) => [product.handle, product]));
  const collectionsById = new Map(source.collections.map((collection) => [collection.id, collection]));
  const productsByLegacyId = new Map(
    source.products.map((product) => [product.reference.toLocaleLowerCase('es'), product])
  );
  const variantsById = new Map<string, CartCatalogVariant>();
  source.products.forEach((product) => {
    const collection = collectionsById.get(product.primaryCollectionId);
    if (!collection) return;
    const primaryCollection = toCollectionReference(collection);
    product.variants.forEach((variant) => variantsById.set(variant.id, {
      product,
      variant,
      primaryCollection,
    }));
  });
  return { productsByHandle, collectionsById, productsByLegacyId, variantsById };
};

const activeSource: DemoCatalogSource = {
  products: demoProducts,
  collections: demoCollections,
  featuredHandles: demoFeaturedProductHandles,
};
assertValidCatalog(
  activeSource.products,
  activeSource.collections,
  ['EUR'],
  publicSecurityConfig.remoteImageHosts
);
const activeIndexes = createIndexes(activeSource);

const getDemoVariant = (variantId: string): CartCatalogVariant | undefined =>
  activeIndexes.variantsById.get(variantId);

const resolveDemoLegacyVariant = (
  productId: string,
  color: string,
  size: string
): ProductVariant | undefined => {
  const product = activeIndexes.productsByLegacyId.get(productId.toLocaleLowerCase('es'));
  if (!product) return undefined;
  const matches = product.variants.filter((variant) =>
    variant.optionValues.some((selection) => {
      const option = product.options.find((item) => item.id === selection.optionId);
      const value = option?.values.find((item) => item.id === selection.valueId);
      return option?.purpose === 'color' && value?.label === color;
    }) &&
    variant.optionValues.some((selection) => {
      const option = product.options.find((item) => item.id === selection.optionId);
      const value = option?.values.find((item) => item.id === selection.valueId);
      return option?.purpose === 'size' && value?.label === size;
    })
  );
  return matches.length === 1 ? matches[0] : undefined;
};

export const createDemoCatalogAdapter = (
  source: DemoCatalogSource = activeSource
): CatalogProvider => {
  if (source !== activeSource) {
    assertValidCatalog(
      source.products,
      source.collections,
      ['EUR'],
      publicSecurityConfig.remoteImageHosts
    );
  }
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
        .filter((product) => product.collectionIds.includes(collection.id))
        .flatMap((product) => {
          const primary = indexes.collectionsById.get(product.primaryCollectionId);
          return primary ? [toProductSummary(product, toCollectionReference(primary))] : [];
        });
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
        .filter((product): product is Product => Boolean(product))
        .slice(0, limit)
        .flatMap((product) => {
          const primary = indexes.collectionsById.get(product.primaryCollectionId);
          return primary ? [toProductSummary(product, toCollectionReference(primary))] : [];
        });
    },
    async getRelatedProducts(product, limit) {
      if (!Number.isInteger(limit) || limit < 0) return [];
      return source.products
        .filter(
          (candidate) =>
            candidate.handle !== product.handle &&
            candidate.collectionIds.some((collectionId) => product.collectionIds.includes(collectionId))
        )
        .slice(0, limit)
        .flatMap((candidate) => {
          const primary = indexes.collectionsById.get(candidate.primaryCollectionId);
          return primary ? [toProductSummary(candidate, toCollectionReference(primary))] : [];
        });
    },
  };
};

export const demoCatalogAdapter = createDemoCatalogAdapter();

export const demoCartCatalog: CartCatalog = {
  getVariant: getDemoVariant,
  resolveLegacyVariant: resolveDemoLegacyVariant,
};
