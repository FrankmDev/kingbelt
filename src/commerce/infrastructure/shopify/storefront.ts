import {
  SHOPIFY_API_VERSION,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  SHOPIFY_STORE_DOMAIN,
} from 'astro:env/server';
import {
  createShopifyStorefrontGateway,
  type ShopifyStorefrontGatewayOptions,
} from './storefront-gateway';

/**
 * Frontera Astro de Storefront. El composition root de catálogo la usa cuando
 * existen credenciales. El BFF futuro puede pasar `buyerIp`; el build y el
 * smoke no deben inventar una.
 */
export const createConfiguredShopifyStorefrontGateway = (
  options: ShopifyStorefrontGatewayOptions = {}
) =>
  createShopifyStorefrontGateway({
    storeDomain: SHOPIFY_STORE_DOMAIN,
    apiVersion: SHOPIFY_API_VERSION,
    storefrontToken: SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  }, options);

export const isShopifyStorefrontConfigured = (): boolean => Boolean(
  SHOPIFY_STORE_DOMAIN && SHOPIFY_STOREFRONT_PRIVATE_TOKEN
);
