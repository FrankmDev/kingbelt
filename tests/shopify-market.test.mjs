import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createShopifyCatalogQueries } from '../src/commerce/infrastructure/shopify/catalog-runtime-query.ts';
import { createShopifyCartService } from '../src/commerce/infrastructure/shopify/shopify-cart.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_SUPPORTED_CURRENCIES,
  shopifyCartBuyerIdentity,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  pageInfo,
  SHOPIFY_CATALOG_TEST_HOSTS as HOSTS,
  productSummaryNode,
  validShopifyCatalogPayload,
} from './fixtures/shopify-catalog-payload.mjs';

const root = resolve(import.meta.dir, '..');
const checkoutHosts = ['kingbelt.myshopify.com', 'checkout.shopify.com'];

describe('contexto operativo de mercado Shopify', () => {
  test('fija España, español y EUR en una sola definición versionada', () => {
    expect(SHOPIFY_MARKET_CONTEXT).toEqual({
      country: 'ES',
      language: 'ES',
      currency: 'EUR',
    });
    expect(SHOPIFY_SUPPORTED_CURRENCIES).toEqual([SHOPIFY_MARKET_CONTEXT.currency]);
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    expect(example).not.toContain('SHOPIFY_COUNTRY');
    expect(example).not.toContain('SHOPIFY_LANGUAGE');
    expect(example).not.toContain('SHOPIFY_CURRENCY');
  });

  test('producto, colección y cartCreate usan el mismo mercado efectivo', async () => {
    const payload = validShopifyCatalogPayload();
    const catalogQueries = [];
    const runtime = createShopifyCatalogQueries({
      async graphql(query, variables) {
        catalogQueries.push({ query, variables });
        if (query.includes('KingBeltProductByHandle')) {
          return { product: payload.products[0] };
        }
        if (query.includes('KingBeltCollectionByHandle')) {
          return {
            collection: {
              ...payload.collections[0],
              products: { nodes: [productSummaryNode(payload.products[0])], pageInfo },
            },
          };
        }
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      },
    }, HOSTS);
    const product = await runtime.getProductByHandle('cinturon-atlas');
    const collection = await runtime.getCollectionByHandle('sport');

    const cartQueries = [];
    await createShopifyCartService({
      async graphql(query, variables) {
        cartQueries.push({ query, variables });
        return {
          cartCreate: {
            cart: {
              id: 'gid://shopify/Cart/test',
              checkoutUrl: 'https://kingbelt.myshopify.com/checkouts/cn/test',
              buyerIdentity: { countryCode: SHOPIFY_MARKET_CONTEXT.country },
              cost: { subtotalAmount: { amount: '59.90', currencyCode: 'EUR' } },
              lines: { nodes: [] },
            },
            userErrors: [],
            warnings: [],
          },
        };
      },
    }, checkoutHosts).add(undefined, 'gid://shopify/ProductVariant/1', 1);

    const create = cartQueries.find((item) => item.query.includes('mutation CartCreate'));
    expect(product).toBeDefined();
    expect(collection).toBeDefined();
    expect(create).toBeDefined();
    catalogQueries.forEach(({ query, variables }) => {
      expect(query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    });
    expect(create.variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
    expect(create.variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    expect(create.variables.input.buyerIdentity).toEqual(shopifyCartBuyerIdentity());
    expect(product.variants[0].price.currency).toBe(SHOPIFY_MARKET_CONTEXT.currency);
  });

  test('el navegador no puede enviar ni arbitrar countryCode', () => {
    const adapter = readFileSync(
      join(root, 'src/commerce/infrastructure/shopify/shopify-cart-adapter.ts'),
      'utf8'
    );
    const apiCart = readFileSync(join(root, 'src/pages/api/cart.ts'), 'utf8');
    const cartUi = readFileSync(join(root, 'src/scripts/commerce/cart-controller.ts'), 'utf8');
    expect(adapter).not.toMatch(/countryCode|buyerIdentity|currency|language/);
    expect(adapter).toContain("command: 'add'");
    expect(adapter).toContain('variantId: input.variantId');
    expect(apiCart).toContain("command: 'add'; variantId: string; quantity: number");
    expect(apiCart).not.toMatch(/body\.(country|countryCode|language|currency)/);
    expect(cartUi).not.toMatch(/searchParams\.(set|append)\(['"](?:country|currency|language)/);
  });

  test('checkout no añade parámetros manuales de mercado', () => {
    const cartService = readFileSync(
      join(root, 'src/commerce/infrastructure/shopify/shopify-cart.ts'),
      'utf8'
    );
    const redirect = readFileSync(
      join(root, 'src/commerce/application/checkout-redirect.ts'),
      'utf8'
    );
    expect(cartService).toContain('remote.checkoutUrl');
    expect(cartService).not.toMatch(/searchParams\.(set|append)/);
    expect(cartService).not.toMatch(/checkoutUrl\s*\+/);
    expect(redirect).not.toMatch(/country|currency|language/);
  });
});
