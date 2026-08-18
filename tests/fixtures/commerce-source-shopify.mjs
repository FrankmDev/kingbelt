import assert from 'node:assert/strict';
import { mock } from 'bun:test';

const fakeStoreDomain = 'example-test.myshopify.com';
mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'shopify' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: fakeStoreDomain,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-storefront-token',
  SHOPIFY_CART_COOKIE_SECRET: 'fake-test-cart-cookie-secret-000000000',
}));

const storage = {
  reads: 0,
  getItem() { this.reads += 1; return JSON.stringify({ version: 4, lines: [{ variantId: 'demo:line', quantity: 1 }] }); },
  setItem() { throw new Error('Shopify must not write demo storage'); },
  removeItem() { throw new Error('Shopify must not remove demo storage'); },
};
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage, addEventListener: () => undefined },
});

const { catalogProvider } = await import('../../src/commerce/catalog.ts');
const { cartProvider } = await import('../../src/commerce/cart.ts');
const { emptyCart } = await import('../../src/commerce/application/cart-service.ts');
const { POST } = await import('../../src/pages/api/cart.ts');
const { GET } = await import('../../src/pages/cart-catalog.json.ts');

const requests = [];
let cartStatus = 503;
globalThis.fetch = async (input) => {
  const url = String(input);
  requests.push(url);
  if (url === '/api/cart') {
    return new Response(JSON.stringify(
      cartStatus === 200 ? { success: true, cart: emptyCart() } : { error: 'commerce_unavailable' }
    ), { status: cartStatus });
  }
  if (url.startsWith(`https://${fakeStoreDomain}/`)) {
    return new Response(JSON.stringify({ error: 'fake provider unavailable' }), { status: 503 });
  }
  throw new Error(`unexpected request: ${url}`);
};

await assert.rejects(catalogProvider.getProductHandles(), (error) => error.kind === 'http' && error.status === 503);
await assert.rejects(cartProvider.initialize(), (error) => error.status === 503);
cartStatus = 502;
await assert.rejects(cartProvider.initialize(), (error) => error.status === 502);
cartStatus = 200;
assert.deepEqual((await cartProvider.initialize()).lines, []);
assert.equal(requests.some((url) => url.startsWith(`https://${fakeStoreDomain}/`)), true);
assert.equal(requests.filter((url) => url === '/api/cart').length, 3);
assert.equal(requests.includes('/cart-catalog.json'), false);
assert.equal(storage.reads, 0);

const cookies = { get: () => undefined, set: () => undefined, delete: () => undefined };
const cartResponse = await POST({
  request: new Request('https://kingbelt.test/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'refresh' }),
  }),
  cookies,
  clientAddress: '203.0.113.10',
});
assert.equal(cartResponse.status, 200);
assert.deepEqual((await cartResponse.json()).cart.lines, []);

const catalogResponse = await GET();
assert.equal(catalogResponse.status, 404);
assert.equal(await catalogResponse.text(), '');
