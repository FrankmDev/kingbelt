import type { CatalogProvider } from '../../application/catalog-provider';
import { getCollectionFacets } from '../../domain/catalog-filters';
import { toCollectionReference, toProductSummary } from '../../domain/product-mappers';
import type { Product } from '../../domain/catalog';
import type { ShopifyCatalog } from './catalog-mappers';

export interface ShopifyCatalogAdapterOptions {
  /**
   * Tiempo máximo del catálogo en memoria. `undefined` lo conserva hasta el
   * final del proceso (build). `0` vuelve a consultar en la siguiente petición
   * cuando no hay una carga en curso.
   */
  cacheTtlMs?: number;
}

export const createShopifyCatalogAdapter = (
  loadCatalog: () => Promise<ShopifyCatalog>,
  options: ShopifyCatalogAdapterOptions = {}
): CatalogProvider => {
  const cacheTtlMs = options.cacheTtlMs;
  let catalog: ShopifyCatalog | undefined;
  let loadedAt = 0;
  let inflight: Promise<ShopifyCatalog> | undefined;

  const load = (): Promise<ShopifyCatalog> => {
    if (inflight) return inflight;
    const cached = catalog !== undefined && (
      cacheTtlMs === undefined || Date.now() - loadedAt < cacheTtlMs
    );
    if (cached && catalog) return Promise.resolve(catalog);

    inflight = loadCatalog()
      .then((next) => {
        catalog = next;
        loadedAt = Date.now();
        return next;
      })
      .catch((error: unknown) => {
        // Stale-if-error: con un catálogo válido previo, una caída puntual de
        // Shopify no convierte las páginas SSR en errores; la siguiente
        // petición reintenta la carga porque `loadedAt` no se renueva.
        if (catalog !== undefined) return catalog;
        throw error;
      })
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  };

  const summaryFor = (product: Product, catalog: ShopifyCatalog) => {
    const collection = catalog.collections.find((item) => item.id === product.primaryCollectionId);
    return collection ? toProductSummary(product, toCollectionReference(collection)) : undefined;
  };

  return {
    async getCollections() {
      return [...(await load()).collections];
    },
    async getCollectionHandles() {
      return (await load()).collections.map((collection) => collection.handle);
    },
    async getCollectionByHandle(handle) {
      const loaded = await load();
      const collection = loaded.collections.find((item) => item.handle === handle);
      if (!collection) return undefined;
      const products = loaded.products
        .filter((product) => product.collectionIds.includes(collection.id))
        .flatMap((product) => summaryFor(product, loaded) ?? []);
      return { collection, products, facets: getCollectionFacets(products) };
    },
    async getProductHandles() {
      return (await load()).products.map((product) => product.handle);
    },
    async getProductByHandle(handle) {
      return (await load()).products.find((product) => product.handle === handle);
    },
    async getFeaturedProducts(limit) {
      if (!Number.isInteger(limit) || limit < 0) return [];
      const loaded = await load();
      return loaded.products
        .slice(0, limit)
        .flatMap((product) => summaryFor(product, loaded) ?? []);
    },
    async getRelatedProducts(product, limit) {
      if (!Number.isInteger(limit) || limit < 0) return [];
      const loaded = await load();
      return loaded.products
        .filter(
          (candidate) =>
            candidate.handle !== product.handle &&
            candidate.collectionIds.some((collectionId) => product.collectionIds.includes(collectionId))
        )
        .slice(0, limit)
        .flatMap((candidate) => summaryFor(candidate, loaded) ?? []);
    },
  };
};
