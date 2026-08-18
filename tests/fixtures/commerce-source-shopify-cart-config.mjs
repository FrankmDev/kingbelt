import assert from 'node:assert/strict';
import { mock } from 'bun:test';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'shopify' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: 'example-test.myshopify.com',
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-storefront-token',
  SHOPIFY_CART_COOKIE_SECRET: undefined,
}));

const { POST } = await import('../../src/pages/api/cart.ts');
const response = await POST({
  request: new Request('https://kingbelt.test/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'refresh' }),
  }),
  cookies: {
    get: () => undefined,
    set: () => { throw new Error('must not set a cart cookie'); },
    delete: () => { throw new Error('must not delete a cart cookie'); },
  },
  clientAddress: '203.0.113.10',
});

assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { error: 'commerce_unavailable' });
