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

const sourceFiles = walk(sourceRoot).filter((path) => /\.(?:astro|m?[jt]s)$/.test(path) && !path.endsWith('.d.ts'));
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
      'src/commerce/commerce-navigation',
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
      'kingbelt.primary_collection',
      'kingbelt.color_galleries',
    ];
    requiredProductMetafields.forEach((key) => {
      expect(readiness).toContain(`\`${key}\``);
    });
    expect(readiness).toContain('list.metaobject_reference');
    expect(readiness).toContain('collection_reference');
    expect(readiness).toContain('Type: Collection reference');
    expect(readiness).toContain('exactamente 3, ordenadas');
    expect(readiness).toContain('products with Color option');
    expect(readiness).toContain('variant.image');
    expect(readiness).not.toContain('imagen principal nativa compartida por las variantes');
    expect(readiness).not.toMatch(/si el archivo nombra|nombre de archivo contiene|detalles nativos inequívocos/);
    expect(readiness).toContain('Nunca se deben repartir imágenes por posición');
  });

  test('COMMERCE_SOURCE solo se interpreta en commerce-source.ts', () => {
    const envClientReaders = sourceFiles
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('COMMERCE_SOURCE') && source.includes('astro:env/client');
      })
      .map(sourcePath);
    expect(envClientReaders).toEqual(['src/commerce/commerce-source.ts']);

    const processEnvReaders = sourceFiles
      .filter((path) => /process\.env\.COMMERCE_SOURCE/.test(readFileSync(path, 'utf8')))
      .map(sourcePath);
    expect(processEnvReaders).toEqual([]);

    const vercelEnvUses = sourceFiles
      .filter((path) => /\bVERCEL_ENV\b/.test(readFileSync(path, 'utf8')))
      .map(sourcePath);
    expect(vercelEnvUses).toEqual([]);
  });

  test('la fuente de comercio no se infiere de Vercel, hostname ni tokens', () => {
    const source = readFileSync(join(sourceRoot, 'commerce/commerce-source.ts'), 'utf8');
    expect(source).not.toContain('VERCEL_ENV');
    expect(source).not.toContain('process.env');
    expect(source).not.toMatch(/location\.hostname|url\.hostname|VERCEL_URL/);
    expect(source).not.toContain('NODE_ENV');
    expect(source).not.toContain('STOREFRONT_PRIVATE_TOKEN');
    expect(source).toContain('resolveCommerceSource');
    expect(source).toContain('isShopifyCommerce');

    const catalog = readFileSync(join(sourceRoot, 'commerce/catalog.ts'), 'utf8');
    const cart = readFileSync(join(sourceRoot, 'commerce/cart.ts'), 'utf8');
    expect(catalog).toContain('selectCommerceProvider');
    expect(catalog).toContain("import('./infrastructure/demo/demo-catalog-adapter')");
    expect(catalog).toContain("import('./infrastructure/shopify/catalog-adapter')");
    expect(catalog).not.toMatch(/getConfiguredShopifyStorefrontConfig|getShopifyStorefrontConfig/);
    expect(cart).toContain('selectCommerceProvider');
    expect(cart).toContain("import('./infrastructure/shopify/shopify-cart-adapter')");
  });

  test('vercel.json no selecciona commerce ni contiene secretos', () => {
    const vercelText = readFileSync(join(root, 'vercel.json'), 'utf8');
    const vercelJson = JSON.parse(vercelText);
    expect(vercelText).not.toContain('COMMERCE_SOURCE');
    expect(vercelText).not.toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
    expect(vercelText).not.toContain('SHOPIFY_CART_COOKIE_SECRET');
    expect(vercelText).not.toContain('SHOPIFY_WEBHOOK_SECRET');
    expect(vercelText).not.toContain('VERCEL_DEPLOY_HOOK_URL');
    expect(vercelText).not.toMatch(/shpat_|shpca_|shpss_/);
    expect(vercelJson.build).toBeUndefined();
    expect(vercelJson.env).toBeUndefined();
    expect(Array.isArray(vercelJson.headers)).toBe(true);
  });

  test('el carrito Shopify persiste el Cart ID solo en la sesión server-side', () => {
    expect(existsSync(join(sourceRoot, 'commerce/infrastructure/shopify/cart-session.ts'))).toBe(false);
    const productionSources = [
      ...sourceFiles,
      join(root, 'astro.config.mjs'),
      join(root, '.env.example'),
    ];
    const leakedSecret = productionSources.filter((path) => {
      const text = readFileSync(path, 'utf8');
      return text.includes('SHOPIFY_CART_COOKIE_SECRET')
        || text.includes('signCartId')
        || text.includes('verifyCartCookie')
        || text.includes('SHOPIFY_CART_COOKIE_NAME');
    }).map(sourcePath);
    expect(leakedSecret).toEqual([]);

    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    expect(apiCart).toContain("session.get(SHOPIFY_CART_SESSION_KEY)");
    expect(apiCart).toContain("session.set(SHOPIFY_CART_SESSION_KEY, cartId)");
    expect(apiCart).not.toContain('cookies.set');
    expect(apiCart).not.toContain('cookies.get');

    const cartServer = readFileSync(join(sourceRoot, 'commerce/cart-server.ts'), 'utf8');
    expect(cartServer).not.toContain('session');
    expect(cartServer).not.toContain('unstorage');
    expect(cartServer).not.toContain('@upstash/redis');

    const architecture = readFileSync(join(root, 'docs/ARCHITECTURE.md'), 'utf8');
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    const security = readFileSync(join(root, 'docs/SECURITY.md'), 'utf8');
    expect(architecture).toContain('browser → opaque session cookie → Astro session store → Shopify cartId');
    expect(readiness).toContain('browser → opaque session cookie → Astro session store → Shopify cartId');
    expect(security).toContain('browser → opaque session cookie → Astro session store → Shopify cartId');
  });

  test('el navegador y el dominio Shopify no importan sesión, Redis ni persistencia', () => {
    const forbiddenImporters = [
      'src/components/',
      'src/scripts/',
      'src/commerce/cart.ts',
      'src/commerce/domain/',
      'src/commerce/application/',
      'src/commerce/infrastructure/shopify/',
    ];
    const forbiddenDependencies = [
      'src/session-driver',
      'unstorage',
      '@upstash/redis',
    ];
    const violations = localDependencies.filter(({ importer, dependency }) =>
      forbiddenImporters.some((prefix) => importer === prefix || importer.startsWith(prefix))
      && forbiddenDependencies.some((needle) =>
        dependency === needle
        || dependency.startsWith(`${needle}.`)
        || dependency.startsWith(`${needle}/`)
      )
    );
    expect(violations).toEqual([]);

    const shopifySources = sourceFiles.filter((path) =>
      sourcePath(path).startsWith('src/commerce/infrastructure/shopify/')
      || sourcePath(path).startsWith('src/commerce/domain/')
      || sourcePath(path).startsWith('src/commerce/application/')
    );
    const sessionCoupling = shopifySources.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return source.includes('session-driver')
        || source.includes('AstroSession')
        || source.includes('unstorage')
        || source.includes('@upstash/redis')
        || source.includes('session.get(')
        || source.includes('shopifyCartId');
    }).map(sourcePath);
    expect(sessionCoupling).toEqual([]);
  });

  test('el contexto de mercado Shopify tiene una única fuente autoritativa', () => {
    const configPath = 'src/commerce/infrastructure/shopify/config.ts';
    const config = readFileSync(join(root, configPath), 'utf8');
    expect(config).toContain('export const SHOPIFY_MARKET_CONTEXT');
    expect(config).toMatch(/country:\s*SHOPIFY_MARKET_COUNTRY/);
    expect(config).toMatch(/language:\s*SHOPIFY_MARKET_LANGUAGE/);
    expect(config).toMatch(/currency:\s*SHOPIFY_MARKET_CURRENCY/);
    expect(config).toContain("export const SHOPIFY_MARKET_COUNTRY = 'ES'");
    expect(config).toContain("export const SHOPIFY_MARKET_LANGUAGE = 'ES'");
    expect(config).toContain("export const SHOPIFY_MARKET_CURRENCY = 'EUR'");
    expect(config).not.toContain('SHOPIFY_COUNTRY');
    expect(config).not.toContain('process.env');

    const independentCountry = /countryCode:\s*['"]ES['"]|@inContext\(\s*country:\s*ES\b/;
    const independentCurrency = /\[[^\]]*'EUR'[^\]]*\]/;
    const commercialInfra = sourceFiles
      .map(sourcePath)
      .filter((path) =>
        path.startsWith('src/commerce/infrastructure/shopify/') && path !== configPath
      );
    const violations = [...commercialInfra, 'scripts/shopify-preflight.ts'].flatMap((path) => {
      const source = readFileSync(join(root, path), 'utf8');
      const hits = [];
      if (independentCountry.test(source)) hits.push(`${path}: country hardcoded`);
      if (independentCurrency.test(source)) hits.push(`${path}: EUR list hardcoded`);
      return hits;
    });
    expect(violations).toEqual([]);

    const catalogQuery = readFileSync(join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'), 'utf8');
    const cartService = readFileSync(join(sourceRoot, 'commerce/infrastructure/shopify/shopify-cart.ts'), 'utf8');
    const mapper = readFileSync(join(sourceRoot, 'commerce/infrastructure/shopify/catalog-mappers.ts'), 'utf8');
    expect(catalogQuery).toContain('withShopifyInContextVariables');
    expect(catalogQuery).toContain('SHOPIFY_IN_CONTEXT_DIRECTIVE');
    const runtimeQuery = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-runtime-query.ts'),
      'utf8'
    );
    expect(runtimeQuery).toContain('withShopifyInContextVariables');
    expect(runtimeQuery).toContain('SHOPIFY_IN_CONTEXT_DIRECTIVE');
    expect(cartService).toContain('shopifyCartBuyerIdentity');
    expect(cartService).toContain('SHOPIFY_MARKET_CONTEXT');
    expect(mapper).toContain('SHOPIFY_SUPPORTED_CURRENCIES');
  });

  test('el contexto de mercado no procede de hostname, Accept-Language ni geolocalización', () => {
    const scoped = [
      ...sourceFiles.map(sourcePath).filter((path) =>
        path.startsWith('src/commerce/infrastructure/shopify/')
        || path === 'src/pages/api/cart.ts'
        || path === 'src/commerce/catalog.ts'
        || path === 'src/commerce/cart.ts'
        || path === 'src/commerce/cart-server.ts'
      ),
      'scripts/shopify-preflight.ts',
    ];
    const forbidden = [
      'Accept-Language',
      'accept-language',
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-country',
      'geolocation',
      'geoip',
    ];
    const violations = scoped.flatMap((path) => {
      const source = readFileSync(join(root, path), 'utf8');
      return forbidden
        .filter((needle) => source.toLowerCase().includes(needle.toLowerCase()))
        .map((needle) => `${path}: ${needle}`);
    });
    expect(violations).toEqual([]);

    const config = readFileSync(join(sourceRoot, 'commerce/infrastructure/shopify/config.ts'), 'utf8');
    const marketStart = config.indexOf('export const SHOPIFY_MARKET_COUNTRY');
    const marketEnd = config.indexOf('export interface ShopifyStorefrontConfigInput');
    const marketBlock = config.slice(marketStart, marketEnd);
    expect(marketBlock.length).toBeGreaterThan(100);
    expect(marketBlock).not.toMatch(/hostname|Accept-Language|headers|buyerIp|geolocation|process\.env/i);
    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    expect(apiCart).not.toMatch(/countryCode|language|currency/);
    expect(apiCart).not.toMatch(/clientAddress.*country|country.*clientAddress/);
  });

  test('el mapper Shopify exige el SKU comercial y no fabrica uno técnico', () => {
    const mapper = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-mappers.ts'),
      'utf8'
    );
    const query = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'),
      'utf8'
    );
    const preflight = readFileSync(join(root, 'scripts/shopify-preflight.ts'), 'utf8');
    const catalogDomain = readFileSync(join(sourceRoot, 'commerce/domain/catalog.ts'), 'utf8');
    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    const syntheticSkuFn = /\b(?:generateSku|fallbackSku|syntheticSku|technicalSku)\b/;

    expect(mapper).toMatch(/sku\(\s*requiredText\(\s*variant\.sku/);
    expect(mapper).not.toMatch(/optionalText\(\s*variant\.sku\s*\)/);
    expect(mapper).not.toMatch(syntheticSkuFn);
    expect(query).toMatch(/\bsku\b/);
    expect(query).toContain('export const PRODUCT_SUMMARY_FIELDS');
    const summaryFields = query.match(/export const PRODUCT_SUMMARY_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(summaryFields).toContain('handle');
    expect(summaryFields).not.toMatch(/\bsku\b/);
    expect(preflight).toContain('mapShopifyCatalog');
    expect(preflight).toContain('assertValidCatalog');
    expect(preflight).not.toMatch(syntheticSkuFn);
    expect(preflight).not.toMatch(/variant\.sku\s*\?\.trim/);
    expect(catalogDomain).toMatch(/export interface ProductVariant \{[\s\S]*?\bsku:\s*Sku;/);
    const summary = catalogDomain.match(/export interface ProductSummary \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(summary).toContain('export interface ProductSummary');
    expect(summary).not.toMatch(/\bsku\b/);
    expect(apiCart).toContain('service.add(shopifyCartId, body.variantId, body.quantity)');
    expect(apiCart).not.toMatch(/body\.sku/);
  });

  test('Shopify deriva Product.mediaGroups solo desde kingbelt.color_galleries', () => {
    const mapper = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-mappers.ts'),
      'utf8'
    );
    const query = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'),
      'utf8'
    );
    const runtimeQuery = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-runtime-query.ts'),
      'utf8'
    );
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    const planDocs = walk(join(root, 'docs'))
      .filter((path) => path.endsWith('.md'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(query).toContain('key: "color_galleries"');
    expect(runtimeQuery).toContain('FULL_PRODUCT_FIELDS');
    expect(runtimeQuery).toContain('PRODUCT_SUMMARY_FIELDS');
    const summaryFields = query.match(/export const PRODUCT_SUMMARY_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(summaryFields).not.toContain('color_galleries');
    expect(mapper).toContain('mapRequiredColorGalleries');
    expect(mapper).toContain('list.metaobject_reference');
    expect(mapper).toContain('COLOR_GALLERY_IMAGE_COUNT');
    expect(mapper).not.toMatch(/::native-color::/);
    expect(mapper).not.toMatch(
      /FILENAME_COLOR_TOKEN_MIN|foldFilenameKey|filenameToken|tokensFromImageUrl|nativeDetailImageIdsByColor|mapNativeColorMediaGroups/
    );
    expect(mapper).not.toMatch(/new URL\([^)]*\)\.pathname/);
    expect(mapper).not.toMatch(/decodeURIComponent\(/);
    expect(readiness).toContain('kingbelt.color_galleries');
    expect(readiness).toContain('color_value');
    expect(planDocs).not.toMatch(/si el archivo nombra ese color|token de color|fallback nativo de galería/);
  });

  test('la colección principal Shopify no se deriva del orden de collections', () => {
    const stripComments = (source) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const mapper = stripComments(
      readFileSync(join(sourceRoot, 'commerce/infrastructure/shopify/catalog-mappers.ts'), 'utf8')
    );
    const query = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'),
      'utf8'
    );
    const runtimeQuery = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-runtime-query.ts'),
      'utf8'
    );
    const summaryFields = query.match(/export const PRODUCT_SUMMARY_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    const fullMetafields = query.match(/const FULL_PRODUCT_METAFIELDS = `([\s\S]*?)`;/)?.[1] ?? '';

    expect(mapper).toContain('PRIMARY_COLLECTION_KEY');
    expect(mapper).toContain("'primary_collection'");
    expect(mapper).toContain('collection_reference');
    expect(mapper).not.toMatch(/collections\.nodes\[0\]/);
    expect(mapper).not.toMatch(/primaryCollectionId\s*=\s*[\s\S]{0,120}\?\?/);
    expect(fullMetafields).toContain('key: "primary_collection"');
    expect(fullMetafields).toContain('COLLECTION_REFERENCE_SELECTION');
    expect(summaryFields).toContain('key: "primary_collection"');
    expect(summaryFields).toContain('COLLECTION_REFERENCE_SELECTION');
    expect(summaryFields).not.toMatch(/collections\(first:\s*1\)/);
    expect(query).toMatch(/\.\.\.\s*on Collection\s*\{\s*id handle title\s*\}/);
    expect(runtimeQuery).toContain('PRODUCT_SUMMARY_FIELDS');
    expect(runtimeQuery).toContain('FULL_PRODUCT_FIELDS');
  });

  test('el runtime de catálogo no descarga el catálogo Shopify completo', () => {
    const adapter = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-adapter.ts'),
      'utf8'
    );
    const runtime = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-runtime-query.ts'),
      'utf8'
    );
    const composition = readFileSync(join(sourceRoot, 'commerce/catalog.ts'), 'utf8');
    const preflight = readFileSync(join(root, 'scripts/shopify-preflight.ts'), 'utf8');
    const fullCatalogQuery = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'),
      'utf8'
    );

    expect(adapter).not.toContain('fetchShopifyCatalog');
    expect(adapter).not.toContain('loadConfiguredShopifyCatalog');
    expect(adapter).not.toContain('KingBeltCatalogPage');
    expect(runtime).not.toContain('fetchShopifyCatalog');
    expect(runtime).not.toContain('KingBeltCatalogPage');
    expect(runtime).toContain('product(handle:');
    expect(runtime).toContain('collection(handle:');
    expect(composition).not.toContain('fetchShopifyCatalog');
    expect(composition).not.toContain('loadConfiguredShopifyCatalog');
    expect(composition).toContain('createShopifyCatalogQueries');
    expect(fullCatalogQuery).toContain('export const fetchShopifyCatalog');
    expect(fullCatalogQuery).toContain('KingBeltCatalogPage');
    expect(preflight).toContain('fetchShopifyCatalog');
    expect(preflight).toContain('mapShopifyCatalog');
    expect(preflight).toContain('assertValidCatalog');
  });
});
