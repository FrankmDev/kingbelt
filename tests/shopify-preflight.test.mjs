import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  PREFLIGHT_SHOP_QUERY,
  runShopifyPreflight,
  runShopifyPreflightCli,
  sanitizePreflightText,
} from '../scripts/shopify-preflight.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_STOREFRONT_API_VERSION,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  assignProductCollections,
  casualCollection,
  novedadesCollection,
  pageInfo,
  validShopifyCatalogPayload,
} from './fixtures/shopify-catalog-payload.mjs';

const root = resolve(import.meta.dir, '..');
const TOKEN = 'shpat_preflight-secret-token-do-not-print';
const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/secret-hook';

const CUSTOMER_ACCOUNT_URL = 'https://account.example.test';

const validEnv = (overrides = {}) => ({
  COMMERCE_SOURCE: 'shopify',
  SHOPIFY_STORE_DOMAIN: 'kingbelt-test.myshopify.com',
  SHOPIFY_API_VERSION: SHOPIFY_STOREFRONT_API_VERSION,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: TOKEN,
  SHOPIFY_CUSTOMER_ACCOUNT_URL: CUSTOMER_ACCOUNT_URL,
  ...overrides,
});

const captureIO = () => {
  const stdout = [];
  const stderr = [];
  return {
    stdout: { write(chunk) { stdout.push(String(chunk)); return true; } },
    stderr: { write(chunk) { stderr.push(String(chunk)); return true; } },
    printed: () => `${stdout.join('')}\n${stderr.join('')}`,
    success: () => stdout.join(''),
    failure: () => stderr.join(''),
  };
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createStorefrontFetch = ({
  catalog = validShopifyCatalogPayload(),
  shopName = 'KingBelt Test',
  status,
  graphqlErrors,
  hang = false,
  catalogPages,
} = {}) => {
  const requests = [];
  const fetch = async (input, init) => {
    requests.push({
      input: String(input),
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
    });
    if (hang) {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }
    if (status && status !== 200) return new Response('{}', { status });

    const body = JSON.parse(init.body);
    if (graphqlErrors) {
      return json({
        data: { shop: { name: shopName } },
        errors: graphqlErrors,
      });
    }

    const query = body.query;
    if (query.includes('PreflightShop')) {
      return json({ data: { shop: { name: shopName } } });
    }
    if (query.includes('KingBeltCatalogPage')) {
      if (catalogPages) {
        const page = catalogPages(body.variables);
        return json({ data: page });
      }
      return json({
        data: {
          products: { nodes: catalog.products, pageInfo },
          collections: { nodes: catalog.collections, pageInfo },
        },
      });
    }
    if (query.includes('KingBeltProductVariantsPage')) {
      return json({ data: { node: { variants: { nodes: [], pageInfo } } } });
    }
    if (query.includes('KingBeltProductImagesPage')) {
      return json({ data: { node: { images: { nodes: [], pageInfo } } } });
    }
    if (query.includes('KingBeltProductCollectionsPage')) {
      return json({ data: { node: { collections: { nodes: [], pageInfo } } } });
    }
    throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
  };
  return { requests, fetch };
};

const runCli = async (env, fetchOptions = {}) => {
  const io = captureIO();
  const { requests, fetch } = createStorefrontFetch(fetchOptions);
  const code = await runShopifyPreflightCli(env, {
    ...io,
    fetch,
    timeoutMs: fetchOptions.hang ? 20 : undefined,
  });
  return { code, io, requests };
};

const queriesOf = (requests) =>
  requests.map((request) => JSON.parse(request.body).query);

describe('preflight Shopify', () => {
  test('falla si COMMERCE_SOURCE no es shopify', async () => {
    const fetch = async () => {
      throw new Error('no request expected');
    };
    const io = captureIO();
    const code = await runShopifyPreflightCli(validEnv({ COMMERCE_SOURCE: 'demo' }), { ...io, fetch });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Shopify preflight failed');
    expect(io.failure()).toContain('Shopify preflight requires COMMERCE_SOURCE=shopify');
  });

  test('falla si falta el dominio de la tienda', async () => {
    const fetch = async () => {
      throw new Error('no request expected');
    };
    const io = captureIO();
    const code = await runShopifyPreflightCli(validEnv({ SHOPIFY_STORE_DOMAIN: undefined }), {
      ...io,
      fetch,
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Missing required Shopify configuration: SHOPIFY_STORE_DOMAIN');
  });

  test('falla si falta el token privado de Storefront', async () => {
    const fetch = async () => {
      throw new Error('no request expected');
    };
    const io = captureIO();
    const code = await runShopifyPreflightCli(
      validEnv({ SHOPIFY_STOREFRONT_PRIVATE_TOKEN: undefined }),
      { ...io, fetch }
    );
    expect(code).toBe(1);
    expect(io.failure()).toContain(
      'Missing required Shopify configuration: SHOPIFY_STOREFRONT_PRIVATE_TOKEN'
    );
  });

  test('falla si falta la URL de Customer Accounts', async () => {
    const fetch = async () => {
      throw new Error('no request expected');
    };
    const io = captureIO();
    const code = await runShopifyPreflightCli(
      validEnv({ SHOPIFY_CUSTOMER_ACCOUNT_URL: undefined }),
      { ...io, fetch }
    );
    expect(code).toBe(1);
    expect(io.failure()).toContain(
      'Missing required Shopify configuration: SHOPIFY_CUSTOMER_ACCOUNT_URL'
    );
  });

  test('falla si la URL de Customer Accounts no es HTTPS válido', async () => {
    const fetch = async () => {
      throw new Error('no request expected');
    };
    const io = captureIO();
    const code = await runShopifyPreflightCli(
      validEnv({ SHOPIFY_CUSTOMER_ACCOUNT_URL: 'http://account.example.test' }),
      { ...io, fetch }
    );
    expect(code).toBe(1);
    expect(io.failure()).toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(io.failure()).toContain('HTTPS');
  });

  test('nunca imprime el token privado ni cabeceras de autenticación', async () => {
    const { code, io } = await runCli(validEnv(), { status: 401 });
    expect(code).toBe(1);
    expect(io.printed()).not.toContain(TOKEN);
    expect(io.printed()).not.toMatch(/Shopify-Storefront-Private-Token/i);
    expect(sanitizePreflightText(`token=${TOKEN}`, validEnv())).not.toContain(TOKEN);
  });

  test('una conectividad correcta permite continuar y validar el catálogo', async () => {
    const { code, io, requests } = await runCli(validEnv());
    expect(code).toBe(0);
    expect(io.success()).toContain('Shopify preflight passed');
    expect(io.success()).toContain('Storefront API: OK');
    expect(io.success()).toContain('Catalog mapping: OK');
    expect(io.success()).toContain('Catalog validation: OK');
    expect(io.success()).toContain(`Market: ${SHOPIFY_MARKET_CONTEXT.country}`);
    expect(io.success()).toContain(`Language: ${SHOPIFY_MARKET_CONTEXT.language}`);
    expect(io.success()).toContain(`Currency: ${SHOPIFY_MARKET_CONTEXT.currency}`);
    expect(io.success()).toMatch(/Products: 1/);
    expect(io.success()).toMatch(/Variants: 6/);
    expect(io.success()).toMatch(/Collections: 1/);
    expect(io.success()).toContain('Required products: skipped');
    expect(queriesOf(requests).some((query) => query.includes('PreflightShop'))).toBe(true);
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(true);
  });

  test('un fallo de autenticación devuelve código de error', async () => {
    const { code, io } = await runCli(validEnv(), { status: 401 });
    expect(code).toBe(1);
    expect(io.failure()).toContain('authentication error');
    expect(io.failure()).toContain('HTTP 401');
  });

  test('un timeout devuelve código de error', async () => {
    const { code, io } = await runCli(validEnv(), { hang: true });
    expect(code).toBe(1);
    expect(io.failure()).toContain('network/timeout error');
    expect(io.failure()).toContain('timed out');
  });

  test('los errores GraphQL producen un fallo', async () => {
    const { code, io } = await runCli(validEnv(), {
      graphqlErrors: [{
        message: `Cannot query field products with ${TOKEN}`,
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      }],
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('GraphQL error');
    expect(io.failure()).toContain('[redacted]');
    expect(io.failure()).not.toContain(TOKEN);
  });

  test('un catálogo vacío falla si viola el contrato', async () => {
    const { code, io, requests } = await runCli(validEnv(), {
      catalog: { products: [], collections: [] },
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Shopify preflight failed');
    expect(io.failure()).toContain('empty_catalog');
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(true);
  });

  test('un producto inválido falla', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].title = '';
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('title');
  });

  test('una variante inválida falla', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].variants.nodes[0].id = '';
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
  });

  test('una combinación duplicada de opciones falla', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].variants.nodes[1].selectedOptions =
      catalog.products[0].variants.nodes[0].selectedOptions.map((item) => ({ ...item }));
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('duplicate_option_combination');
  });

  test('una excepción del mapper falla', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].metafields = catalog.products[0].metafields.map((item) =>
      item?.key === 'model_reference' ? { ...item, type: 'number_integer' } : item
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('model_reference');
  });

  test('un fallo de assertValidCatalog falla el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].publishedAt = null;
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('unpublished_product');
  });

  test('un handle requerido ausente falla si se configuró', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES: 'piloto-ausente',
    }));
    expect(code).toBe(1);
    expect(io.failure()).toContain('Required product handle was not found: piloto-ausente');
  });

  test('un handle requerido válido pasa', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES: 'cinturon-atlas',
    }));
    expect(code).toBe(0);
    expect(io.success()).toContain('Required products: OK');
  });

  test('la configuración sin handles requeridos funciona', async () => {
    const { code, io } = await runCli(validEnv());
    expect(code).toBe(0);
    expect(io.success()).toContain('Required products: skipped');
  });

  test('no se ejecutan mutations ni se llama Admin API ni deploy hook', async () => {
    const { code, requests } = await runCli(validEnv({
      VERCEL_DEPLOY_HOOK_URL: DEPLOY_HOOK,
      SHOPIFY_WEBHOOK_SECRET: 'webhook-secret',
    }));
    expect(code).toBe(0);
    const queries = queriesOf(requests);
    expect(queries.every((query) => query.includes('query ') && !/\bmutation\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /cartCreate|cartLinesAdd|checkoutUrl/i.test(query))).toBe(false);
    expect(requests.every((request) => request.input.includes('/api/2026-07/graphql.json'))).toBe(true);
    expect(requests.some((request) => request.input.includes('/admin/api/'))).toBe(false);
    expect(requests.some((request) => request.input.includes('api.vercel.com'))).toBe(false);
    expect(requests.some((request) => request.input.includes(DEPLOY_HOOK))).toBe(false);
    expect(requests.some((request) => String(request.input).includes('account.example.test'))).toBe(false);
  });

  test('un resultado válido devuelve exit code 0', async () => {
    const summary = await runShopifyPreflight(validEnv(), {
      fetch: createStorefrontFetch().fetch,
    });
    expect(summary.products).toBe(1);
    expect(summary.variants).toBe(6);
    expect(summary.collections).toBe(1);
    expect(summary.images).toBe(9);
    expect(summary.requiredProducts).toBe('skipped');
    expect(summary.market).toEqual(SHOPIFY_MARKET_CONTEXT);
  });

  test('no se degrada a una query shop { name } y carga el catálogo autoritativo', async () => {
    expect(PREFLIGHT_SHOP_QUERY).toContain('shop');
    const { requests } = await runCli(validEnv());
    const queries = queriesOf(requests);
    const catalogQuery = queries.find((query) => query.includes('KingBeltCatalogPage'));
    expect(catalogQuery).toBeDefined();
    expect(catalogQuery).toContain('metafields(identifiers:');
    expect(catalogQuery).toContain('key: "primary_collection"');
    expect(catalogQuery).toContain('... on Collection { id handle title }');
    expect(catalogQuery).toContain('variants(first:');
    expect(catalogQuery).toContain('images(first:');
    expect(catalogQuery).toContain('collections(first:');
    expect(queries.filter((query) => query.includes('PreflightShop'))).toHaveLength(1);
  });

  test('un metafield opcional ausente no convierte el preflight en fallo', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].metafields = catalog.products[0].metafields.filter((item) =>
      item && !['material', 'width_mm', 'buckle_finish', 'badge'].includes(item.key)
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(0);
    expect(io.success()).toContain('Shopify preflight passed');
  });

  test('un producto en varias colecciones sin metafield hace fallar el preflight con su handle', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    );
    catalog.products[0].metafields = catalog.products[0].metafields.filter((item) =>
      item?.key !== 'primary_collection'
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Product "cinturon-atlas":');
    expect(io.failure()).toContain('kingbelt.primary_collection is missing');
    expect(io.failure()).not.toContain('"products"');
  });

  test('una referencia de colección principal inconsistente hace fallar el preflight', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [novedadesCollection],
      casualCollection
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Product "cinturon-atlas":');
    expect(io.failure()).toContain('primary collection "casual" is not assigned to this product');
  });

  test('una variante sin SKU falla el preflight y no se fabrica un código', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].variants.nodes[0].sku = null;
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('cinturon-atlas.variants[0].sku');
    expect(io.failure()).toContain('falta un texto obligatorio');
    expect(io.failure()).toContain('Color: Cuero');
    expect(io.failure()).not.toContain('cinturon-atlas:gid://shopify/ProductVariant/1');
  });

  test('un SKU duplicado falla el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].variants.nodes[1].sku = catalog.products[0].variants.nodes[0].sku;
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('duplicate_sku');
  });

  test('documenta required, optional y fallback permitido de presentación', async () => {
    const missingSummary = validShopifyCatalogPayload();
    missingSummary.products[0].metafields = missingSummary.products[0].metafields.filter((item) =>
      item?.key !== 'summary'
    );
    await expect(runShopifyPreflight(validEnv(), {
      fetch: createStorefrontFetch({ catalog: missingSummary }).fetch,
    })).resolves.toMatchObject({ products: 1 });

    const missingTitle = validShopifyCatalogPayload();
    missingTitle.products[0].title = '   ';
    const titleResult = await runCli(validEnv(), { catalog: missingTitle });
    expect(titleResult.code).toBe(1);
    expect(titleResult.io.failure()).toContain('title');

    const missingColorGallery = validShopifyCatalogPayload();
    missingColorGallery.products[0].metafields =
      missingColorGallery.products[0].metafields.filter((item) => item?.key !== 'color_galleries');
    const galleryResult = await runCli(validEnv(), { catalog: missingColorGallery });
    expect(galleryResult.code).toBe(1);
    expect(galleryResult.io.failure()).toContain('color_galleries');
  });

  test('preflight falla ante una galería con cardinalidad inválida', async () => {
    const catalog = validShopifyCatalogPayload();
    const imagesField = catalog.products[0].metafields
      .find((item) => item?.key === 'color_galleries')
      .references.nodes[0].fields.find((field) => field.key === 'images');
    imagesField.references.nodes = imagesField.references.nodes.slice(0, 2);
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('color_galleries');
    expect(io.failure()).toContain('imágenes');
  });

  test('la paginación de catálogo se recorre con la query autoritativa', async () => {
    const first = validShopifyCatalogPayload();
    const { code, io, requests } = await runCli(validEnv(), {
      catalogPages: (variables) => {
        const secondPage = Boolean(variables.productsAfter);
        return {
          products: {
            nodes: secondPage ? [] : first.products,
            pageInfo: secondPage
              ? pageInfo
              : { hasNextPage: true, endCursor: 'product-cursor' },
          },
          collections: {
            nodes: secondPage ? [] : first.collections,
            pageInfo: secondPage
              ? pageInfo
              : { hasNextPage: true, endCursor: 'collection-cursor' },
          },
        };
      },
    });
    expect(code).toBe(0);
    expect(io.success()).toContain('Products: 1');
    expect(requests.filter((request) =>
      JSON.parse(request.body).query.includes('KingBeltCatalogPage')
    )).toHaveLength(2);
  });

  test('shopify:preflight es el comando oficial y no forma parte de quality', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const workflow = readFileSync(join(root, '.github/workflows/quality.yml'), 'utf8');
    expect(pkg.scripts['shopify:preflight']).toBe('bun scripts/shopify-preflight.mjs');
    expect(pkg.scripts['shopify:smoke']).toBe('bun scripts/shopify-storefront-smoke.mjs');
    expect(pkg.scripts.validate).not.toContain('shopify:preflight');
    expect(pkg.scripts.build).not.toContain('shopify:preflight');
    expect(pkg.scripts.build).not.toContain('shopify');
    expect(workflow).not.toContain('shopify:preflight');
    expect(workflow).not.toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
    const preflight = readFileSync(join(root, 'scripts/shopify-preflight.ts'), 'utf8');
    expect(preflight).toContain('fetchShopifyCatalog');
    expect(preflight).toContain('mapShopifyCatalog');
    expect(preflight).toContain('createShopifyCatalogAdapter');
    expect(preflight).not.toContain("from 'astro:env");
    expect(preflight).not.toContain('@commerce/catalog');
    expect(preflight).not.toContain('cartCreate');
    expect(preflight).not.toContain('demo-catalog');
  });

  test('el preflight consulta el catálogo con el mismo contexto de mercado que producción', async () => {
    const { code, requests } = await runCli(validEnv());
    expect(code).toBe(0);
    const catalogRequests = requests.filter((request) =>
      JSON.parse(request.body).query.includes('KingBeltCatalogPage')
    );
    expect(catalogRequests.length).toBeGreaterThan(0);
    catalogRequests.forEach((request) => {
      const body = JSON.parse(request.body);
      expect(body.query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(body.variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(body.variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    });
    const shopQuery = queriesOf(requests).find((query) => query.includes('PreflightShop'));
    expect(shopQuery).toBeDefined();
    expect(shopQuery).not.toContain('@inContext');
  });

  test('un precio en moneda distinta de EUR falla el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].variants.nodes.forEach((variant) => {
      variant.price = { ...variant.price, currencyCode: 'USD' };
    });
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('unsupported_currency');
  });
});
