import { selectCommerceProvider } from './commerce-source';
import type { CatalogProvider } from './application/catalog-provider';

/** Proveedor explícito: las credenciales validan Shopify, pero nunca lo seleccionan. */
export const catalogProvider: CatalogProvider = await selectCommerceProvider({
  demo: () =>
    import('./infrastructure/demo/demo-catalog-adapter').then((mod) => mod.demoCatalogAdapter),
  shopify: async () => {
    const [
      { createShopifyCatalogAdapter },
      { createShopifyCatalogQueries },
      { createConfiguredShopifyStorefrontGateway },
    ] = await Promise.all([
      import('./infrastructure/shopify/catalog-adapter'),
      import('./infrastructure/shopify/catalog-runtime-query'),
      import('./infrastructure/shopify/storefront'),
    ]);
    return createShopifyCatalogAdapter(
      createShopifyCatalogQueries(() => createConfiguredShopifyStorefrontGateway()),
      { cacheTtlMs: import.meta.env.DEV ? 0 : 30_000 }
    );
  },
});
