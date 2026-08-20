import { selectCommerceProvider } from './commerce-source';
import type { CatalogProvider } from './application/catalog-provider';
import type { ResourceCache } from './infrastructure/shopify/catalog-resource-cache';

let shopifyCatalogCache: ResourceCache | undefined;

export const getCatalogProvider = async (
  buyerIp?: string
): Promise<CatalogProvider> =>
  selectCommerceProvider({
    demo: () =>
      import('./infrastructure/demo/demo-catalog-adapter').then((mod) => mod.demoCatalogAdapter),
    shopify: async () => {
      if (typeof buyerIp !== 'string' || buyerIp.length === 0) {
        throw new Error('Shopify catalog runtime requires a buyer IP from the request context.');
      }

      const [
        { createShopifyCatalogAdapter },
        { createShopifyCatalogQueries },
        { createConfiguredShopifyBuyerStorefrontGateway },
        { createResourceCache },
      ] = await Promise.all([
        import('./infrastructure/shopify/catalog-adapter'),
        import('./infrastructure/shopify/catalog-runtime-query'),
        import('./infrastructure/shopify/storefront'),
        import('./infrastructure/shopify/catalog-resource-cache'),
      ]);

      shopifyCatalogCache ??= createResourceCache(import.meta.env.DEV ? 0 : 30_000);

      return createShopifyCatalogAdapter(
        createShopifyCatalogQueries(() => createConfiguredShopifyBuyerStorefrontGateway(buyerIp)),
        { cache: shopifyCatalogCache }
      );
    },
  });
