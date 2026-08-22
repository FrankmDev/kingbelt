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

  test('BaseLayout es el único propietario del landmark main', () => {
    const astroFilesWithMain = sourceFiles
      .filter((path) => path.endsWith('.astro'))
      .filter((path) => /<main\b/.test(readFileSync(path, 'utf8')))
      .map(sourcePath);
    expect(astroFilesWithMain).toEqual(['src/layouts/BaseLayout.astro']);
  });

  test('la producción no interpreta un query param como confirmación de compra', () => {
    const forbiddenSignals = [
      'kb_checkout',
      'CHECKOUT_RETURN_COMPLETED',
      'CHECKOUT_RETURN_CANCELLED',
      'CHECKOUT_RETURN_PARAM',
      'parseCheckoutReturn',
      'getCheckoutReturnNotice',
      'CheckoutReturnKind',
    ];
    const forbiddenCopy = [
      'gracias por tu compra',
      'has vuelto del checkout',
    ];
    const forbiddenImports = /commerce\/checkout-return/;
    const violations = sourceFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const lower = source.toLowerCase();
      const hits = [
        ...forbiddenSignals.filter((needle) => source.includes(needle)),
        ...forbiddenCopy.filter((needle) => lower.includes(needle)),
      ];
      if (forbiddenImports.test(source)) hits.push('commerce/checkout-return');
      return hits.map((hit) => `${sourcePath(path)}: ${hit}`);
    });
    expect(violations).toEqual([]);
    expect(existsSync(join(sourceRoot, 'commerce/application/checkout-return.ts'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'scripts/commerce/checkout-return.ts'))).toBe(false);

    const cartPage = readFileSync(join(sourceRoot, 'pages/carrito.astro'), 'utf8');
    expect(cartPage).toContain('data-cart-page-status');
    expect(cartPage).not.toMatch(/location\.search|kb_checkout|checkout-return/);

    const architecture = readFileSync(join(root, 'docs/ARCHITECTURE.md'), 'utf8');
    expect(architecture).toContain('Astro no renderiza una confirmación post-pago');
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
    const security = readFileSync(join(root, 'docs/SECURITY.md'), 'utf8');
    expect(readiness).toContain('canal Headless');
    expect(readiness).toContain('Sales channels → Headless');
    [
      'unauthenticated_read_product_listings',
      'unauthenticated_read_checkouts',
      'unauthenticated_write_checkouts',
    ].forEach((scope) => {
      expect(readiness).toContain(scope);
      expect(security).toContain(scope);
    });
    expect(readiness).toContain('unauthenticated_read_product_inventory');
    expect(security).toContain('unauthenticated_read_product_inventory');
    expect(readiness).toContain('solo es necesario si se activa inventario exacto');
    expect(security).toContain('solo es necesario si se activa inventario exacto');
    expect(readiness).toContain('SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES');
    expect(readiness).toContain('SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES');
    expect(readiness).not.toContain('SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES');
    expect(security).not.toContain('SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES');
  });

  test('documenta el contrato de metafields e imágenes nativas antes de importar', () => {
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    const requiredProductMetafields = [
      'kingbelt.model_reference',
      'kingbelt.summary',
      'kingbelt.material',
      'kingbelt.width_mm',
      'kingbelt.buckle_finish',
      'custom.kingbelt_primary_collection',
    ];
    requiredProductMetafields.forEach((key) => {
      expect(readiness).toContain(`\`${key}\``);
    });
    expect(readiness).not.toContain('kingbelt.primary_collection');
    expect(readiness).toContain('collection_reference');
    expect(readiness).toContain('Read / PUBLIC_READ');
    expect(readiness).toContain('Type: collection_reference');
    expect(readiness).toContain('Required: yes for every published KingBelt product');
    expect(readiness).toContain('Fallback: none');
    expect(readiness).not.toMatch(/si el producto está en más de una colección/);
    expect(readiness).not.toMatch(/la única colección publicada/);
    expect(readiness).toContain('exactamente tres imágenes únicas');
    expect(readiness).toContain('MODELO_COLOR_01');
    expect(readiness).toContain('ProductVariant.image');
    expect(readiness).toContain('debe corresponder a esa portada');
    expect(readiness).not.toContain('no necesita coincidir');
    expect(readiness).toContain('familia nativa');
    expect(readiness).toContain('no reparte `Product.images` por posición');
    expect(readiness).toContain('nunca copia media de otro producto');
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
    expect(vercelEnvUses).toEqual(['src/shared/seo/deployment.ts']);
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
      return text.includes('signCartId')
        || text.includes('verifyCartCookie')
        || text.includes('SHOPIFY_CART_COOKIE_NAME');
    }).map(sourcePath);
    expect(leakedSecret).toEqual([]);

    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    expect(apiCart).toContain("session.get(SHOPIFY_CART_SESSION_KEY)");
    expect(apiCart).toContain("session.set(SHOPIFY_CART_SESSION_KEY, cartId)");
    expect(apiCart).toContain('SHOPIFY_CART_SESSION_KEY = \'shopifyCartId\'');
    expect(apiCart).not.toContain('cookies.set');
    expect(apiCart).not.toContain('cookies.get');
    expect(apiCart).not.toContain('unstorage');
    expect(apiCart).not.toContain('@upstash/redis');
    expect(apiCart).not.toContain('session-driver');
    expect(apiCart).not.toContain('session-storage-config');
    expect(apiCart).not.toContain('Redis.fromEnv');

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

    const sessionData = readFileSync(join(sourceRoot, 'env.d.ts'), 'utf8');
    expect(sessionData).toContain('shopifyCartId: string');
    expect(sessionData).not.toContain('checkoutUrl');
    expect(sessionData).not.toContain('buyerIp');
    expect(sessionData).not.toContain('customer');
    expect(existsSync(join(sourceRoot, 'pages/api/session-health.ts'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/api/redis-health.ts'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/api/upstash.ts'))).toBe(false);
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
      'src/session-storage-config',
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
        || source.includes('session-storage-config')
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
    expect(cartService).toContain('withShopifyCartInContextVariables');
    expect(cartService).toContain('SHOPIFY_CART_IN_CONTEXT_DIRECTIVE');
    expect(cartService).not.toContain('withShopifyInContextVariables');
    expect(cartService).not.toContain('SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS');
    const cartMapper = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/shopify-cart-mappers.ts'),
      'utf8'
    );
    expect(cartMapper).toContain('SHOPIFY_MARKET_CONTEXT');
    expect(cartMapper).toContain('assertShopifyCartMarket');
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

  test('el preflight exige SKU comercial y el runtime usa un identificador técnico estable', () => {
    const mapper = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-mappers.ts'),
      'utf8'
    );
    const query = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-query.ts'),
      'utf8'
    );
    const preflight = readFileSync(join(root, 'scripts/shopify-preflight.ts'), 'utf8');
    const runtimeQuery = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-runtime-query.ts'),
      'utf8'
    );
    const catalogDomain = readFileSync(join(sourceRoot, 'commerce/domain/catalog.ts'), 'utf8');
    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    expect(mapper).toContain('requireCommercialSku');
    expect(mapper).toMatch(/optionalText\(variant\.sku\)/);
    expect(mapper).toContain('runtimeTechnicalSku(mappedVariantId)');
    expect(runtimeQuery).toContain('requireCommercialSku: false');
    expect(query).toMatch(/\bsku\b/);
    expect(query).toContain('export const PRODUCT_SUMMARY_FIELDS');
    const summaryFields = query.match(/export const PRODUCT_SUMMARY_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(summaryFields).toContain('handle');
    expect(summaryFields).not.toMatch(/\bsku\b/);
    expect(preflight).toContain('mapShopifyCatalog');
    expect(preflight).toContain('assertValidCatalog');
    expect(preflight).not.toContain('requireCommercialSku: false');
    expect(preflight).not.toMatch(/variant\.sku\s*\?\.trim/);
    expect(catalogDomain).toMatch(/export interface ProductVariant \{[\s\S]*?\bsku:\s*Sku;/);
    const summary = catalogDomain.match(/export interface ProductSummary \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(summary).toContain('export interface ProductSummary');
    expect(summary).not.toMatch(/\bsku\b/);
    expect(apiCart).toContain('service.add(shopifyCartId, body.variantId, body.quantity)');
    expect(apiCart).not.toMatch(/body\.sku/);
  });

  test('Shopify usa Product.images como única autoridad de galerías', () => {
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

    expect(query).not.toContain('kingbelt_color_galleries');
    expect(query).not.toContain('... on Metaobject');
    expect(runtimeQuery).toContain('FULL_PRODUCT_FIELDS');
    expect(runtimeQuery).toContain('PRODUCT_SUMMARY_FIELDS');
    const summaryFields = query.match(/export const PRODUCT_SUMMARY_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(summaryFields).not.toContain('color_galleries');
    expect(mapper).toContain('mapNativeColorGroups');
    expect(mapper).not.toContain('SHOPIFY_COLOR_GALLERIES_METAFIELD');
    expect(mapper).toContain('COLOR_GALLERY_IMAGE_COUNT');
    expect(mapper).not.toMatch(/::native-color::/);
    expect(mapper).toContain('imageFamilyNamesColor');
    expect(mapper).not.toContain('rebalanceColorGalleries');
    expect(mapper).not.toContain('requireCompleteColorGalleries');
    expect(mapper).not.toContain('firstVariantImageByColor');
    expect(mapper).not.toMatch(/expectedColorImageId\s*\?\?\s*actualImageId/);
    expect(runtimeQuery).not.toContain('requireCompleteColorGalleries');
    expect(runtimeQuery).toContain('requireCommercialSku: false');
    expect(mapper).not.toMatch(/new URL\([^)]*\)\.pathname/);
    expect(mapper).toMatch(/decodeURIComponent\(/);
    expect(readiness).toContain('MODELO_COLOR_01');
    expect(readiness).toContain('Product.images');
    expect(planDocs).toContain('Product.images');
    expect(planDocs).toContain('Nunca se distribuyen imágenes por posición global');
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
    const config = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/config.ts'),
      'utf8'
    );

    expect(mapper).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD');
    expect(mapper).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER');
    expect(mapper).not.toContain('PRIMARY_COLLECTION_KEY');
    expect(mapper).not.toMatch(/namespace === 'kingbelt'[\s\S]{0,80}primary_collection/);
    expect(config).toContain("namespace: 'custom'");
    expect(config).toContain("key: 'kingbelt_primary_collection'");
    expect(config).toContain("type: 'collection_reference'");
    expect(mapper).not.toMatch(/collections\.nodes\[0\]/);
    expect(mapper).not.toMatch(/primaryCollectionId\s*=\s*[\s\S]{0,120}\?\?/);
    expect(fullMetafields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace');
    expect(fullMetafields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key');
    expect(fullMetafields).not.toContain('key: "primary_collection"');
    expect(fullMetafields).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(fullMetafields).not.toContain('kingbelt_color_galleries');
    expect(fullMetafields).not.toContain('namespace: "kingbelt", key: "color_galleries"');
    expect(fullMetafields).toContain('COLLECTION_REFERENCE_SELECTION');
    expect(summaryFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace');
    expect(summaryFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key');
    expect(summaryFields).not.toContain('key: "primary_collection"');
    expect(summaryFields).toContain('COLLECTION_REFERENCE_SELECTION');
    expect(summaryFields).toMatch(/collections\s*\(first:\s*\$\{SHOPIFY_PAGE_SIZE\}\)/);
    expect(summaryFields).toContain('nodes { id handle title }');
    expect(query).toMatch(/\.\.\.\s*on Collection\s*\{\s*id handle title\s*\}/);
    expect(runtimeQuery).toContain('PRODUCT_SUMMARY_FIELDS');
    expect(runtimeQuery).toContain('FULL_PRODUCT_FIELDS');

    const cartFields = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/shopify-cart.ts'),
      'utf8'
    ).match(/const CART_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(cartFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace');
    expect(cartFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key');
    expect(cartFields).not.toContain('key: "primary_collection"');
    expect(cartFields).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(cartFields).not.toMatch(/collections\s*\(/);
    expect(cartFields).not.toContain('featuredImage');
    expect(cartFields).toMatch(/image\s*\{\s*\$\{IMAGE_FIELDS\}\s*\}/);
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
    expect(runtime).not.toContain('tryMapSummary');
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

  test('el catálogo SSR Shopify viaja con Buyer IP del request y sin cabeceras de proxy', () => {
    const composition = readFileSync(join(sourceRoot, 'commerce/catalog.ts'), 'utf8');
    const adapter = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-adapter.ts'),
      'utf8'
    );
    const cache = readFileSync(
      join(sourceRoot, 'commerce/infrastructure/shopify/catalog-resource-cache.ts'),
      'utf8'
    );
    const cartServer = readFileSync(join(sourceRoot, 'commerce/cart-server.ts'), 'utf8');
    const apiCart = readFileSync(join(sourceRoot, 'pages/api/cart.ts'), 'utf8');
    const cartCatalog = readFileSync(join(sourceRoot, 'pages/cart-catalog.json.ts'), 'utf8');

    expect(composition).toContain('export const getCatalogProvider');
    expect(composition).not.toContain('export const catalogProvider');
    expect(composition).toContain('createConfiguredShopifyBuyerStorefrontGateway');
    expect(composition).toContain('shopifyCatalogCache ??=');
    expect(adapter).toContain('options.cache ??');
    expect(adapter).not.toContain('buyerIp');
    expect(cache).not.toContain('buyerIp');
    expect(cartServer).toMatch(/createConfiguredShopifyCartService = \(buyerIp: string\)/);
    expect(cartServer).toContain('createConfiguredShopifyBuyerStorefrontGateway(buyerIp)');
    expect(apiCart).toContain('createConfiguredShopifyCartService(clientAddress)');
    expect(cartCatalog).toContain('getCatalogProvider()');
    expect(cartCatalog).not.toContain('clientAddress');

    const ssrRoutes = {
      'src/pages/index.astro': 'getCatalogProvider(Astro.clientAddress)',
      'src/pages/productos/index.astro': 'getCatalogProvider(Astro.clientAddress)',
      'src/pages/productos/[slug].astro': 'getCatalogProvider(Astro.clientAddress)',
      'src/pages/categorias/[slug].astro': 'getCatalogProvider(Astro.clientAddress)',
      'src/pages/sitemap-commerce.xml.ts': 'getCatalogProvider(clientAddress)',
    };
    for (const [path, call] of Object.entries(ssrRoutes)) {
      const source = readFileSync(join(root, path), 'utf8');
      expect(source).toContain(call);
      expect(source).not.toMatch(/import\s*\{\s*catalogProvider\s*\}/);
    }

    const forbiddenProxyHeaders = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip'];
    const scoped = sourceFiles.filter((path) => {
      const relative = sourcePath(path);
      return relative.startsWith('src/pages/') || relative.startsWith('src/commerce/');
    });
    const violations = scoped.flatMap((path) => {
      const source = readFileSync(path, 'utf8').toLowerCase();
      return forbiddenProxyHeaders
        .filter((header) => source.includes(header))
        .map((header) => `${sourcePath(path)}: ${header}`);
    });
    expect(violations).toEqual([]);
  });

  test('el gate operativo de Shopify Admin está documentado y no se finge con flags', () => {
    expect(existsSync(join(root, 'docs/SHOPIFY_LAUNCH_OPERATIONS.md'))).toBe(true);
    const readiness = readFileSync(join(root, 'docs/SHOPIFY_READINESS.md'), 'utf8');
    expect(readiness).toContain('Operational launch gate');
    expect(readiness).toContain('SHOPIFY_LAUNCH_OPERATIONS.md');
    expect(readiness).not.toContain('SHOPIFY_SHIPPING_READY');

    const forbiddenFlags = [
      'SHOPIFY_ADMIN_ACCESS_TOKEN',
      'SHOPIFY_SHIPPING_READY',
      'SHOPIFY_TAX_READY',
      'SHOPIFY_PAYMENT_READY',
      'SHOPIFY_EMAIL_READY',
      'SHIPPING_RATE',
      'FREE_SHIPPING_THRESHOLD',
      'VAT_RATE',
      'TAX_RATE',
      'TAX_INCLUDED',
      'PAYMENT_PROVIDER',
      'SHOPIFY_PAYMENTS_ENABLED',
      'BOGUS_GATEWAY',
    ];
    const runtimeSurfaces = [
      join(root, '.env.example'),
      join(root, 'astro.config.mjs'),
      ...sourceFiles,
      ...walk(join(root, 'scripts')).filter((path) => /\.(?:mjs|ts)$/.test(path)),
    ];
    const leaks = runtimeSurfaces.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return forbiddenFlags
        .filter((name) => source.includes(name))
        .map((name) => `${sourcePath(path)}: ${name}`);
    });
    expect(leaks).toEqual([]);
  });
});
