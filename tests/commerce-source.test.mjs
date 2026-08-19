import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const runFixture = (name) => spawnSync(process.execPath, [join(root, 'tests/fixtures', name)], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, COMMERCE_SOURCE: 'demo' },
});

describe('selección explícita de comercio', () => {
  test.each([
    ['demo sin credenciales Shopify', 'commerce-source-demo-no-credentials.mjs'],
    ['demo con credenciales Shopify', 'commerce-source-demo.mjs'],
    ['Shopify sin fallback ante 502/503', 'commerce-source-shopify.mjs'],
    ['Shopify sin dominio', 'commerce-source-shopify-missing-domain.mjs'],
    ['Shopify sin token privado', 'commerce-source-shopify-missing-token.mjs'],
    ['Shopify con dominio público inválido', 'commerce-source-shopify-invalid-domain.mjs'],
    ['valor inválido sin fallback a demo', 'commerce-source-invalid.mjs'],
    ['resolveCommerceSource rechaza valores arbitrarios', 'commerce-source-resolve.mjs'],
  ])('%s', (_label, fixture) => {
    const result = runFixture(fixture);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('test-private-storefront-token');
    if (
      fixture === 'commerce-source-shopify-missing-domain.mjs'
      || fixture === 'commerce-source-shopify-missing-token.mjs'
      || fixture === 'commerce-source-shopify-invalid-domain.mjs'
    ) {
      expect(result.stderr).toContain('shopify_configuration_error');
      expect(result.stderr).not.toContain('kingbelt.es');
    } else {
      expect(result.stderr).toBe('');
    }
  });
});
