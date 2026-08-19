import type { CatalogProvider } from '../../application/catalog-provider';
import { getCollectionFacets } from '../../domain/catalog-filters';
import { toCollectionReference, toProductSummary } from '../../domain/product-mappers';
import type { Collection, CollectionPage, Product, ProductSummary } from '../../domain/catalog';
import type { ShopifyCatalog } from './catalog-mappers';
import { createResourceCache } from './catalog-resource-cache';

export interface ShopifyCatalogQueries {
  getCollections(): Promise<Collection[]>;
  getCollectionHandles(): Promise<string[]>;
  getCollectionByHandle(handle: string): Promise<{
    collection: Collection;
    products: ProductSummary[];
  } | undefined>;
  getProductHandles(): Promise<string[]>;
  getProductByHandle(handle: string): Promise<Product | undefined>;
  getProductSummaries(): Promise<ProductSummary[]>;
  getFeaturedProducts(limit: number): Promise<ProductSummary[]>;
  getRelatedProducts(product: Product, limit: number): Promise<ProductSummary[]>;
}

export interface ShopifyCatalogAdapterOptions {
  /**
   * Tiempo máximo de cada recurso en memoria. `undefined` lo conserva hasta el
   * final del proceso (build). `0` vuelve a consultar en la siguiente petición
   * cuando no hay una carga en curso para esa misma clave.
   */
  cacheTtlMs?: number;
}

const isUsableLimit = (limit: number): boolean => Number.isInteger(limit) && limit >= 0;

/** Queries síncronas sobre un catálogo ya mapeado. Preflight y tests, no Storefront. */
export const createShopifyCatalogSnapshotQueries = (
  catalog: ShopifyCatalog
): ShopifyCatalogQueries => {
  const summaryFor = (product: Product): ProductSummary | undefined => {
    const collection = catalog.collections.find((item) => item.id === product.primaryCollectionId);
    return collection ? toProductSummary(product, toCollectionReference(collection)) : undefined;
  };

  return {
    async getCollections() {
      return [...catalog.collections];
    },
    async getCollectionHandles() {
      return catalog.collections.map((collection) => collection.handle);
    },
    async getCollectionByHandle(handle) {
      const collection = catalog.collections.find((item) => item.handle === handle);
      if (!collection) return undefined;
      return {
        collection,
        products: catalog.products
          .filter((product) => product.collectionIds.includes(collection.id))
          .flatMap((product) => summaryFor(product) ?? []),
      };
    },
    async getProductHandles() {
      return catalog.products.map((product) => product.handle);
    },
    async getProductByHandle(handle) {
      return catalog.products.find((product) => product.handle === handle);
    },
    async getProductSummaries() {
      return catalog.products.flatMap((product) => summaryFor(product) ?? []);
    },
    async getFeaturedProducts(limit) {
      if (!isUsableLimit(limit)) return [];
      return catalog.products
        .slice(0, limit)
        .flatMap((product) => summaryFor(product) ?? []);
    },
    async getRelatedProducts(product, limit) {
      if (!isUsableLimit(limit)) return [];
      return catalog.products
        .filter(
          (candidate) =>
            candidate.handle !== product.handle
            && candidate.collectionIds.some((collectionId) => product.collectionIds.includes(collectionId))
        )
        .slice(0, limit)
        .flatMap((candidate) => summaryFor(candidate) ?? []);
    },
  };
};

export const createShopifyCatalogAdapter = (
  queries: ShopifyCatalogQueries,
  options: ShopifyCatalogAdapterOptions = {}
): CatalogProvider => {
  const cache = createResourceCache(options.cacheTtlMs);

  const loadCollectionPage = async (
    handle: string
  ): Promise<CollectionPage | undefined> => {
    const result = await cache.load(`collection:${handle}`, () => queries.getCollectionByHandle(handle));
    if (!result) return undefined;
    return {
      collection: result.collection,
      products: result.products,
      facets: getCollectionFacets(result.products),
    };
  };

  return {
    async getCollections() {
      return [...(await cache.load('collections', () => queries.getCollections()))];
    },
    async getCollectionHandles() {
      const cachedCollections = cache.getFresh<Collection[]>('collections');
      if (cachedCollections.hit) {
        return cachedCollections.value.map((collection) => collection.handle);
      }
      return [...(await cache.load('collection-handles', () => queries.getCollectionHandles()))];
    },
    async getCollectionByHandle(handle) {
      return loadCollectionPage(handle);
    },
    async getProductHandles() {
      const cachedSummaries = cache.getFresh<ProductSummary[]>('product-summaries');
      if (cachedSummaries.hit) {
        return cachedSummaries.value.map((product) => product.handle);
      }
      return [...(await cache.load('product-handles', () => queries.getProductHandles()))];
    },
    async getProductByHandle(handle) {
      return cache.load(`product:${handle}`, () => queries.getProductByHandle(handle));
    },
    async getFeaturedProducts(limit) {
      if (!isUsableLimit(limit)) return [];
      if (limit === 0) return [];
      const cachedSummaries = cache.getFresh<ProductSummary[]>('product-summaries');
      if (cachedSummaries.hit) return cachedSummaries.value.slice(0, limit);
      return cache.load(`featured:${limit}`, () => queries.getFeaturedProducts(limit));
    },
    async getRelatedProducts(product, limit) {
      if (!isUsableLimit(limit)) return [];
      if (limit === 0) return [];
      return cache.load(`related:${product.handle}:${limit}`, () =>
        queries.getRelatedProducts(product, limit)
      );
    },
    async getProductSummaries() {
      return [...(await cache.load('product-summaries', () => queries.getProductSummaries()))];
    },
  };
};
