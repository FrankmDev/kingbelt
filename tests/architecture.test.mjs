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
  const imports = new Set();
  const pattern = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gs;
  const dynamicPattern = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(pattern)) imports.add(match[1]);
  for (const match of source.matchAll(dynamicPattern)) imports.add(match[1]);
  return [...imports];
};

const localDependencies = sourceFiles.flatMap((importer) => importsFor(importer)
  .map((specifier) => ({ importer: sourcePath(importer), dependency: resolveImport(importer, specifier) }))
  .filter(({ dependency }) => dependency));
const canonicalSourceByStem = new Map(sourceFiles.map((path) => [stripExt(sourcePath(path)), sourcePath(path)]));

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
    const roots = new Set([
      'src/commerce/catalog',
      'src/commerce/cart',
      'src/commerce/cart-server',
      'src/commerce/commerce-source',
    ]);
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
    const roots = new Set(['src/commerce/catalog', 'src/commerce/cart', 'src/commerce/cart-server']);
    const violations = localDependencies.filter(({ importer, dependency }) =>
      dependency.startsWith('src/commerce/infrastructure/') &&
      !importer.startsWith('src/commerce/infrastructure/') &&
      !roots.has(stripExt(importer))
    );
    expect(violations).toEqual([]);
  });

  test('el grafo local de módulos no contiene dependencias circulares', () => {
    const graph = new Map(sourceFiles.map((path) => [sourcePath(path), []]));
    localDependencies.forEach(({ importer, dependency }) => {
      const target = canonicalSourceByStem.get(stripExt(dependency));
      if (target) graph.get(importer)?.push(target);
    });

    const active = new Set();
    const visited = new Set();
    const cycles = [];
    const visit = (path, trail = []) => {
      if (active.has(path)) {
        cycles.push([...trail.slice(trail.indexOf(path)), path]);
        return;
      }
      if (visited.has(path)) return;
      active.add(path);
      (graph.get(path) ?? []).forEach((dependency) => visit(dependency, [...trail, path]));
      active.delete(path);
      visited.add(path);
    };
    graph.keys().forEach((path) => visit(path));
    expect(cycles).toEqual([]);
  });

  test('todo módulo de producción es alcanzable desde páginas o configuración', () => {
    const graph = new Map(sourceFiles.map((path) => [sourcePath(path), []]));
    localDependencies.forEach(({ importer, dependency }) => {
      const target = canonicalSourceByStem.get(stripExt(dependency));
      if (target) graph.get(importer)?.push(target);
    });

    const configPath = join(root, 'astro.config.mjs');
    const configRoots = importsFor(configPath)
      .map((specifier) => resolveImport(configPath, specifier))
      .map((dependency) => dependency && canonicalSourceByStem.get(stripExt(dependency)))
      .filter(Boolean);
    const roots = [
      ...sourceFiles.map(sourcePath).filter((path) => path.startsWith('src/pages/')),
      ...configRoots,
    ];
    const reachable = new Set();
    const visit = (path) => {
      if (reachable.has(path)) return;
      reachable.add(path);
      (graph.get(path) ?? []).forEach(visit);
    };
    roots.forEach(visit);

    const unreachable = sourceFiles.map(sourcePath).filter((path) => !reachable.has(path));
    expect(unreachable).toEqual([]);
  });

  test('el árbol actual no recupera el antiguo escaparate eliminado', () => {
    const legacyName = ['mus', 'eum'].join('');
    const auditedPaths = [
      ...sourceFiles,
      ...walk(join(root, 'docs')),
      ...walk(join(root, 'public')),
      ...walk(join(root, 'scripts')),
      ...walk(join(root, 'tests')),
      join(root, 'README.md'),
      join(root, 'astro.config.mjs'),
      join(root, 'package.json'),
    ];
    const violations = auditedPaths
      .filter((path) => {
        const normalizedPath = sourcePath(path).toLowerCase();
        const searchableContent = /\.(?:astro|css|html|js|json|md|mjs|svg|ts)$/.test(path)
          ? readFileSync(path, 'utf8').toLowerCase()
          : '';
        return normalizedPath.includes(legacyName) || searchableContent.includes(legacyName);
      })
      .map(sourcePath);
    expect(violations).toEqual([]);
  });

  test('el contrato Shopify fija un BFF same-origin sin secretos en el navegador', () => {
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    expect(readiness).toContain('CartProvider Shopify → /api/cart → servicio servidor → Storefront Cart API');
    expect(readiness).toContain('parte secreta del identificador de carrito Shopify no entra en HTML');
    expect(readiness).toContain('El servidor es autoridad para carrito remoto, precios, cantidades aceptadas, stock');
    expect(readiness).not.toMatch(/cliente con token público|decisión final del cliente de carrito/);
  });

  test('documenta el canal Headless y los scopes Storefront mínimos', () => {
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    expect(readiness).toContain('canal Headless');
    [
      'unauthenticated_read_product_listings',
      'unauthenticated_read_product_inventory',
      'unauthenticated_read_metaobjects',
      'unauthenticated_read_checkouts',
      'unauthenticated_write_checkouts',
    ].forEach((scope) => expect(readiness).toContain(scope));
  });

  test('documenta el contrato obligatorio de metafields e imágenes antes de importar', () => {
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    const requiredProductMetafields = [
      'kingbelt.model_reference',
      'kingbelt.summary',
      'kingbelt.material',
      'kingbelt.width_mm',
      'kingbelt.buckle_finish',
      'kingbelt.color_galleries',
    ];
    requiredProductMetafields.forEach((key) => {
      expect(readiness).toContain(`\`${key}\``);
    });
    expect(readiness).toContain('list.metaobject_reference');
    expect(readiness).toContain('exactamente 3, ordenadas');
    expect(readiness).toContain('imagen principal nativa compartida por las variantes');
    expect(readiness).toContain('Nunca se deben repartir imágenes por posición');
  });
});
