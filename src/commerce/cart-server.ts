import { buildShopifyCheckoutHosts } from './application/checkout-redirect';
import { createShopifyCartService } from './infrastructure/shopify/shopify-cart';
import {
  createConfiguredShopifyStorefrontGateway,
  getConfiguredShopifyStorefrontConfig,
} from './infrastructure/shopify/storefront';

export const createConfiguredShopifyCartService = (buyerIp?: string) => {
  const storefrontConfig = getConfiguredShopifyStorefrontConfig();
  return createShopifyCartService(
    createConfiguredShopifyStorefrontGateway({ buyerIp }),
    buildShopifyCheckoutHosts(storefrontConfig.storeDomain),
  );
};
