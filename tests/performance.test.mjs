import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dir, '..');
const distDir = join(root, 'dist');

describe('presupuestos de rendimiento', () => {
  test('el build cumple los límites de bundle y carga inicial', () => {
    if (!existsSync(distDir)) {
      const build = spawnSync('bun', ['run', 'build'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect(build.status).toBe(0);
    }

    const check = spawnSync('node', ['scripts/check-performance-budgets.mjs'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    if (check.status !== 0) {
      console.error(check.stdout);
      console.error(check.stderr);
    }

    expect(check.status).toBe(0);
  });
});
