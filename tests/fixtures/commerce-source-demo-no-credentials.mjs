import assert from 'node:assert/strict';
import { mock } from 'bun:test';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'demo' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: undefined,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: undefined,
  SHOPIFY_CART_COOKIE_SECRET: undefined,
}));

const { catalogProvider } = await import('../../src/commerce/catalog.ts');
const { cartProvider } = await import('../../src/commerce/cart.ts');
const { toCartCatalogSnapshot } = await import('../../src/commerce/application/cart-catalog.ts');
const { demoCollections, demoProducts } = await import('../../src/demo-catalog.ts');

const requests = [];
globalThis.fetch = async (input) => {
  requests.push(String(input));
  return new Response(JSON.stringify(toCartCatalogSnapshot(demoProducts, demoCollections)));
};

assert.deepEqual(await catalogProvider.getProductHandles(), demoProducts.map(({ handle }) => handle));
assert.deepEqual((await cartProvider.initialize()).lines, []);
assert.deepEqual(requests, ['/cart-catalog.json']);
