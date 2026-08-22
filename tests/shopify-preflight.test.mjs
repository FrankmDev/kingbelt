import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  PREFLIGHT_STOREFRONT_QUERY,
  diffHandles,
  formatPreflightFailure,
  mapShopifyCatalogForPreflight,
  parseExpectedHandles,
  runShopifyPreflight,
  runShopifyPreflightCli,
  sanitizePreflightText,
} from '../scripts/shopify-preflight.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER,
  SHOPIFY_STOREFRONT_API_VERSION,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  SHOPIFY_COLOR_GALLERIES_METAFIELD,
  assignProductCollections,
  casualCollection,
  novedadesCollection,
  pageInfo,
  productWithoutColorPayload,
  sportCollection,
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
  SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'cinturon-atlas',
  SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: 'sport',
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

const twoProductCatalog = () => {
  const atlas = validShopifyCatalogPayload();
  const unico = productWithoutColorPayload();
  return {
    collections: atlas.collections,
    products: [...atlas.products, ...unico.products],
  };
};

const runConfigCli = async (overrides) => {
  const fetch = async () => {
    throw new Error('no request expected');
  };
  const io = captureIO();
  const code = await runShopifyPreflightCli(validEnv(overrides), { ...io, fetch });
  return { code, io };
};

const storefrontLocalization = ({
  country = SHOPIFY_MARKET_CONTEXT.country,
  language = SHOPIFY_MARKET_CONTEXT.language,
  currency = SHOPIFY_MARKET_CONTEXT.currency,
  availableLanguages = [{ isoCode: language }],
} = {}) => ({
  country: {
    isoCode: country,
    currency: { isoCode: currency },
    availableLanguages,
  },
  language: { isoCode: language },
});

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createStorefrontFetch = ({
  catalog = validShopifyCatalogPayload(),
  shopName = 'KingBelt Test',
  localization = storefrontLocalization(),
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
        data: { shop: { name: shopName }, localization },
        errors: graphqlErrors,
      });
    }

    const query = body.query;
    if (query.includes('PreflightStorefront')) {
      return json({ data: { shop: { name: shopName }, localization } });
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
    expect(io.failure()).toContain('configuration error');
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
    expect(io.success()).toContain('Catalog manifest: OK');
    expect(io.success()).toContain('Catalog mapping: OK');
    expect(io.success()).toContain('Catalog validation: OK');
    expect(io.success()).toContain('Localization context: OK');
    expect(io.success()).toContain(`Market: ${SHOPIFY_MARKET_CONTEXT.country}`);
    expect(io.success()).toContain(`Language: ${SHOPIFY_MARKET_CONTEXT.language}`);
    expect(io.success()).toContain(`Currency: ${SHOPIFY_MARKET_CONTEXT.currency}`);
    expect(io.success()).toMatch(/Products: 1/);
    expect(io.success()).toMatch(/Variants: 6/);
    expect(io.success()).toMatch(/Collections: 1/);
    expect(io.success()).not.toContain('skipped');
    expect(io.success()).not.toContain('Required products');
    expect(queriesOf(requests).filter((query) => query.includes('PreflightStorefront'))).toHaveLength(1);
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(true);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.headers).not.toHaveProperty('Shopify-Storefront-Buyer-IP');
    }
  });

  test('el diagnóstico de mapping informa varios productos defectuosos de una vez', () => {
    const payload = validShopifyCatalogPayload();
    const second = structuredClone(payload.products[0]);
    payload.products[0].title = '';
    second.id = 'gid://shopify/Product/2';
    second.handle = 'cinturon-segundo';
    second.title = '';
    payload.products.push(second);

    expect(() => mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com']))
      .toThrow('2 producto(s) no superan el mapping');
    try {
      mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com']);
      throw new Error('se esperaba un preflight inválido');
    } catch (error) {
      expect(error.message).toContain('cinturon-atlas.title');
      expect(error.message).toContain('cinturon-segundo.title');
    }
  });

  test('una variante a 0.00 EUR falla el preflight identificando producto y path', () => {
    const payload = validShopifyCatalogPayload();
    payload.products[0].variants.nodes[0].price = { amount: '0.00', currencyCode: 'EUR' };
    expect(() => mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com'])).toThrow(
      'cinturon-atlas: non_positive_variant_price at products[0].variants[0].price'
    );
  });

  test('una ProductVariant.image distinta de la portada falla el preflight localizando la variante', () => {
    const payload = validShopifyCatalogPayload();
    const actual = payload.products[0].images.nodes.find((item) => item.id.endsWith('/negro-1'));
    payload.products[0].variants.nodes[0].image = actual;
    expect(() => mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com']))
      .toThrow('1 producto(s) no superan el mapping');
    try {
      mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com']);
      throw new Error('se esperaba un preflight inválido');
    } catch (error) {
      expect(error.message).toContain('cinturon-atlas.variants[0].image');
      expect(error.message).toContain('Color: Cuero');
      expect(error.message).toContain('Talla: 90');
    }
  });

  test('el formato conserva hasta diez diagnósticos de producto y sigue redactando secretos', () => {
    const payload = validShopifyCatalogPayload();
    payload.products = Array.from({ length: 11 }, (_, index) => {
      const product = structuredClone(payload.products[0]);
      product.id = `gid://shopify/Product/${index + 1}`;
      product.handle = `cinturon-roto-${index + 1}`;
      product.title = '';
      return product;
    });

    try {
      mapShopifyCatalogForPreflight(payload, ['cdn.shopify.com']);
      throw new Error('se esperaba un preflight inválido');
    } catch (error) {
      const formatted = formatPreflightFailure(error, validEnv());
      expect(formatted).toContain('cinturon-roto-1.title');
      expect(formatted).toContain('cinturon-roto-10.title');
      expect(formatted).not.toContain('cinturon-roto-11.title');
      expect(formatted).toContain('+1 producto(s) con errores adicionales');
      expect(formatted).not.toContain(TOKEN);
    }
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
    expect(io.failure()).not.toContain('manifest mismatch');
    expect(io.failure()).not.toContain('Missing:');
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

  test('un handle esperado ausente del Storefront falla como manifiesto', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'cinturon-atlas,cinturon-dakar,cinturon-monza',
    }));
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('Storefront product manifest mismatch');
    expect(io.failure()).toContain('Missing: cinturon-dakar, cinturon-monza');
    expect(io.failure()).not.toContain('Required product handle');
  });

  test('un producto inesperado publicado en Storefront falla como manifiesto', async () => {
    const { code, io } = await runCli(validEnv(), { catalog: twoProductCatalog() });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('Storefront product manifest mismatch');
    expect(io.failure()).toContain('Unexpected: cinturon-unico');
  });

  test('el conjunto exacto de productos es independiente del orden', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'cinturon-unico,cinturon-atlas',
    }), { catalog: twoProductCatalog() });
    expect(code).toBe(0);
    expect(io.success()).toContain('Catalog manifest: OK');
    expect(io.success()).toMatch(/Products: 2/);
  });

  test('faltantes e inesperados se reportan juntos en el manifiesto de productos', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'cinturon-atlas,cinturon-dakar',
    }), { catalog: twoProductCatalog() });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Missing: cinturon-dakar');
    expect(io.failure()).toContain('Unexpected: cinturon-unico');
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
    expect(summary.images).toBe(10);
    expect(summary.manifest).toBe('OK');
    expect(summary.market).toEqual(SHOPIFY_MARKET_CONTEXT);
  });

  test('no se degrada a una query shop { name } y carga el catálogo autoritativo', async () => {
    expect(PREFLIGHT_STOREFRONT_QUERY).toContain('shop');
    expect(PREFLIGHT_STOREFRONT_QUERY).toContain('localization');
    expect(PREFLIGHT_STOREFRONT_QUERY).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(PREFLIGHT_STOREFRONT_QUERY).not.toContain('availableCountries');
    expect(PREFLIGHT_STOREFRONT_QUERY).not.toMatch(/\bmarket\b/);
    const { requests } = await runCli(validEnv());
    const queries = queriesOf(requests);
    const catalogQuery = queries.find((query) => query.includes('KingBeltCatalogPage'));
    expect(catalogQuery).toBeDefined();
    expect(catalogQuery).toContain('metafields(identifiers:');
    expect(catalogQuery).toContain(`namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}"`);
    expect(catalogQuery).toContain(`key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}"`);
    expect(catalogQuery).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
    expect(catalogQuery).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(catalogQuery).toContain('... on Collection { id handle title }');
    expect(catalogQuery).toContain('variants(first:');
    expect(catalogQuery).toContain('images(first:');
    expect(catalogQuery).toContain('collections(first:');
    expect(queries.filter((query) => query.includes('PreflightStorefront'))).toHaveLength(1);
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

  test('un producto con una sola colección sin metafield hace fallar el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].metafields = catalog.products[0].metafields.filter((item) =>
      item?.key !== SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Product "cinturon-atlas":');
    expect(io.failure()).toContain(`${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is missing`);
  });

  test('un producto en varias colecciones sin metafield hace fallar el preflight con su handle', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    );
    catalog.products[0].metafields = catalog.products[0].metafields.filter((item) =>
      item?.key !== SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Product "cinturon-atlas":');
    expect(io.failure()).toContain(`${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is missing`);
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
    expect(io.failure()).toContain(
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} references collection "casual" but that collection is not assigned to this product`
    );
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

    const missingLegacyGallery = validShopifyCatalogPayload();
    missingLegacyGallery.products[0].metafields =
      missingLegacyGallery.products[0].metafields.filter((item) => item?.key !== SHOPIFY_COLOR_GALLERIES_METAFIELD.key);
    const galleryResult = await runCli(validEnv(), { catalog: missingLegacyGallery });
    expect(galleryResult.code).toBe(0);
    expect(galleryResult.io.success()).toContain('preflight passed');
  });

  test('preflight falla ante una familia nativa con cardinalidad inválida', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].images.nodes = catalog.products[0].images.nodes.filter((item) =>
      !item.id.endsWith('/cuero-3')
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('familia 5365_35_cuero');
    expect(io.failure()).toContain('01, 02 y 03');
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
    expect(pkg.scripts['shopify:cart-smoke']).toBe('bun scripts/shopify-cart-smoke.mjs');
    expect(pkg.scripts['shopify:release-gate']).toBe('bun scripts/shopify-release-gate.mjs');
    expect(pkg.scripts.validate).not.toContain('shopify:preflight');
    expect(pkg.scripts.validate).not.toContain('shopify:cart-smoke');
    expect(pkg.scripts.validate).not.toContain('shopify:release-gate');
    expect(pkg.scripts.validate).not.toContain('session:preflight');
    expect(pkg.scripts.validate).not.toContain('legal:preflight');
    expect(pkg.scripts.build).not.toContain('shopify:preflight');
    expect(pkg.scripts.build).not.toContain('shopify:cart-smoke');
    expect(pkg.scripts.build).not.toContain('shopify');
    expect(workflow).not.toContain('shopify:preflight');
    expect(workflow).not.toContain('shopify:cart-smoke');
    expect(workflow).not.toContain('shopify:release-gate');
    expect(workflow).not.toContain('session:preflight');
    expect(workflow).not.toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
    const preflight = readFileSync(join(root, 'scripts/shopify-preflight.ts'), 'utf8');
    expect(preflight).toContain('fetchShopifyCatalog');
    expect(preflight).toContain('mapShopifyCatalog');
    expect(preflight).toContain('createShopifyCatalogAdapter');
    expect(preflight).toContain('SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES');
    expect(preflight).toContain('SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES');
    expect(preflight).toContain('PREFLIGHT_STOREFRONT_QUERY');
    expect(preflight).toContain('assertShopifyMarketLocalization');
    expect(preflight).not.toContain('PREFLIGHT_SHOP_QUERY');
    expect(preflight).not.toContain('PreflightShop');
    expect(preflight).not.toContain('SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES');
    expect(preflight).not.toContain('Required products');
    expect(preflight).not.toContain("from 'astro:env");
    expect(preflight).not.toContain('@commerce/catalog');
    expect(preflight).not.toContain('cartCreate');
    expect(preflight).not.toContain('demo-catalog');
    expect(preflight).not.toContain('buyerIp');
    expect(preflight).not.toContain('Shopify-Storefront-Buyer-IP');
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
    const storefrontRequest = requests.find((request) =>
      JSON.parse(request.body).query.includes('PreflightStorefront')
    );
    expect(storefrontRequest).toBeDefined();
    const storefrontBody = JSON.parse(storefrontRequest.body);
    expect(storefrontBody.query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(storefrontBody.query).toContain('$country: CountryCode!');
    expect(storefrontBody.query).toContain('$language: LanguageCode!');
    expect(storefrontBody.variables).toEqual({
      country: SHOPIFY_MARKET_CONTEXT.country,
      language: SHOPIFY_MARKET_CONTEXT.language,
    });
  });

  test('un país Storefront distinto de ES falla y no descarga el catálogo', async () => {
    const { code, io, requests } = await runCli(validEnv(), {
      localization: storefrontLocalization({ country: 'FR' }),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('Storefront localization country is not ES');
    expect(io.failure()).toContain('received FR');
    expect(io.success()).not.toContain('Localization context: OK');
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(false);
  });

  test('un idioma Storefront distinto de ES falla sin fallback', async () => {
    const { code, io, requests } = await runCli(validEnv(), {
      localization: storefrontLocalization({ language: 'EN' }),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('Storefront localization language is not ES');
    expect(io.failure()).toContain('received EN');
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(false);
  });

  test('ES ausente de availableLanguages falla el preflight', async () => {
    const { code, io, requests } = await runCli(validEnv(), {
      localization: storefrontLocalization({ availableLanguages: [{ isoCode: 'EN' }] }),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('available languages');
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(false);
  });

  test('una moneda Storefront distinta de EUR falla y no descarga el catálogo', async () => {
    const { code, io, requests } = await runCli(validEnv(), {
      localization: storefrontLocalization({ currency: 'USD' }),
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('Storefront localization currency is not EUR');
    expect(io.failure()).toContain('received USD');
    expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(false);
  });

  [
    ['localization ausente', null],
    ['country ausente', { language: { isoCode: 'ES' } }],
    ['currency ausente', {
      country: { isoCode: 'ES', availableLanguages: [{ isoCode: 'ES' }] },
      language: { isoCode: 'ES' },
    }],
    ['language ausente', {
      country: {
        isoCode: 'ES',
        currency: { isoCode: 'EUR' },
        availableLanguages: [{ isoCode: 'ES' }],
      },
    }],
  ].forEach(([label, localization]) => {
    test(`un payload de ${label} falla el preflight`, async () => {
      const { code, io, requests } = await runCli(validEnv(), { localization });
      expect(code).toBe(1);
      expect(io.failure()).toContain('configuration error');
      expect(io.failure()).toContain('Storefront localization payload does not match');
      expect(io.failure()).not.toContain('TypeError');
      expect(queriesOf(requests).some((query) => query.includes('KingBeltCatalogPage'))).toBe(false);
    });
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

  test('una ProductVariant.image que no es la portada del color hace fallar el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    const expected = catalog.products[0].images.nodes[0];
    const actual = catalog.products[0].images.nodes[1];
    catalog.products[0].variants.nodes[0].image = actual;
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('cinturon-atlas.variants[0].image');
    expect(io.failure()).toContain('Color: Cuero');
    expect(io.failure()).toContain(expected.id);
    expect(io.failure()).toContain(actual.id);
    expect(io.success()).not.toContain('preflight passed');
  });

  test('una categoría oficial ausente falla el preflight', async () => {
    const catalog = validShopifyCatalogPayload();
    catalog.products[0].category = null;
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('category');
    expect(io.failure()).not.toContain('manifest mismatch');
  });

  test('el manifiesto de colecciones exacto es independiente del orden', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [sportCollection, casualCollection],
      sportCollection
    );
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: 'casual,sport',
    }), { catalog });
    expect(code).toBe(0);
    expect(io.success()).toContain('Catalog manifest: OK');
    expect(io.success()).toMatch(/Collections: 2/);
  });

  test('una colección esperada ausente falla el preflight', async () => {
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: 'sport,casual',
    }));
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('Storefront collection manifest mismatch');
    expect(io.failure()).toContain('Missing: casual');
  });

  test('una colección inesperada falla el preflight', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [sportCollection, casualCollection],
      sportCollection
    );
    const { code, io } = await runCli(validEnv(), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('catalog error');
    expect(io.failure()).toContain('Storefront collection manifest mismatch');
    expect(io.failure()).toContain('Unexpected: casual');
  });

  test('faltantes e inesperadas se reportan juntos en el manifiesto de colecciones', async () => {
    const catalog = assignProductCollections(
      validShopifyCatalogPayload(),
      [sportCollection, casualCollection],
      sportCollection
    );
    const { code, io } = await runCli(validEnv({
      SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: 'sport,novedades',
    }), { catalog });
    expect(code).toBe(1);
    expect(io.failure()).toContain('Missing: novedades');
    expect(io.failure()).toContain('Unexpected: casual');
  });

  test('falta el manifiesto de productos y no consulta Storefront', async () => {
    const { code, io } = await runConfigCli({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: undefined,
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES');
    expect(io.failure()).not.toContain('skipped');
  });

  test('falta el manifiesto de colecciones y no consulta Storefront', async () => {
    const { code, io } = await runConfigCli({
      SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: undefined,
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain('SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES');
  });

  [
    ['', 'vacío'],
    [' , ', 'solo separadores'],
  ].forEach(([value, label]) => {
    test(`un manifiesto de productos ${label} es error de configuración`, async () => {
      const { code, io } = await runConfigCli({
        SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: value,
      });
      expect(code).toBe(1);
      expect(io.failure()).toContain('configuration error');
      expect(io.failure()).toContain('SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES');
    });

    test(`un manifiesto de colecciones ${label} es error de configuración`, async () => {
      const { code, io } = await runConfigCli({
        SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: value,
      });
      expect(code).toBe(1);
      expect(io.failure()).toContain('configuration error');
      expect(io.failure()).toContain('SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES');
    });
  });

  [
    'Cinturon Atlas',
    'Cinturon-Atlas',
    '/productos/foo',
    'https://kingbelt.test/foo',
    'Foo',
    'foo/bar',
  ].forEach((handle) => {
    test(`un handle de producto inválido (${handle}) es error de configuración`, async () => {
      const { code, io } = await runConfigCli({
        SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: handle,
      });
      expect(code).toBe(1);
      expect(io.failure()).toContain('configuration error');
      expect(io.failure()).toContain('invalid handle');
      expect(io.failure()).toContain(handle);
    });

    test(`un handle de colección inválido (${handle}) es error de configuración`, async () => {
      const { code, io } = await runConfigCli({
        SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: handle,
      });
      expect(code).toBe(1);
      expect(io.failure()).toContain('configuration error');
      expect(io.failure()).toContain('invalid handle');
      expect(io.failure()).toContain(handle);
    });
  });

  test('un handle de producto duplicado en el manifiesto falla', async () => {
    const { code, io } = await runConfigCli({
      SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES: 'cinturon-atlas,cinturon-dakar,cinturon-atlas',
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain(
      'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES contains duplicate handle: cinturon-atlas.'
    );
  });

  test('un handle de colección duplicado en el manifiesto falla', async () => {
    const { code, io } = await runConfigCli({
      SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES: 'sport,casual,sport',
    });
    expect(code).toBe(1);
    expect(io.failure()).toContain('configuration error');
    expect(io.failure()).toContain(
      'SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES contains duplicate handle: sport.'
    );
  });

  test('parseExpectedHandles recorta espacios CSV y no normaliza handles inválidos', () => {
    expect(parseExpectedHandles('a, b', 'X')).toEqual(['a', 'b']);
    expect(() => parseExpectedHandles(undefined, 'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES')).toThrow(
      'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES must be a comma-separated list of handles.'
    );
    expect(() => parseExpectedHandles('Cinturon-Atlas', 'X')).toThrow('invalid handle: Cinturon-Atlas');
  });

  test('el manifiesto de lanzamiento usa los handles exactos de Storefront, con ó transliterada a o', () => {
    const launchProductHandles = [
      'cinturon-caballero-al-corte-tintado-40-mm-5003-40',
      'cinturon-caballero-al-corte-volanato-5026-40',
      'cinturon-caballero-altamarea-hebilla-doble-pua-5880-40',
      'cinturon-caballero-piel-al-corte-montana-5029-40',
      'cinturon-caballero-al-corte-doble-pespunte-bicolor-5508-35',
      'cinturon-caballero-al-corte-tintado-seta-5009-35',
      'cinturon-caballero-al-corte-lujado-con-costura-5025-35',
      'cinturon-caballero-altamarea-5568-35',
      'cinturon-caballero-al-corte-grabado-puntos-5776-40',
      'cinturon-ensamblado-serraje-pintado-contorno-5365-35',
    ];
    expect(parseExpectedHandles(
      launchProductHandles.join(','),
      'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES'
    )).toEqual(launchProductHandles);
    expect(parseExpectedHandles(
      'sport,casual,vestir',
      'SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES'
    )).toEqual(['sport', 'casual', 'vestir']);
    expect(launchProductHandles.every((handle) => handle.startsWith('cinturon-'))).toBe(true);
    expect(launchProductHandles.some((handle) => handle.startsWith('cintur-on-'))).toBe(false);
    expect(() => parseExpectedHandles(
      'cinturón-caballero-al-corte-tintado-seta-5009-35',
      'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES'
    )).toThrow('invalid handle');
    expect(diffHandles(launchProductHandles, ['cintur-on-caballero-al-corte-tintado-seta-5009-35'])).toEqual({
      missing: [...launchProductHandles].sort(),
      unexpected: ['cintur-on-caballero-al-corte-tintado-seta-5009-35'],
    });
  });

  test('diffHandles compara conjuntos y ordena de forma determinista', () => {
    expect(diffHandles(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({ missing: [], unexpected: [] });
    expect(diffHandles(['a', 'b', 'c'], ['a', 'c'])).toEqual({ missing: ['b'], unexpected: [] });
    expect(diffHandles(['a', 'b'], ['a', 'b', 'test'])).toEqual({ missing: [], unexpected: ['test'] });
    expect(diffHandles(['atlas', 'dakar'], ['atlas', 'test'])).toEqual({
      missing: ['dakar'],
      unexpected: ['test'],
    });
  });

  test('nunca imprime un Cart ID en errores de preflight', () => {
    const cartId = 'gid://shopify/Cart/secret-cart-key-never-print';
    const sanitized = sanitizePreflightText(`cart ${cartId} Authorization: ${TOKEN}`, validEnv());
    expect(sanitized).toContain('[redacted-cart-id]');
    expect(sanitized).toContain('[redacted-header]');
    expect(sanitized).not.toContain('secret-cart-key-never-print');
    expect(sanitized).not.toContain(TOKEN);
  });

  test('los manifiestos de preflight no entran en runtime ni en astro:env', () => {
    const names = [
      'SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES',
      'SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES',
      'SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES',
    ];
    const walk = (directory) => readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
    const runtimeHits = [
      join(root, 'astro.config.mjs'),
      ...walk(join(root, 'src')),
    ].filter((path) => {
      const text = readFileSync(path, 'utf8');
      return names.some((name) => text.includes(name));
    }).map((path) => path.slice(root.length + 1));
    expect(runtimeHits).toEqual([]);

    const example = readFileSync(join(root, '.env.example'), 'utf8');
    expect(example).toContain('SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES=');
    expect(example).toContain('SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES=');
    expect(example).toContain('Solo se usan durante shopify:preflight');
    expect(example).not.toContain('SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES');
    expect(example).not.toContain('required handles optional');
  });
});
