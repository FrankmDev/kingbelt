import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');

describe('BFF de carrito Shopify con sesión opaca', () => {
  test('persiste el Cart ID server-side y nunca lo expone al navegador', () => {
    const result = spawnSync(process.execPath, [join(root, 'tests/fixtures/shopify-cart-session.mjs')], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, COMMERCE_SOURCE: 'shopify' },
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
