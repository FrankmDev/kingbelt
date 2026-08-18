import { buildShopifyCheckoutHosts } from './application/checkout-redirect';
import { SHOPIFY_CART_COOKIE_NAME, signCartId, verifyCartCookie } from './infrastructure/shopify/cart-session';
import { createShopifyCartService } from './infrastructure/shopify/shopify-cart';
import { createConfiguredShopifyStorefrontGateway, isShopifyStorefrontConfigured } from './infrastructure/shopify/storefront';
import { SHOPIFY_CART_COOKIE_SECRET, SHOPIFY_STORE_DOMAIN } from 'astro:env/server';

export { SHOPIFY_CART_COOKIE_NAME, signCartId, verifyCartCookie };

export const shopifyCartConfigured = (): boolean => Boolean(
  isShopifyStorefrontConfigured() && SHOPIFY_CART_COOKIE_SECRET && SHOPIFY_CART_COOKIE_SECRET.length >= 32
);

export const createConfiguredShopifyCartService = (buyerIp?: string) => {
  if (!shopifyCartConfigured() || !SHOPIFY_STORE_DOMAIN) throw new Error('shopify_cart_not_configured');
  return createShopifyCartService(
    createConfiguredShopifyStorefrontGateway({ buyerIp }),
    buildShopifyCheckoutHosts(SHOPIFY_STORE_DOMAIN),
  );
};

export const getShopifyCartCookieSecret = (): string => SHOPIFY_CART_COOKIE_SECRET ?? '';
