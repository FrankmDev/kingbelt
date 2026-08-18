import assert from 'node:assert/strict';
import { mock } from 'bun:test';

const fakeStoreDomain = 'example-test.myshopify.com';
mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'demo' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: fakeStoreDomain,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-storefront-token',
  SHOPIFY_CART_COOKIE_SECRET: 'fake-test-cart-cookie-secret-000000000',
}));

const { catalogProvider } = await import('../../src/commerce/catalog.ts');
const { cartProvider } = await import('../../src/commerce/cart.ts');
const { toCartCatalogSnapshot } = await import('../../src/commerce/application/cart-catalog.ts');
const { demoCollections, demoProducts } = await import('../../src/demo-catalog.ts');
const { POST } = await import('../../src/pages/api/cart.ts');
const { GET } = await import('../../src/pages/cart-catalog.json.ts');

const requests = [];
globalThis.fetch = async (input) => {
  requests.push(String(input));
  if (String(input) === '/cart-catalog.json') {
    return new Response(JSON.stringify(toCartCatalogSnapshot(demoProducts, demoCollections)));
  }
  throw new Error(`unexpected request: ${String(input)}`);
};

assert.deepEqual(await catalogProvider.getProductHandles(), demoProducts.map(({ handle }) => handle));
assert.deepEqual((await cartProvider.initialize()).lines, []);
assert.deepEqual(requests, ['/cart-catalog.json']);
assert.equal(requests.some((url) => url.includes(fakeStoreDomain) || url === '/api/cart'), false);

const cookies = { get: () => undefined, set: () => undefined, delete: () => undefined };
const cartResponse = await POST({
  request: new Request('https://kingbelt.test/api/cart', { method: 'POST' }),
  cookies,
  clientAddress: '203.0.113.10',
});
assert.equal(cartResponse.status, 404);
assert.deepEqual(await cartResponse.json(), { error: 'not_found' });

const catalogResponse = await GET();
assert.equal(catalogResponse.status, 200);
assert.equal((await catalogResponse.json()).products.length, demoProducts.length);
