import { buildShopifyCheckoutHosts } from './application/checkout-redirect';
import { SHOPIFY_CART_COOKIE_NAME, signCartId, verifyCartCookie } from './infrastructure/shopify/cart-session';
import { createShopifyCartService } from './infrastructure/shopify/shopify-cart';
import {
  createConfiguredShopifyStorefrontGateway,
  getConfiguredShopifyStorefrontConfig,
} from './infrastructure/shopify/storefront';
import { ShopifyConfigurationError } from './infrastructure/shopify/config';
import { SHOPIFY_CART_COOKIE_SECRET } from 'astro:env/server';

export { SHOPIFY_CART_COOKIE_NAME, signCartId, verifyCartCookie };

export const createConfiguredShopifyCartService = (buyerIp?: string) => {
  const storefrontConfig = getConfiguredShopifyStorefrontConfig();
  getShopifyCartCookieSecret();
  return createShopifyCartService(
    createConfiguredShopifyStorefrontGateway({ buyerIp }),
    buildShopifyCheckoutHosts(storefrontConfig.storeDomain),
  );
};

export const getShopifyCartCookieSecret = (): string => {
  if (!SHOPIFY_CART_COOKIE_SECRET || SHOPIFY_CART_COOKIE_SECRET.length < 32) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_CART_COOKIE_SECRET must contain at least 32 characters to use the Shopify cart.'
    );
  }
  return SHOPIFY_CART_COOKIE_SECRET;
};
