import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, '..');
const sourceRoot = join(root, 'src');

const walk = (directory) => readdirSync(directory)
  .flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sourceFiles = walk(sourceRoot).filter((path) => /\.(?:astro|m?[jt]s)$/.test(path));
const sourcePath = (path) => relative(root, path).split(sep).join('/');
const stripExt = (path) => path.replace(/\.(?:astro|m?[jt]sx?)$/, '');

const aliases = new Map([
  ['@commerce/', 'src/commerce/'],
  ['@components/', 'src/components/'],
  ['@config/', 'src/config/'],
  ['@content/', 'src/content/'],
  ['@scripts/', 'src/scripts/'],
  ['@shared/', 'src/shared/'],
]);

const resolveImport = (importer, specifier) => {
  if (specifier === '@demo-catalog') return 'src/demo-catalog.ts';
  for (const [alias, target] of aliases) {
    if (specifier.startsWith(alias)) return `${target}${specifier.slice(alias.length)}`;
  }
  if (specifier.startsWith('.')) return sourcePath(resolve(dirname(importer), specifier));
  return null;
};

const importsFor = (path) => {
  const source = readFileSync(path, 'utf8');
  const imports = [];
  const pattern = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gs;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
};

const localDependencies = sourceFiles.flatMap((importer) => importsFor(importer)
  .map((specifier) => ({ importer: sourcePath(importer), dependency: resolveImport(importer, specifier) }))
  .filter(({ dependency }) => dependency));

describe('límites de arquitectura', () => {
  test('elimina contenedores ambiguos y barrels que oculten dependencias', () => {
    expect(existsSync(join(sourceRoot, 'lib'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'data'))).toBe(false);

    const hiddenIndexes = sourceFiles
      .map(sourcePath)
      .filter((path) => /\/index\.(?:m?[jt]s)$/.test(path) && !path.startsWith('src/pages/'));
    expect(hiddenIndexes).toEqual([]);
  });

  test('el dominio no depende de capas exteriores', () => {
    const violations = localDependencies.filter(({ importer, dependency }) =>
      importer.startsWith('src/commerce/domain/') &&
      !dependency.startsWith('src/commerce/domain/')
    );
    expect(violations).toEqual([]);
  });

  test('aplicación no depende de infraestructura ni presentación', () => {
    const allowed = ['src/commerce/application/', 'src/commerce/domain/', 'src/shared/'];
    const violations = localDependencies.filter(({ importer, dependency }) =>
      importer.startsWith('src/commerce/application/') &&
      !allowed.some((prefix) => dependency.startsWith(prefix))
    );
    expect(violations).toEqual([]);
  });

  test('componentes y scripts no conocen adaptadores ni fixtures', () => {
    const consumers = ['src/components/', 'src/scripts/'];
    const forbidden = ['src/commerce/infrastructure/', 'src/demo-catalog.ts'];
    const violations = localDependencies.filter(({ importer, dependency }) =>
      consumers.some((prefix) => importer.startsWith(prefix)) &&
      forbidden.some((prefix) => dependency.startsWith(prefix))
    );
    expect(violations).toEqual([]);
  });

  test('solo la infraestructura demo accede al catálogo de demostración', () => {
    const violations = localDependencies.filter(({ importer, dependency }) =>
      dependency === 'src/demo-catalog.ts' &&
      !importer.startsWith('src/commerce/infrastructure/demo/')
    );
    expect(violations).toEqual([]);
  });

  test('header no acopla el store del carrito en el bundle global', () => {
    const headerSource = readFileSync(join(sourceRoot, 'scripts/header.ts'), 'utf8');
    expect(headerSource.includes('cart-store')).toBe(false);
    expect(headerSource.includes('@shared/browser/cart-events')).toBe(true);
  });

  test('lazy-init-cart no importa el store en el arranque', () => {
    const lazySource = readFileSync(join(sourceRoot, 'scripts/commerce/lazy-init-cart.ts'), 'utf8');
    expect(/^import\s+[^;]*cart-store/m.test(lazySource)).toBe(false);
    expect(lazySource.includes('bootstrapCartClient')).toBe(true);
    expect(lazySource.includes("import('./cart-store')")).toBe(true);
  });

  test('el retorno de checkout no acopla el store ni la UI completa del carrito', () => {
    const returnScript = readFileSync(
      join(sourceRoot, 'scripts/commerce/checkout-return.ts'),
      'utf8'
    );
    expect(returnScript.includes('cart-store')).toBe(false);
    expect(returnScript.includes('cart-ui')).toBe(false);
    expect(returnScript.includes('cart-status')).toBe(true);
    expect(returnScript.includes('application/checkout-return')).toBe(true);
  });

  test('la presentación de comercio no consume campos de respuestas externas ni datos administrativos', () => {
    const commercePresentation = sourceFiles.filter((path) => {
      const normalized = sourcePath(path);
      return normalized.startsWith('src/components/product/') ||
        normalized.startsWith('src/components/collection/') ||
        normalized.startsWith('src/scripts/commerce/') ||
        normalized.startsWith('src/pages/productos/') ||
        normalized.startsWith('src/pages/categorias/');
    });
    const forbidden = /\b(?:quantityAvailable|currentlyNotInStock|availableForSale|compareAtPriceV2|priceV2|unitCost|adminCost|profitMargin)\b/;
    const violations = commercePresentation
      .filter((path) => forbidden.test(readFileSync(path, 'utf8')))
      .map(sourcePath);
    expect(violations).toEqual([]);
  });

  test('las rutas de páginas consumen comercio solo mediante composition roots o contratos', () => {
    const roots = new Set(['src/commerce/catalog', 'src/commerce/cart']);
    const allowed = ['src/commerce/application/', 'src/commerce/domain/'];
    const violations = localDependencies.filter(({ importer, dependency }) =>
      importer.startsWith('src/pages/') &&
      dependency.startsWith('src/commerce/') &&
      !roots.has(stripExt(dependency)) &&
      !allowed.some((prefix) => dependency.startsWith(prefix))
    );
    expect(violations).toEqual([]);
  });

  test('solo los composition roots eligen adaptadores de infraestructura', () => {
    const roots = new Set(['src/commerce/catalog', 'src/commerce/cart']);
    const violations = localDependencies.filter(({ importer, dependency }) =>
      dependency.startsWith('src/commerce/infrastructure/') &&
      !importer.startsWith('src/commerce/infrastructure/') &&
      !roots.has(stripExt(importer))
    );
    expect(violations).toEqual([]);
  });
});
