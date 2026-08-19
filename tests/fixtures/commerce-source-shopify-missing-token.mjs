import assert from 'node:assert/strict';
import { mock } from 'bun:test';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'shopify' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: 'example-test.myshopify.com',
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: undefined,
  SHOPIFY_WEBHOOK_SECRET: undefined,
  VERCEL_DEPLOY_HOOK_URL: undefined,
}));

globalThis.fetch = async () => { throw new Error('Storefront must not be called with invalid configuration'); };
const { catalogProvider } = await import('../../src/commerce/catalog.ts');
assert.deepEqual(await catalogProvider.getProductHandles(), []);
assert.deepEqual(await catalogProvider.getFeaturedProducts(4), []);

const { POST } = await import('../../src/pages/api/cart.ts');
const response = await POST({
  request: new Request('https://kingbelt.test/api/cart', {
    method: 'POST',
    body: JSON.stringify({ command: 'refresh' }),
  }),
  cookies: { get: () => undefined, set: () => undefined, delete: () => undefined },
  clientAddress: '203.0.113.10',
});
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { error: 'commerce_unavailable' });
