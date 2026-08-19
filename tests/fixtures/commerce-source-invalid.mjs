import assert from 'node:assert/strict';
import { mock } from 'bun:test';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'preview' }));

await assert.rejects(
  () => import('../../src/commerce/commerce-source.ts'),
  (error) =>
    error instanceof Error &&
    error.message.includes('Invalid COMMERCE_SOURCE') &&
    error.message.includes('"demo"') &&
    error.message.includes('"shopify"')
);
