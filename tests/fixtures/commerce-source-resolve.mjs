import assert from 'node:assert/strict';
import { mock } from 'bun:test';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'demo' }));

const { resolveCommerceSource } = await import('../../src/commerce/commerce-source.ts');

assert.equal(resolveCommerceSource('demo'), 'demo');
assert.equal(resolveCommerceSource('shopify'), 'shopify');

for (const value of ['preview', 'production', '', 'SHOPIFY', true, undefined]) {
  assert.throws(() => resolveCommerceSource(value), /Invalid COMMERCE_SOURCE/);
}
