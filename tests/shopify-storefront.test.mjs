import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  getShopifyStorefrontConfig,
  ShopifyConfigurationError,
  SHOPIFY_STOREFRONT_API_VERSION,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  createShopifyStorefrontGateway,
  ShopifyStorefrontRequestError,
} from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';

const root = resolve(import.meta.dir, '..');
const testToken = 'test-private-storefront-token';
const validConfig = {
  storeDomain: 'kingbelt-test.myshopify.com',
  apiVersion: SHOPIFY_STOREFRONT_API_VERSION,
  storefrontToken: testToken,
};

const captureRequest = () => {
  const requests = [];
  const fetch = async (input, init) => {
    requests.push({ input, init });
    return new Response(JSON.stringify({ data: { shop: { name: 'KingBelt Test' } } }));
  };
  return { requests, fetch };
};

describe('configuración Shopify Storefront', () => {
  test('normaliza el host y fija la versión soportada', () => {
    expect(getShopifyStorefrontConfig({
      ...validConfig,
      storeDomain: '  KingBelt-Test.MyShopify.com  ',
    })).toEqual(validConfig);
  });

  test('rechaza dominio ausente o fuera del hostname exacto de Shopify', () => {
    const invalidDomains = [
      undefined,
      '',
      'https://kingbelt.myshopify.com',
      'kingbelt.myshopify.com/products',
      'kingbelt.myshopify.com?preview=1',
      'kingbelt.myshopify.com#catalog',
      'kingbelt.myshopify.com.evil.test',
      'user@kingbelt.myshopify.com',
      'kingbelt.myshopify.com:443',
    ];

    invalidDomains.forEach((storeDomain) => {
      expect(() => getShopifyStorefrontConfig({ ...validConfig, storeDomain }))
        .toThrow(ShopifyConfigurationError);
    });
  });

  test('rechaza una versión distinta o latest y exige token privado de Storefront', () => {
    expect(() => getShopifyStorefrontConfig({ ...validConfig, apiVersion: 'latest' }))
      .toThrow(`SHOPIFY_API_VERSION must be the pinned version ${SHOPIFY_STOREFRONT_API_VERSION}.`);
    expect(() => getShopifyStorefrontConfig({ ...validConfig, apiVersion: '2026-04' }))
      .toThrow(ShopifyConfigurationError);
    expect(() => getShopifyStorefrontConfig({ ...validConfig, storefrontToken: undefined }))
      .toThrow('SHOPIFY_STOREFRONT_PRIVATE_TOKEN is required');
    expect(() => getShopifyStorefrontConfig({ ...validConfig, storefrontToken: ` ${testToken}` }))
      .toThrow('must not contain whitespace or control characters');
    expect(() => getShopifyStorefrontConfig({
      ...validConfig,
      storefrontToken: `${testToken}\nX-Injected: 1`,
    })).toThrow('must not contain whitespace or control characters');
    expect(getShopifyStorefrontConfig({
      ...validConfig,
      storefrontToken: `shpat_${'a'.repeat(24)}`,
    }).storefrontToken).toMatch(/^shpat_/);
    expect(() => getShopifyStorefrontConfig({
      ...validConfig,
      storefrontToken: `shpca_${'a'.repeat(24)}`,
    })).toThrow('not an app client secret');
  });

  test('las variables Storefront coinciden en example, astro:env y versión fijada', () => {
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    const astroConfig = readFileSync(join(root, 'astro.config.mjs'), 'utf8');

    expect(example).toContain('SHOPIFY_STORE_DOMAIN=');
    expect(example).toContain(`SHOPIFY_API_VERSION=${SHOPIFY_STOREFRONT_API_VERSION}`);
    expect(example).toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN=');
    expect(example).not.toMatch(/PUBLIC_SHOPIFY/);
    expect(example).not.toContain('SHOPIFY_USE_CATALOG');
    expect(astroConfig).toContain('SHOPIFY_STORE_DOMAIN:');
    expect(astroConfig).toContain('SHOPIFY_API_VERSION:');
    expect(astroConfig).toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN:');
    expect(astroConfig).not.toContain('SHOPIFY_USE_CATALOG');
    expect(astroConfig).toContain("access: 'secret'");
    expect(astroConfig).toContain('MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH');
  });

  test('el catálogo y el carrito tienen fallback demo y proveedor Shopify server-side', () => {
    const catalogRoot = readFileSync(join(root, 'src/commerce/catalog.ts'), 'utf8');
    const cartRoot = readFileSync(join(root, 'src/commerce/cart.ts'), 'utf8');
    const smoke = readFileSync(join(root, 'scripts/shopify-storefront-smoke.mjs'), 'utf8');

    expect(catalogRoot).toContain('demoCatalogAdapter');
    expect(catalogRoot).toContain('createShopifyCatalogAdapter');
    expect(catalogRoot).toContain('shopifyCatalogEnabled');
    expect(cartRoot).toContain('createDemoCartAdapter()');
    expect(cartRoot).toContain('createShopifyCartAdapter');
    expect(cartRoot).toContain('createHybridCartAdapter');
    expect(cartRoot).not.toContain('astro:env');
    expect(smoke).toContain('PUBLIC_SHOPIFY_STOREFRONT_TOKEN');
    expect(() => createShopifyStorefrontGateway({})).toThrow(ShopifyConfigurationError);
  });
});

