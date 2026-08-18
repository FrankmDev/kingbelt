import {
  SHOPIFY_API_VERSION,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  SHOPIFY_STORE_DOMAIN,
} from 'astro:env/server';
import {
  createShopifyStorefrontGateway,
  type ShopifyStorefrontGatewayOptions,
} from './storefront-gateway';
import { getShopifyStorefrontConfig } from './config';

/**
 * Frontera Astro de Storefront. Solo se alcanza cuando COMMERCE_SOURCE elige
 * Shopify. El BFF puede pasar `buyerIp`; catálogo y smoke no deben inventarla.
 */
export const getConfiguredShopifyStorefrontConfig = () =>
  getShopifyStorefrontConfig({
    storeDomain: SHOPIFY_STORE_DOMAIN,
    apiVersion: SHOPIFY_API_VERSION,
    storefrontToken: SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  });

export const createConfiguredShopifyStorefrontGateway = (
  options: ShopifyStorefrontGatewayOptions = {}
) =>
  createShopifyStorefrontGateway(getConfiguredShopifyStorefrontConfig(), options);
