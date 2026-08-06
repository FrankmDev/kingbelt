import { demoCatalogAdapter } from './infrastructure/demo/demo-catalog-adapter';
import type { CatalogProvider } from './application/catalog-provider';

/** Frontera activa del catálogo. Shopify sustituirá solo esta implementación. */
export const catalogProvider: CatalogProvider = demoCatalogAdapter;