describe('gateway Shopify Storefront', () => {
  test('construye endpoint, método, autenticación privada y variables GraphQL', async () => {
    const { requests, fetch } = captureRequest();
    const storefront = createShopifyStorefrontGateway(validConfig, { fetch });
    const variables = { handle: 'sample-product', first: 3 };

    await expect(storefront.graphql('query Test($handle: String!) { shop { name } }', variables))
      .resolves.toEqual({ shop: { name: 'KingBelt Test' } });

    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe(
      'https://kingbelt-test.myshopify.com/api/2026-07/graphql.json'
    );
    expect(requests[0].init.method).toBe('POST');
    expect(requests[0].init.redirect).toBe('manual');
    expect(requests[0].init.cache).toBe('no-store');
    expect(requests[0].init.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': testToken,
    });
    expect(JSON.parse(requests[0].init.body)).toEqual({
      query: 'query Test($handle: String!) { shop { name } }',
      variables,
    });
  });

  test('envía Buyer-IP solo cuando es una dirección válida', async () => {
    const { requests, fetch } = captureRequest();
    const storefront = createShopifyStorefrontGateway(validConfig, {
      fetch,
      buyerIp: '203.0.113.10',
    });

    await storefront.graphql('query { shop { name } }');
    expect(requests[0].init.headers['Shopify-Storefront-Buyer-IP']).toBe('203.0.113.10');
    expect(requests[0].init.headers['Shopify-Storefront-Private-Token']).toBe(testToken);

    expect(() => createShopifyStorefrontGateway(validConfig, { buyerIp: 'not-an-ip' }))
      .toThrow(ShopifyConfigurationError);
    expect(() => createShopifyStorefrontGateway(validConfig, { buyerIp: '203.0.113.10\r\nX-Injected: 1' }))
      .toThrow(ShopifyConfigurationError);
  });

  test('distingue fallo HTTP sin incorporar body ni token al error', async () => {
    const fetch = async () => new Response(
      JSON.stringify({ error: `remote body contains ${testToken}` }),
      { status: 401 }
    );
    const storefront = createShopifyStorefrontGateway(validConfig, { fetch });

    try {
      await storefront.graphql('query { shop { name } }');
      throw new Error('Expected HTTP failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyStorefrontRequestError);
      expect(error.kind).toBe('http');
      expect(error.status).toBe(401);
      expect(error.message).not.toContain(testToken);
      expect(error.message).not.toContain('remote body');
    }
  });

  test('rechaza JSON inválido, data nula y errores de red', async () => {
    const invalidJson = createShopifyStorefrontGateway(validConfig, {
      fetch: async () => new Response('{not-json'),
    });
    await expect(invalidJson.graphql('query { shop { name } }'))
      .rejects.toMatchObject({ kind: 'invalid_json' });

    const nullData = createShopifyStorefrontGateway(validConfig, {
      fetch: async () => new Response(JSON.stringify({ data: null })),
    });
    await expect(nullData.graphql('query { shop { name } }'))
      .rejects.toMatchObject({ kind: 'invalid_response' });

    const network = createShopifyStorefrontGateway(validConfig, {
      fetch: async () => { throw new TypeError('fetch failed'); },
    });
    await expect(network.graphql('query { shop { name } }'))
      .rejects.toMatchObject({ kind: 'network' });

    const { fetch } = captureRequest();
    const emptyQuery = createShopifyStorefrontGateway(validConfig, { fetch });
    await expect(emptyQuery.graphql('   ')).rejects.toBeInstanceOf(ShopifyConfigurationError);
  });

  test('rechaza errors GraphQL aunque exista data parcial y redacta el token', async () => {
    const storefront = createShopifyStorefrontGateway(validConfig, {
      fetch: async () => new Response(JSON.stringify({
        data: { shop: { name: 'Partial' } },
        errors: [{
          message: `Access denied for ${testToken}`,
          extensions: { code: 'ACCESS_DENIED' },
        }],
      })),
    });

    try {
      await storefront.graphql('query { shop { name } }');
      throw new Error('Expected GraphQL failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyStorefrontRequestError);
      expect(error.kind).toBe('graphql');
      expect(error.message).toContain('ACCESS_DENIED');
      expect(error.message).toContain('[redacted]');
      expect(error.message).not.toContain(testToken);
    }
  });

  test('aborta por timeout con un error técnico seguro', async () => {
    const fetch = (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const storefront = createShopifyStorefrontGateway(validConfig, { fetch, timeoutMs: 5 });

    await expect(storefront.graphql('query { shop { name } }'))
      .rejects.toMatchObject({ kind: 'timeout' });
  });
});
