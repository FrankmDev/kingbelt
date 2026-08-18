import {
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  SHOPIFY_STORE_DOMAIN,
} from 'astro:env/server';
import { demoCatalogAdapter } from './infrastructure/demo/demo-catalog-adapter';
import { createShopifyCatalogAdapter } from './infrastructure/shopify/catalog-adapter';
import { loadConfiguredShopifyCatalog } from './infrastructure/shopify/catalog';
import type { CatalogProvider } from './application/catalog-provider';

const shopifyCatalogEnabled = Boolean(
  SHOPIFY_STORE_DOMAIN && SHOPIFY_STOREFRONT_PRIVATE_TOKEN
);

/** Con credenciales, el catálogo se consulta en SSR con una caché breve; sin ellas, demo. */
export const catalogProvider: CatalogProvider = shopifyCatalogEnabled
  ? createShopifyCatalogAdapter(loadConfiguredShopifyCatalog, {
      cacheTtlMs: import.meta.env.DEV ? 0 : 30_000,
    })
  : demoCatalogAdapter;
