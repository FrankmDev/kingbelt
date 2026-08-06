import { localCatalogProvider } from './local-catalog';
import type { CatalogProvider } from './types';

/** Frontera activa del catálogo. Shopify sustituirá solo esta implementación. */
export const catalogProvider: CatalogProvider = localCatalogProvider;
