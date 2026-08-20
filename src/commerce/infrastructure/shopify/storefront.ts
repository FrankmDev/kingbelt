import {
  SHOPIFY_API_VERSION,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  SHOPIFY_STORE_DOMAIN,
} from 'astro:env/server';
import {
  createShopifyStorefrontGateway,
  type ShopifyStorefrontGatewayOptions,
} from './storefront-gateway';
import {
  getShopifyStorefrontConfig,
  reportShopifyConfigurationError,
  ShopifyConfigurationError,
} from './config';

/**
 * Frontera Astro de Storefront. Solo se alcanza cuando COMMERCE_SOURCE elige
 * Shopify. El tráfico runtime de comprador debe pasar `buyerIp`; preflight,
 * smoke y build lo omiten.
 */
export const getConfiguredShopifyStorefrontConfig = () => {
  try {
    return getShopifyStorefrontConfig({
      storeDomain: SHOPIFY_STORE_DOMAIN,
      apiVersion: SHOPIFY_API_VERSION,
      storefrontToken: SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    });
  } catch (error) {
    if (error instanceof ShopifyConfigurationError) {
      reportShopifyConfigurationError(error, {
        storeDomain: SHOPIFY_STORE_DOMAIN,
        hasStorefrontToken: Boolean(SHOPIFY_STOREFRONT_PRIVATE_TOKEN),
      });
    }
    throw error;
  }
};

export const createConfiguredShopifyStorefrontGateway = (
  options: ShopifyStorefrontGatewayOptions = {}
) =>
  createShopifyStorefrontGateway(getConfiguredShopifyStorefrontConfig(), options);

export const createConfiguredShopifyBuyerStorefrontGateway = (buyerIp: string) =>
  createConfiguredShopifyStorefrontGateway({ buyerIp });
