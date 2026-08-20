import { buildShopifyCheckoutHosts } from './application/checkout-redirect';
import { createShopifyCartService } from './infrastructure/shopify/shopify-cart';
import {
  createConfiguredShopifyBuyerStorefrontGateway,
  getConfiguredShopifyStorefrontConfig,
} from './infrastructure/shopify/storefront';

export const createConfiguredShopifyCartService = (buyerIp: string) => {
  const storefrontConfig = getConfiguredShopifyStorefrontConfig();
  return createShopifyCartService(
    createConfiguredShopifyBuyerStorefrontGateway(buyerIp),
    buildShopifyCheckoutHosts(storefrontConfig.storeDomain),
  );
};
