import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import astroConfiguration from '../astro.config.mjs';
import {
  getShopifyStorefrontConfig,
  inspectShopifyStoreDomain,
  normalizeShopifyStoreDomain,
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
  test('normaliza solo mayúsculas del hostname y fija la versión soportada', () => {
    expect(getShopifyStorefrontConfig({
      ...validConfig,
      storeDomain: 'KingBelt-Test.MyShopify.com',
    })).toEqual(validConfig);
    expect(() => getShopifyStorefrontConfig({ ...validConfig, storeDomain: undefined }))
      .toThrow('Missing required Shopify configuration: SHOPIFY_STORE_DOMAIN');
  });

  test('rechaza dominio ausente o fuera del hostname exacto de Shopify', () => {
    const invalidDomains = [
      undefined,
      '',
      'kingbelt.es',
      'https://kingbelt.es',
      'admin.shopify.com/store/tienda',
      'https://admin.shopify.com/store/tienda',
      'kingbelt-store.shopify.com',
      'https://kingbelt-store.shopify.com',
      'kingbelt.myshopify.com/products',
      'kingbelt.myshopify.com?preview=1',
      'kingbelt.myshopify.com#catalog',
      'kingbelt.myshopify.com.evil.test',
      'user@kingbelt.myshopify.com',
      'https://user:pass@kingbelt.myshopify.com',
      'kingbelt.myshopify.com:443',
      'host:443',
      'kingbelt test.myshopify.com',
      ' kingbelt.myshopify.com',
      'kingbelt.myshopify.com ',
      'https://kingbelt.myshopify.com',
      'http://kingbelt.myshopify.com/',
      'kingbelt.myshopify.com/',
      '"kingbelt.myshopify.com"',
    ];

    invalidDomains.forEach((storeDomain) => {
      expect(() => getShopifyStorefrontConfig({ ...validConfig, storeDomain }))
        .toThrow(ShopifyConfigurationError);
    });
  });

  test('documenta la normalización y el rechazo de SHOPIFY_STORE_DOMAIN', () => {
    expect(normalizeShopifyStoreDomain('tienda.myshopify.com')).toBe('tienda.myshopify.com');
    expect(() => normalizeShopifyStoreDomain('https://tienda.myshopify.com'))
      .toThrow(ShopifyConfigurationError);
    expect(() => normalizeShopifyStoreDomain('tienda.myshopify.com/'))
      .toThrow(ShopifyConfigurationError);
    expect(normalizeShopifyStoreDomain('kingbelt-store.myshopify.com')).toBe('kingbelt-store.myshopify.com');
    expect(() => normalizeShopifyStoreDomain('admin.shopify.com/store/tienda'))
      .toThrow(ShopifyConfigurationError);
    expect(() => normalizeShopifyStoreDomain('kingbelt-store.shopify.com'))
      .toThrow(ShopifyConfigurationError);
    expect(() => normalizeShopifyStoreDomain('kingbelt.es'))
      .toThrow(ShopifyConfigurationError);

    const protocolUrl = 'https://tienda.myshopify.com/';
    expect(inspectShopifyStoreDomain(protocolUrl)).toEqual({
      name: 'SHOPIFY_STORE_DOMAIN',
      exists: true,
      length: protocolUrl.length,
      hasProtocol: true,
      hasSlash: true,
      hasWhitespace: false,
      hasQuotes: false,
    });
    expect(inspectShopifyStoreDomain(' "kingbelt.es" ')).toMatchObject({
      exists: true,
      hasQuotes: true,
      hasWhitespace: true,
    });
    expect(inspectShopifyStoreDomain(undefined)).toEqual({
      name: 'SHOPIFY_STORE_DOMAIN',
      exists: false,
      length: 0,
      hasProtocol: false,
      hasSlash: false,
      hasWhitespace: false,
      hasQuotes: false,
    });
  });

  test('rechaza una versión distinta o latest y exige token privado de Storefront', () => {
    expect(() => getShopifyStorefrontConfig({ ...validConfig, apiVersion: 'latest' }))
      .toThrow(`SHOPIFY_API_VERSION must be the pinned version ${SHOPIFY_STOREFRONT_API_VERSION}.`);
    expect(() => getShopifyStorefrontConfig({ ...validConfig, apiVersion: '2026-04' }))
      .toThrow(ShopifyConfigurationError);
    expect(() => getShopifyStorefrontConfig({ ...validConfig, storefrontToken: undefined }))
      .toThrow('Missing required Shopify configuration: SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
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

    expect(example).toContain('COMMERCE_SOURCE=demo');
    expect(astroConfig).toContain('COMMERCE_SOURCE: envField.enum({');
    expect(astroConfig).toContain("context: 'client'");
    expect(astroConfig).toContain("values: ['demo', 'shopify']");
    expect(astroConfig).not.toContain('PUBLIC_COMMERCE_SOURCE');
    expect(astroConfiguration.env.schema.COMMERCE_SOURCE).toEqual({
      context: 'client',
      access: 'public',
      values: ['demo', 'shopify'],
      type: 'enum',
    });
    expect(example).toContain('SHOPIFY_STORE_DOMAIN=');
    expect(example).toContain(`SHOPIFY_API_VERSION=${SHOPIFY_STOREFRONT_API_VERSION}`);
    expect(example).toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN=');
    expect(example).toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL=');
    expect(example).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(example).not.toMatch(/PUBLIC_SHOPIFY/);
    expect(example).not.toContain('SHOPIFY_USE_CATALOG');
    expect(astroConfig).toContain('SHOPIFY_STORE_DOMAIN:');
    expect(astroConfig).toContain('SHOPIFY_API_VERSION:');
    expect(astroConfig).toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN:');
    expect(astroConfig).toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL:');
    expect(astroConfig).toContain('MAX_HOSTED_URL_LENGTH');
    expect(astroConfig).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(astroConfig).not.toContain('PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(astroConfig).not.toContain('SHOPIFY_CART_COOKIE_SECRET');
    expect(astroConfig).toContain('SHOPIFY_WEBHOOK_SECRET:');
    expect(astroConfig).toContain('sessionDriverConfig');
    expect(astroConfig).toContain('SESSION_COOKIE_NAME');
    expect(example).toContain('UPSTASH_REDIS_REST_URL=');
    expect(example).toContain('UPSTASH_REDIS_REST_TOKEN=');
    expect(example).not.toContain('SHOPIFY_CART_COOKIE_SECRET');
    expect(astroConfig).toContain('VERCEL_DEPLOY_HOOK_URL:');
    expect(astroConfig).not.toContain('SHOPIFY_USE_CATALOG');
    expect(astroConfig).toContain("access: 'secret'");
    expect(astroConfig).toContain('MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH');
    expect(astroConfiguration.env.schema.SHOPIFY_STOREFRONT_PRIVATE_TOKEN).toMatchObject({
      context: 'server',
      access: 'secret',
      optional: true,
    });
    expect(astroConfiguration.env.schema.SHOPIFY_WEBHOOK_SECRET).toMatchObject({
      context: 'server',
      access: 'secret',
      optional: true,
    });
    expect(astroConfiguration.env.schema.VERCEL_DEPLOY_HOOK_URL).toMatchObject({
      context: 'server',
      access: 'secret',
      optional: true,
    });
    expect(astroConfiguration.env.schema.SHOPIFY_STORE_DOMAIN).toMatchObject({
      context: 'server',
      access: 'public',
      optional: true,
    });
    expect(astroConfiguration.env.schema.SHOPIFY_CUSTOMER_ACCOUNT_URL).toMatchObject({
      context: 'server',
      access: 'public',
      optional: true,
    });
    expect(astroConfiguration.env.schema.SHOPIFY_CART_COOKIE_SECRET).toBeUndefined();
    expect(astroConfiguration.session.cookie.name).toBe('__Host-kingbelt-session');
    expect(astroConfiguration.session.cookie.httpOnly).toBeUndefined();
    expect(astroConfiguration.session.cookie.secure).toBe(true);
    expect(astroConfiguration.session.cookie.sameSite).toBe('lax');
    expect(astroConfiguration.session.cookie.path).toBe('/');
    expect(astroConfiguration.session.cookie.domain).toBeUndefined();
    expect(astroConfiguration.session.cookie.maxAge).toBe(60 * 60 * 24 * 30);
    expect(astroConfiguration.session.ttl).toBe(60 * 60 * 24 * 30);
    expect(astroConfiguration.session.cookie.maxAge).toBe(astroConfiguration.session.ttl);
    expect(astroConfig).not.toContain('httpOnly: true');
    expect(astroConfig).not.toContain('@ts-expect-error');
    expect(astroConfig).toContain('sessionDriverConfig');
    expect(astroConfig).not.toContain('process.env.UPSTASH_REDIS_REST_URL');
    expect(astroConfig).not.toContain('process.env.UPSTASH_REDIS_REST_TOKEN');
    expect(astroConfig).not.toContain('sessionDrivers.redis');
    expect(astroConfiguration.env.schema.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(astroConfiguration.env.schema.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  test('el catálogo y el carrito comparten una selección explícita', () => {
    const catalogRoot = readFileSync(join(root, 'src/commerce/catalog.ts'), 'utf8');
    const cartRoot = readFileSync(join(root, 'src/commerce/cart.ts'), 'utf8');
    const sourceRoot = readFileSync(join(root, 'src/commerce/commerce-source.ts'), 'utf8');
    const smoke = readFileSync(join(root, 'scripts/shopify-storefront-smoke.mjs'), 'utf8');

    expect(sourceRoot).toContain("import { COMMERCE_SOURCE } from 'astro:env/client'");
    expect(sourceRoot).toContain("export type CommerceSource = 'demo' | 'shopify'");
    expect(sourceRoot).toContain('resolveCommerceSource');
    expect(sourceRoot).toContain('isShopifyCommerce');
    expect(sourceRoot).not.toContain('VERCEL_ENV');
    expect(catalogRoot).toContain('selectCommerceProvider');
    expect(catalogRoot).toContain('getCatalogProvider');
    expect(catalogRoot).toContain('createConfiguredShopifyBuyerStorefrontGateway');
    expect(catalogRoot).toContain('createResourceCache');
    expect(catalogRoot).not.toContain('export const catalogProvider');
    expect(catalogRoot).toContain('demoCatalogAdapter');
    expect(catalogRoot).toContain("import('./infrastructure/demo/demo-catalog-adapter')");
    expect(catalogRoot).toContain('createShopifyCatalogAdapter');
    expect(catalogRoot).toContain("import('./infrastructure/shopify/catalog-adapter')");
    expect(catalogRoot).not.toContain('shopifyCatalogEnabled');
    expect(catalogRoot).not.toContain('SHOPIFY_STORE_DOMAIN');
    expect(catalogRoot).not.toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
    expect(cartRoot).toContain('selectCommerceProvider');
    expect(cartRoot).toContain('createDemoCartAdapter()');
    expect(cartRoot).toContain('createShopifyCartAdapter');
    expect(sourceRoot).not.toContain('Boolean(');
    expect(catalogRoot).not.toContain('Boolean(');
    expect(cartRoot).not.toContain('Boolean(');
    expect(cartRoot).not.toContain('astro:env');
    expect(smoke).toContain('PUBLIC_SHOPIFY_STOREFRONT_TOKEN');
    expect(smoke).not.toContain('buyerIp');
    expect(smoke).not.toContain('Shopify-Storefront-Buyer-IP');
    expect(smoke).toContain('createShopifyStorefrontGateway({');
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
    expect(requests[0].init.headers).not.toHaveProperty('Shopify-Storefront-Buyer-IP');
    expect(JSON.parse(requests[0].init.body)).toEqual({
      query: 'query Test($handle: String!) { shop { name } }',
      variables,
    });
    expect(requests[0].init.headers).not.toHaveProperty('Shopify-Storefront-Buyer-Country');
    expect(JSON.stringify(requests[0].init.headers)).not.toMatch(/CountryCode|LanguageCode/i);
  });

  test('envía Buyer-IP solo cuando es una dirección válida', async () => {
    const accepted = ['203.0.113.10', '2001:db8::1', '::1', '::ffff:192.0.2.128'];
    for (const buyerIp of accepted) {
      const { requests, fetch } = captureRequest();
      await createShopifyStorefrontGateway(validConfig, { fetch, buyerIp })
        .graphql('query { shop { name } }');
      expect(requests[0].init.headers['Shopify-Storefront-Buyer-IP']).toBe(buyerIp);
      expect(requests[0].init.headers['Shopify-Storefront-Private-Token']).toBe(testToken);
      expect(requests[0].init.headers).not.toHaveProperty('X-Shopify-Storefront-Buyer-IP');
    }

    const rejected = [
      'not-an-ip',
      'foo',
      'localhost',
      '203.0.113.10:443',
      '1.2.3',
      '999.1.1.1',
      ' 203.0.113.10',
      '203.0.113.10 ',
      '203.0.113.10\r\nX-Test: injected',
    ];
    for (const buyerIp of rejected) {
      expect(() => createShopifyStorefrontGateway(validConfig, { buyerIp }))
        .toThrow('Shopify-Storefront-Buyer-IP must be an IPv4 or IPv6 address.');
    }
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
