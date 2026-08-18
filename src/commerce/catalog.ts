import { selectCommerceProvider } from './commerce-source';
import { demoCatalogAdapter } from './infrastructure/demo/demo-catalog-adapter';
import { createShopifyCatalogAdapter } from './infrastructure/shopify/catalog-adapter';
import { loadConfiguredShopifyCatalog } from './infrastructure/shopify/catalog';
import type { CatalogProvider } from './application/catalog-provider';

/** Proveedor explícito: las credenciales validan Shopify, pero nunca lo seleccionan. */
export const catalogProvider: CatalogProvider = selectCommerceProvider({
  demo: () => demoCatalogAdapter,
  shopify: () => createShopifyCatalogAdapter(loadConfiguredShopifyCatalog, {
    cacheTtlMs: import.meta.env.DEV ? 0 : 30_000,
  }),
});
