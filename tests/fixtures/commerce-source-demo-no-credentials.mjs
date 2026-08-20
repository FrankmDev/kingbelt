import assert from 'node:assert/strict';
import { mock } from 'bun:test';

let storefrontGatewayCreated = false;
mock.module('../../src/commerce/infrastructure/shopify/storefront-gateway.ts', () => ({
  createShopifyStorefrontGateway() {
    storefrontGatewayCreated = true;
    throw new Error('demo must not instantiate the Storefront Gateway');
  },
}));
mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'demo' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: undefined,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: undefined,
  SHOPIFY_WEBHOOK_SECRET: undefined,
  VERCEL_DEPLOY_HOOK_URL: undefined,
}));

const { getCatalogProvider } = await import('../../src/commerce/catalog.ts');
const catalogProvider = await getCatalogProvider();
const { cartProvider } = await import('../../src/commerce/cart.ts');
const { toCartCatalogSnapshot } = await import('../../src/commerce/application/cart-catalog.ts');
const { demoCollections, demoProducts } = await import('../../src/demo-catalog.ts');
const { isDemoCommerce, isShopifyCommerce } = await import('../../src/commerce/commerce-source.ts');

const requests = [];
globalThis.fetch = async (input) => {
  requests.push(String(input));
  return new Response(JSON.stringify(toCartCatalogSnapshot(demoProducts, demoCollections)));
};

assert.equal(isDemoCommerce(), true);
assert.equal(isShopifyCommerce(), false);
assert.deepEqual(await catalogProvider.getProductHandles(), demoProducts.map(({ handle }) => handle));
assert.deepEqual((await cartProvider.initialize()).lines, []);
assert.deepEqual(requests, ['/cart-catalog.json']);
assert.equal(storefrontGatewayCreated, false);
assert.equal(requests.some((url) => url.includes('myshopify.com') || url.includes('/api/') && url.includes('graphql')), false);
