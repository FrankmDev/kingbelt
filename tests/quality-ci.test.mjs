import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const workflowPath = join(root, '.github/workflows/quality.yml');
const packagePath = join(root, 'package.json');

const SHA_PINNED_ACTION = /uses:\s*(?:actions\/(?:checkout|setup-node)|oven-sh\/setup-bun)@[a-f0-9]{40}/g;
const FORBIDDEN_QUALITY_ENV = [
  'SHOPIFY_STOREFRONT_PRIVATE_TOKEN',
  'SHOPIFY_CATALOG_WEBHOOK_SECRET',
  'SHOPIFY_WEBHOOK_SECRET',
  'SHOPIFY_CART_COOKIE_SECRET',
  'VERCEL_DEPLOY_HOOK_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];
const VALIDATE_STEPS = [
  'bun run audit:dependencies',
  'bun run security:scan:history',
  'bun run check',
  'bun run build',
  'bun run test',
  'bun run security:scan',
  'bun run check:links',
  'bun run check:perf',
  'bun run check:scale',
];

describe('contrato de CI quality', () => {
  test('existe el workflow de calidad y describe un job no autenticado', () => {
    expect(existsSync(workflowPath)).toBe(true);

    const source = readFileSync(workflowPath, 'utf8');

    expect(source).toMatch(/^name:\s*Quality\s*$/m);
    expect(source).toMatch(/\bpull_request\s*:/);
    expect(source).toMatch(/\bworkflow_dispatch\s*:/);
    expect(source).toMatch(/\bpush\s*:/);
    expect(source).toMatch(/\bmain\b/);
    expect(source).toMatch(/\bcontents:\s*read\b/);
    expect(source).not.toMatch(/\bcontents:\s*write\b/);
    expect(source).not.toMatch(/\bpull-requests:\s*write\b/);
    expect(source).not.toMatch(/\bactions:\s*write\b/);
    expect(source).not.toMatch(/\bpackages:\s*write\b/);
    expect(source).not.toMatch(/\bid-token:\s*write\b/);
    expect(source).toMatch(/\bcancel-in-progress:\s*true\b/);
    expect(source).toContain('github.ref');
    expect(source).toMatch(/\bruns-on:\s*ubuntu-latest\b/);
    expect(source).toMatch(/\bCOMMERCE_SOURCE:\s*demo\b/);
    expect(source).toMatch(/\bfetch-depth:\s*0\b/);
    expect(source).toMatch(/\bpersist-credentials:\s*false\b/);
    expect(source).toMatch(/\bbun-version:\s*["']1\.3\.14["']/);
    expect(source).toMatch(/\bnode-version:\s*["']22["']/);
    expect(source).toContain('bun install --frozen-lockfile');
    expect(source).toContain('bun run validate');

    const actionPins = source.match(SHA_PINNED_ACTION) ?? [];
    expect(actionPins.some((pin) => pin.includes('actions/checkout@'))).toBe(true);
    expect(actionPins.some((pin) => pin.includes('oven-sh/setup-bun@'))).toBe(true);
    expect(actionPins.some((pin) => pin.includes('actions/setup-node@'))).toBe(true);

    FORBIDDEN_QUALITY_ENV.forEach((name) => expect(source).not.toContain(name));
  });

  test('el workflow de PR no oculta fallos ni depende de Shopify', () => {
    const source = readFileSync(workflowPath, 'utf8');

    expect(source).not.toContain('continue-on-error');
    expect(source).not.toContain('|| true');
    expect(source).not.toContain('shopify:smoke');
    expect(source).not.toContain('shopify:cart-smoke');
    expect(source).not.toContain('shopify:release-gate');
    expect(source).not.toContain('shopify:preflight');
    expect(source).not.toContain('session:preflight');
    expect(source).not.toContain('launch:preflight');
    expect(source).not.toMatch(/\$\{\{\s*secrets\./);
    expect(source).not.toMatch(/\b(?:shpat|shpca|shpss)_[A-Za-z0-9]{20,}\b/);
  });

  test('validate es la suite autoritativa y no reinstala dependencias', () => {
    const { scripts, packageManager } = JSON.parse(readFileSync(packagePath, 'utf8'));

    expect(packageManager).toBe('bun@1.3.14');
    expect(scripts.validate.split(/\s*&&\s*/)).toEqual(VALIDATE_STEPS);
    expect(scripts.validate).not.toContain('bun install');
    expect(scripts.validate).not.toContain('shopify:smoke');
    expect(scripts.validate).not.toContain('shopify:cart-smoke');
    expect(scripts.validate).not.toContain('shopify:release-gate');
    expect(scripts.validate).not.toContain('shopify:preflight');
    expect(scripts.validate).not.toContain('session:preflight');
    expect(scripts.validate).not.toContain('launch:preflight');
    expect(scripts['shopify:preflight']).toBe('bun scripts/shopify-preflight.mjs');
    expect(scripts['shopify:cart-smoke']).toBe('bun scripts/shopify-cart-smoke.mjs');
    expect(scripts['shopify:release-gate']).toBe('bun scripts/shopify-release-gate.mjs');
    expect(scripts['session:preflight']).toBe('bun scripts/session-preflight.mjs');
    expect(scripts['launch:preflight']).toBe('bun run session:preflight && bun run shopify:preflight');
    expect(scripts.validate).not.toContain('|| true');
    expect(scripts['audit:dependencies']).toBe('bun audit');
    expect(scripts['security:scan:history']).toContain('--history');
  });

  test('la validación de calidad puede ejecutarse desde un checkout limpio en modo demo', () => {
    const scale = readFileSync(join(root, 'scripts/check-scale-product.mjs'), 'utf8');
    const historyScan = readFileSync(join(root, 'scripts/security-audit.mjs'), 'utf8');
    const validate = JSON.parse(readFileSync(packagePath, 'utf8')).scripts.validate;

    expect(scale).toContain("COMMERCE_SOURCE: 'demo'");
    expect(scale).not.toMatch(/\/Users\/|\/home\/[^/]+/);
    expect(historyScan).toContain('--is-shallow-repository');
    expect(historyScan).toContain('fetch-depth: 0');
    expect(historyScan).not.toContain('session:preflight');
    expect(validate).not.toMatch(/\/Users\/|\/home\/[^/]+/);
    expect(validate).not.toContain('shopify:smoke');
    expect(validate).not.toContain('shopify:cart-smoke');
    expect(validate).not.toContain('shopify:release-gate');
    expect(validate).not.toContain('shopify:preflight');
    expect(validate).not.toContain('session:preflight');
  });
});
