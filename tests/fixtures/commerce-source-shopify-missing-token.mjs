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
const { getCatalogProvider } = await import('../../src/commerce/catalog.ts');
const catalogProvider = await getCatalogProvider('203.0.113.10');
await assert.rejects(() => catalogProvider.getProductHandles());
await assert.rejects(() => catalogProvider.getFeaturedProducts(4));

const { POST } = await import('../../src/pages/api/cart.ts');
const response = await POST({
  request: new Request('https://kingbelt.test/api/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://kingbelt.test',
    },
    body: JSON.stringify({ command: 'refresh' }),
  }),
  session: {
    get: async () => undefined,
    set() {},
    delete() {},
  },
  clientAddress: '203.0.113.10',
});
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { error: 'commerce_unavailable' });
