import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createShopifyCartService } from '../src/commerce/infrastructure/shopify/shopify-cart.ts';
import {
  SHOPIFY_CART_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  shopifyCartBuyerIdentity,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  interpretShopifyCartMutation,
  mapShopifyCart,
  mapShopifyCartAvailability,
  mapShopifyCartErrorCode,
  previousLinesFromQuantitySnapshot,
  wouldExceedShopifyCartLineLimit,
  SHOPIFY_CART_OVERFLOW_MESSAGE,
  SHOPIFY_CART_UPDATED_NOTICE,
  SHOPIFY_NOT_ENOUGH_STOCK_NOTICE,
  SHOPIFY_OUT_OF_STOCK_NOTICE,
  SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE,
} from '../src/commerce/infrastructure/shopify/shopify-cart-mappers.ts';
import { MAX_CART_LINES, MAX_CART_LINES_MESSAGE } from '../src/commerce/domain/cart.ts';
import { TECHNICAL_LINE_QUANTITY_LIMIT } from '../src/commerce/domain/inventory.ts';
import { isQuantityAllowed } from '../src/commerce/domain/inventory.ts';
import { ShopifyStorefrontRequestError } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';

const root = resolve(import.meta.dir, '..');
const checkoutHosts = ['kingbelt.myshopify.com'];
const VARIANT_A = 'gid://shopify/ProductVariant/111';
const VARIANT_B = 'gid://shopify/ProductVariant/222';
const VARIANT_C = 'gid://shopify/ProductVariant/333';
const LINE_A = 'gid://shopify/CartLine/line-a';
const CONTEXTUAL_LINE_A = `${LINE_A}?cart=${'a'.repeat(32)}`;
const LINE_B = 'gid://shopify/CartLine/line-b';
const LINE_C = 'gid://shopify/CartLine/line-c';
const LINE_MISSING = 'gid://shopify/CartLine/line-missing';
const CART_ID = 'gid://shopify/Cart/test-cart';
const NEW_CART_ID = 'gid://shopify/Cart/new-cart';
const CHECKOUT_URL = 'https://kingbelt.myshopify.com/checkouts/cn/test';

const money = (amount = '89.00') => ({ amount, currencyCode: 'EUR' });

const PRIMARY_COLLECTION = {
  type: 'collection_reference',
  reference: {
    __typename: 'Collection',
    id: 'gid://shopify/Collection/1',
    handle: 'sport',
    title: 'Sport',
  },
};

const merchandise = (id, {
  availableForSale = true,
  currentlyNotInStock = false,
  quantityRule = { minimum: 1, increment: 1, maximum: null },
  handle = 'cinturon-test',
  modelReference = null,
  primaryCollection = PRIMARY_COLLECTION,
  productType,
} = {}) => ({
  id,
  title: 'Negro / 90',
  availableForSale,
  currentlyNotInStock,
  quantityRule,
  selectedOptions: [{ name: 'Color', value: 'Negro' }, { name: 'Talla', value: '90' }],
  image: {
    id: `gid://shopify/MediaImage/${id.split('/').at(-1)}`,
    url: 'https://cdn.shopify.com/s/files/1/test.jpg',
    width: 800,
    height: 1000,
    altText: 'Cinturón de prueba',
  },
  product: {
    id: 'gid://shopify/Product/1',
    handle,
    title: 'Cinturón de prueba',
    modelReference,
    primaryCollection,
    featuredImage: null,
    ...(productType === undefined ? {} : { productType }),
  },
});

const remoteLine = (id, variantId, quantity, options = {}) => ({
  id,
  quantity,
  cost: {
    amountPerQuantity: money(),
    totalAmount: money((89 * quantity).toFixed(2)),
  },
  merchandise: merchandise(variantId, options),
});

const numberedVariantId = (n) => `gid://shopify/ProductVariant/${n}`;
const numberedLineId = (n) => `gid://shopify/CartLine/line-${n}`;
const remoteLines = (count, start = 1) =>
  Array.from({ length: count }, (_, index) => {
    const n = start + index;
    return remoteLine(numberedLineId(n), numberedVariantId(n), 1);
  });

const remoteCart = ({
  lines = [remoteLine(LINE_A, VARIANT_A, 1)],
  checkoutUrl = CHECKOUT_URL,
  totalQuantity,
  buyerIdentity = { countryCode: SHOPIFY_MARKET_CONTEXT.country },
  id = CART_ID,
} = {}) => ({
  id,
  checkoutUrl,
  buyerIdentity,
  totalQuantity: totalQuantity ?? lines.reduce((sum, line) => sum + line.quantity, 0),
  cost: { subtotalAmount: money(lines.reduce((sum, line) => sum + (89 * line.quantity), 0).toFixed(2)) },
  lines: { nodes: lines },
});

const payload = ({ cart = remoteCart(), userErrors = [], warnings = [] } = {}) => ({
  cart,
  userErrors,
  warnings,
});

const operationName = (query) => {
  if (query.includes('mutation CartCreate')) return 'create';
  if (query.includes('mutation CartLinesAdd')) return 'add';
  if (query.includes('mutation CartLinesUpdate')) return 'update';
  if (query.includes('mutation CartLinesRemove')) return 'remove';
  if (query.includes('mutation CartBuyerIdentityUpdate')) return 'identity';
  if (query.includes('query CartLineQuantities')) return 'quantities';
  if (query.includes('query Cart(')) return 'get';
  return 'unknown';
};

const createGateway = (handlers) => {
  const queries = [];
  return {
    queries,
    graphql: async (query, variables) => {
      const name = operationName(query);
      queries.push({ name, query, variables });
      const handler = handlers[name];
      if (!handler) throw new Error(`Unexpected Storefront operation ${name}`);
      return handler(query, variables);
    },
  };
};

const createService = (handlers) => {
  const gateway = createGateway(handlers);
  return { ...createShopifyCartService(gateway, checkoutHosts), gateway };
};

describe('consulta GraphQL del carrito Shopify', () => {
  test('todas las mutaciones piden warnings, CartErrorCode y el ProductVariant real', async () => {
    const { gateway, ...service } = createService({
      create: () => ({ cartCreate: payload() }),
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({ cartLinesAdd: payload() }),
      update: () => ({ cartLinesUpdate: payload() }),
      remove: () => ({ cartLinesRemove: payload() }),
    });

    await service.add(undefined, VARIANT_A, 1);
    await service.add(CART_ID, VARIANT_A, 1);
    await service.update(CART_ID, LINE_A, 2);
    await service.remove(CART_ID, LINE_A);

    const mutations = gateway.queries.filter((item) =>
      ['create', 'add', 'update', 'remove'].includes(item.name)
    );
    expect(mutations.map((item) => item.name).sort()).toEqual(['add', 'create', 'remove', 'update']);
    mutations.forEach(({ query }) => {
      expect(query).toContain('warnings { code message target }');
      expect(query).toContain('userErrors { field message code }');
      expect(query).toContain('availableForSale');
      expect(query).toContain('currentlyNotInStock');
      expect(query).toContain('quantityRule { minimum increment maximum }');
      expect(query).toContain('modelReference: metafield(namespace: "kingbelt", key: "model_reference")');
      expect(query).toContain(
        `primaryCollection: metafield(namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}", key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}")`
      );
      expect(query).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
      expect(query).toContain('... on Collection { id handle title }');
      expect(query).toContain('buyerIdentity { countryCode }');
      expect(query).toContain('currencyCode');
      expect(query).toContain(SHOPIFY_CART_IN_CONTEXT_DIRECTIVE);
      expect(query).not.toContain('$country');
      expect(query).not.toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(query).not.toMatch(/collections\s*\(/);
      expect(query).not.toContain('productType');
      expect(query).toContain('pageInfo { hasNextPage }');
    });

    const quantityReads = gateway.queries.filter((item) => item.name === 'quantities');
    expect(quantityReads).toHaveLength(1);
    expect(quantityReads[0].query).toContain('query CartLineQuantities');
    expect(quantityReads[0].query).toContain('pageInfo { hasNextPage }');
    expect(quantityReads[0].query).not.toContain('availableForSale');
    expect(quantityReads[0].query).not.toContain('image');
    expect(quantityReads[0].query).not.toContain('checkoutUrl');
    expect(quantityReads[0].query).not.toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(quantityReads[0].query).not.toContain(SHOPIFY_CART_IN_CONTEXT_DIRECTIVE);
    expect(gateway.queries.filter((item) => item.name === 'get')).toHaveLength(0);
  });

  test('añadir al carrito usa ProductVariant.id como merchandiseId, nunca el SKU', async () => {
    const sku = '0001008-100-CU-NA';
    const { gateway, ...service } = createService({
      create: (_query, variables) => {
        expect(variables.input.lines[0].merchandiseId).toBe(VARIANT_A);
        expect(variables.input.lines[0].merchandiseId).not.toBe(sku);
        return { cartCreate: payload({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }) }) };
      },
      quantities: () => ({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }) }),
      add: (_query, variables) => {
        expect(variables.lines[0].merchandiseId).toBe(VARIANT_A);
        expect(variables.lines[0].merchandiseId).not.toBe(sku);
        return { cartLinesAdd: payload({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 2)] }) }) };
      },
    });

    const created = await service.add(undefined, VARIANT_A, 1);
    const added = await service.add(CART_ID, VARIANT_A, 1);

    expect(created.success).toBe(true);
    expect(created.cart.lines[0].variantId).toBe(VARIANT_A);
    expect(added.success).toBe(true);
    expect(added.cart.lines[0].variantId).toBe(VARIANT_A);
    const cartVariables = gateway.queries
      .filter((item) => item.name === 'create' || item.name === 'add')
      .map((item) => JSON.stringify(item.variables));
    expect(cartVariables.every((value) => value.includes(VARIANT_A))).toBe(true);
    expect(cartVariables.some((value) => value.includes(sku))).toBe(false);
  });

  test('el código no clasifica errores Shopify parseando el texto del mensaje', () => {
    const files = [
      'src/commerce/infrastructure/shopify/shopify-cart.ts',
      'src/commerce/infrastructure/shopify/shopify-cart-mappers.ts',
    ].map((path) => readFileSync(join(root, path), 'utf8'));

    files.forEach((source) => {
      expect(source).not.toMatch(/\.message\.toLowerCase\(\)/);
      expect(source).not.toMatch(/error\.message\.includes\(/);
      expect(source).not.toMatch(/warning\.message\.includes\(/);
      expect(source).not.toMatch(/text\.includes\(['"]stock['"]\)/);
      expect(source).not.toMatch(/includes\(['"]inventory['"]\)/);
      expect(source).not.toMatch(/includes\(['"]available['"]\)/);
    });
  });
});

describe('máximo de líneas distintas en el provider Shopify', () => {
  test('add rechaza una variante nueva cuando ya hay 50 líneas y no llama a cartLinesAdd', async () => {
    const lines = remoteLines(MAX_CART_LINES);
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart({ lines }) }),
      get: () => ({ cart: remoteCart({ lines }) }),
      add: () => {
        throw new Error('cartLinesAdd must not run when the distinct-line limit is reached');
      },
    });

    const result = await service.add(CART_ID, numberedVariantId(MAX_CART_LINES + 1), 1);

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: 'validation',
      field: 'variant',
      message: MAX_CART_LINES_MESSAGE,
    });
    expect(result.cart.lines).toHaveLength(MAX_CART_LINES);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'get']);
  });

  test('add sigue permitiendo incrementar una variante ya presente en un Cart de 50 líneas', async () => {
    const lines = remoteLines(MAX_CART_LINES);
    const existingVariant = numberedVariantId(1);
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart({ lines }) }),
      add: () => ({
        cartLinesAdd: payload({
          cart: remoteCart({
            lines: [
              remoteLine(numberedLineId(1), existingVariant, 2),
              ...lines.slice(1),
            ],
          }),
        }),
      }),
    });

    const result = await service.add(CART_ID, existingVariant, 1);

    expect(result.success).toBe(true);
    expect(result.cart.lines).toHaveLength(MAX_CART_LINES);
    expect(result.cart.lines[0].quantity).toBe(2);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });
});

describe('CartErrorCode estructurado', () => {
  test('clasifica por code aunque el message sea deliberadamente engañoso', () => {
    expect(mapShopifyCartErrorCode('MAXIMUM_EXCEEDED', ['quantity'])).toBe('quantity_limit');
    expect(mapShopifyCartErrorCode('SERVICE_UNAVAILABLE')).toBe('provider_error');
    expect(mapShopifyCartErrorCode('INVALID_INCREMENT')).toBe('quantity_limit');
    expect(mapShopifyCartErrorCode('MINIMUM_NOT_MET')).toBe('quantity_limit');
    expect(mapShopifyCartErrorCode('LESS_THAN', ['quantity'])).toBe('quantity_limit');
    expect(mapShopifyCartErrorCode('LESS_THAN', ['note'])).toBe('validation');
    expect(mapShopifyCartErrorCode('INVALID_MERCHANDISE_LINE')).toBe('not_found');
    expect(mapShopifyCartErrorCode('MERCHANDISE_NOT_APPLICABLE')).toBe('unavailable');
    expect(mapShopifyCartErrorCode('CART_TOO_LARGE')).toBe('validation');
    expect(mapShopifyCartErrorCode('INVALID')).toBe('validation');
    expect(mapShopifyCartErrorCode('INVALID', ['cartId'])).toBe('not_found');
    expect(mapShopifyCartErrorCode('INVALID', ['note'])).toBe('validation');
    expect(mapShopifyCartErrorCode('UNRECOGNIZED_FUTURE_CODE')).toBe('provider_error');
  });

  test('una mutación con message tramposo usa el CartErrorCode, no las palabras', () => {
    const quantity = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        userErrors: [{
          code: 'MAXIMUM_EXCEEDED',
          message: 'completely arbitrary provider text',
          field: ['quantity'],
        }],
      }),
      { kind: 'update', lineId: LINE_A, requestedQuantity: 8 }
    );
    expect(quantity.success).toBe(false);
    expect(quantity.error.code).toBe('quantity_limit');
    expect(quantity.error.message).not.toBe('completely arbitrary provider text');
    expect(quantity.cart.lines).toHaveLength(1);

    const provider = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        userErrors: [{
          code: 'SERVICE_UNAVAILABLE',
          message: 'quantity stock available inventory',
        }],
      }),
      { kind: 'add', merchandiseId: VARIANT_A, requestedQuantity: 1 }
    );
    expect(provider.success).toBe(false);
    expect(provider.error.code).toBe('provider_error');
    expect(provider.cart.lines[0].quantity).toBe(1);
  });
});

describe('warnings de mutación', () => {
  test('CASO A: add sin warnings ni userErrors es success', async () => {
    const result = await createShopifyCartService(createGateway({
      create: () => ({ cartCreate: payload({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }) }) }),
    }), checkoutHosts).add(undefined, VARIANT_A, 1);
    expect(result.success).toBe(true);
    expect(result.cart.lines[0].quantity).toBe(1);
    expect(result.cart.canCheckout).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('CASO B: MERCHANDISE_NOT_ENOUGH_STOCK ajusta la cantidad y conserva el Cart', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 3)] }),
        warnings: [{
          code: 'MERCHANDISE_NOT_ENOUGH_STOCK',
          message: 'Not enough stock in warehouse west',
          target: LINE_A,
        }],
      }),
      { kind: 'create', merchandiseId: VARIANT_A, requestedQuantity: 5 }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines[0].quantity).toBe(3);
    expect(result.adjustedQuantity).toBe(3);
    expect(result.notice).toMatchObject({ code: 'quantity_adjusted', message: SHOPIFY_NOT_ENOUGH_STOCK_NOTICE });
    expect(result.cart.lineErrors.some((error) => error.lineId === LINE_A && error.severity === 'notice')).toBe(true);
    expect(result.cart.canCheckout).toBe(true);
  });

  test('CASO C: MERCHANDISE_OUT_OF_STOCK al añadir no mete la variante y conserva el resto', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        warnings: [{
          code: 'MERCHANDISE_OUT_OF_STOCK',
          message: 'The product is already sold out.',
          target: LINE_C,
        }],
      }),
      {
        kind: 'add',
        merchandiseId: VARIANT_C,
        requestedQuantity: 1,
        previousLines: [{ id: LINE_A, variantId: VARIANT_A, quantity: 1 }],
      }
    );
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('out_of_stock');
    expect(result.cart.lines.map((line) => line.variantId)).toEqual([VARIANT_A]);
    expect(result.cart.globalNotice).toBe(SHOPIFY_OUT_OF_STOCK_NOTICE);
  });

  test('CASO D: warning de otra línea no falla el alta de la variante pedida', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_C, VARIANT_C, 1)] }),
        warnings: [{
          code: 'MERCHANDISE_OUT_OF_STOCK',
          message: 'Line A sold out during another add.',
          target: LINE_A,
        }],
      }),
      {
        kind: 'add',
        merchandiseId: VARIANT_C,
        requestedQuantity: 1,
        previousLines: [
          { id: LINE_A, variantId: VARIANT_A, quantity: 1 },
          { id: LINE_B, variantId: VARIANT_B, quantity: 1 },
        ],
      }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines.map((line) => line.variantId)).toEqual([VARIANT_C]);
    expect(result.notice).toMatchObject({ code: 'product_removed', message: SHOPIFY_OUT_OF_STOCK_NOTICE });
    expect(result.cart.globalNotice).toBe(SHOPIFY_OUT_OF_STOCK_NOTICE);
    expect(result.cart.lines.some((line) => line.id === LINE_A)).toBe(false);
  });

  test('MERCHANDISE_OUT_OF_STOCK retira la línea afectada y no la reconstruye', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        warnings: [{
          code: 'MERCHANDISE_OUT_OF_STOCK',
          message: 'warehouse internals',
          target: LINE_B,
        }],
      }),
      { kind: 'update', lineId: LINE_A, requestedQuantity: 1 }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines.map((line) => line.id)).toEqual([LINE_A]);
    expect(result.cart.lines.some((line) => line.id === LINE_B)).toBe(false);
    expect(result.notice).toMatchObject({ code: 'product_removed', message: SHOPIFY_OUT_OF_STOCK_NOTICE });
  });

  test('CASO E: un warning desconocido no se ignora ni bloquea la operación', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 2)] }),
        warnings: [{
          code: 'DISCOUNT_NOT_FOUND',
          message: 'secret shopify internals XYZ',
          target: LINE_A,
        }],
      }),
      { kind: 'add', merchandiseId: VARIANT_A, requestedQuantity: 1, previousLines: [{ id: LINE_A, variantId: VARIANT_A, quantity: 1 }] }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines[0].quantity).toBe(2);
    expect(result.cart.globalNotice).toBe(SHOPIFY_CART_UPDATED_NOTICE);
    expect(result.notice?.message).toBe(SHOPIFY_CART_UPDATED_NOTICE);
    expect(JSON.stringify(result)).not.toContain('DISCOUNT_NOT_FOUND');
    expect(result.cart.canCheckout).toBe(true);
  });

  test('un warning futuro no rompe el Cart y usa el aviso genérico', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        warnings: [{
          code: 'FUTURE_WARNING',
          message: 'internal shopify warning text',
          target: LINE_A,
        }],
      }),
      { kind: 'update', lineId: LINE_A, requestedQuantity: 1 }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.globalNotice).toBe(SHOPIFY_CART_UPDATED_NOTICE);
    expect(result.error).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('FUTURE_WARNING');
  });

  test('CASO F: varios warnings se representan sin duplicar la misma clave', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({
          lines: [
            remoteLine(LINE_A, VARIANT_A, 2),
            remoteLine(LINE_C, VARIANT_C, 1),
          ],
        }),
        warnings: [
          { code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'a', target: LINE_A },
          { code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'a-dup', target: LINE_A },
          { code: 'PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION', message: 'b', target: LINE_MISSING },
          { code: 'SOME_NEW_CODE', message: 'c', target: LINE_C },
        ],
      }),
      {
        kind: 'add',
        merchandiseId: VARIANT_C,
        requestedQuantity: 1,
        previousLines: [{ id: LINE_A, variantId: VARIANT_A, quantity: 4 }],
      }
    );
    const stockNotices = result.cart.lineErrors.filter((error) =>
      error.lineId === LINE_A && error.code === 'quantity_adjusted' && error.severity === 'notice'
    );
    expect(stockNotices).toHaveLength(1);
    expect(result.cart.globalNotice).toContain(SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE);
    expect(result.cart.globalNotice).toContain(SHOPIFY_CART_UPDATED_NOTICE);
    expect(result.success).toBe(true);
  });

  test('detecta el ajuste de un add sobre una línea ya existente', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 4)] }),
        warnings: [{ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'adjusted', target: LINE_A }],
      }),
      {
        kind: 'add',
        merchandiseId: VARIANT_A,
        requestedQuantity: 6,
        previousLines: [{ id: LINE_A, variantId: VARIANT_A, quantity: 2 }],
      }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lines[0].quantity).toBe(4);
    expect(result.adjustedQuantity).toBe(4);
    expect(result.notice.code).toBe('quantity_adjusted');
  });

  test('PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION usa copy estable y el target de la línea', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({
          lines: [remoteLine(LINE_A, VARIANT_A, 1, { availableForSale: true })],
        }),
        warnings: [{
          code: 'PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION',
          message: 'Not available in buyer location internals',
          target: LINE_A,
        }],
      }),
      { kind: 'add', merchandiseId: VARIANT_A, requestedQuantity: 1 }
    );
    expect(result.success).toBe(true);
    expect(result.cart.lineErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lineId: LINE_A,
        code: 'unavailable',
        message: SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE,
        severity: 'notice',
      }),
    ]));
  });
});

describe('disponibilidad real del ProductVariant en Cart', () => {
  test('acepta ImageSource como GID de Image devuelto por Storefront', () => {
    const line = remoteLine(LINE_A, VARIANT_A, 1);
    line.merchandise.image.id = 'gid://shopify/ImageSource/real-storefront-image-1';
    expect(mapShopifyCart(remoteCart({ lines: [line] })).lines[0].product.image.id)
      .toBe(line.merchandise.image.id);
  });

  test('acepta CollectionImage como GID de Image de variante', () => {
    const line = remoteLine(LINE_A, VARIANT_A, 1);
    line.merchandise.image.id = 'gid://shopify/CollectionImage/123456789';
    expect(mapShopifyCart(remoteCart({ lines: [line] })).lines[0].product.image.id)
      .toBe('gid://shopify/CollectionImage/123456789');
  });

  test('un Product.id CollectionImage no es un GID de Product en Cart', () => {
    const line = remoteLine(LINE_A, VARIANT_A, 1);
    line.merchandise.product.id = 'gid://shopify/CollectionImage/123456789';
    expect(() => mapShopifyCart(remoteCart({ lines: [line] }))).toThrow(
      'line.merchandise.product.id'
    );
  });

  test('un Image ID no Shopify hace fallar el Cart completo', () => {
    const line = remoteLine(LINE_A, VARIANT_A, 1);
    line.merchandise.image.id = 'image-local-1';
    expect(() => mapShopifyCart(remoteCart({ lines: [line] }))).toThrow(
      'line.merchandise.image.id'
    );
  });

  test('availableForSale false no es comprable y bloquea checkout', () => {
    const availability = mapShopifyCartAvailability({
      availableForSale: false,
      currentlyNotInStock: false,
      quantityRule: { minimum: 1, increment: 1, maximum: null },
    });
    expect(availability).toMatchObject({
      status: 'unavailable',
      purchasable: false,
      quantityKnown: false,
      backorder: false,
    });
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1, { availableForSale: false, currentlyNotInStock: false })],
    }));
    expect(cart.canCheckout).toBe(false);
    expect(cart.lineErrors[0]).toMatchObject({ code: 'unavailable', severity: 'error' });
  });

  test('availableForSale true y currentlyNotInStock false es available sin stock exacto', () => {
    expect(mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 1, increment: 1, maximum: null },
    })).toMatchObject({
      status: 'available',
      purchasable: true,
      backorder: false,
      quantityKnown: false,
      maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
      limitReason: 'technical',
    });
  });

  test('currentlyNotInStock true sigue siendo comprable en backorder', () => {
    expect(mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: true,
      quantityRule: { minimum: 1, increment: 1, maximum: null },
    })).toMatchObject({
      status: 'available',
      purchasable: true,
      backorder: true,
      quantityKnown: false,
      message: 'Disponible para pedir.',
    });
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1, { availableForSale: true, currentlyNotInStock: true })],
    }));
    expect(cart.canCheckout).toBe(true);
  });

  test('usa la referencia comercial y custom.kingbelt_primary_collection, no el handle ni productType', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1, {
        modelReference: { value: 'ATLAS-35' },
        productType: 'NO-DEBE-USARSE',
        primaryCollection: {
          type: 'collection_reference',
          reference: {
            __typename: 'Collection',
            id: 'gid://shopify/Collection/1',
            handle: 'sport',
            title: 'Sport',
          },
        },
      })],
    }));
    expect(cart.lines[0].product.reference).toBe('ATLAS-35');
    expect(cart.lines[0].product.collection).toBe('Sport');
    expect(cart.lines[0].product.collection).not.toBe('NO-DEBE-USARSE');
  });

  test('CART_FIELDS pide custom.kingbelt_primary_collection y no product.collections', () => {
    const source = readFileSync(join(root, 'src/commerce/infrastructure/shopify/shopify-cart.ts'), 'utf8');
    const cartFields = source.match(/const CART_FIELDS = `([\s\S]*?)`;/)?.[1] ?? '';
    expect(cartFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace');
    expect(cartFields).toContain('SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key');
    expect(cartFields).not.toContain('key: "primary_collection"');
    expect(cartFields).toContain('modelReference: metafield(namespace: "kingbelt", key: "model_reference")');
    expect(cartFields).toContain('... on Collection { id handle title }');
    expect(cartFields).not.toMatch(/collections\s*\(/);
    expect(cartFields).not.toContain('productType');
  });

  test('usa el título de Collection de custom.kingbelt_primary_collection', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1, {
        primaryCollection: {
          type: SHOPIFY_PRIMARY_COLLECTION_METAFIELD.type,
          reference: {
            __typename: 'Collection',
            id: 'gid://shopify/Collection/10',
            handle: 'cinturones',
            title: 'Cinturones',
          },
        },
      })],
    }));
    expect(cart.lines[0].product.collection).toBe('Cinturones');
    expect(cart.canCheckout).toBe(true);
  });

  test('una custom.kingbelt_primary_collection inválida hace fallar el Cart completo', () => {
    const invalidLines = [
    {
      lines: [remoteLine(LINE_A, VARIANT_A, 1, { primaryCollection: null })],
    }, {
      lines: [remoteLine(LINE_A, VARIANT_A, 1, { primaryCollection: { type: 'single_line_text_field', reference: PRIMARY_COLLECTION.reference } })],
    }, {
      lines: [remoteLine(LINE_A, VARIANT_A, 1, { primaryCollection: { type: 'collection_reference', reference: null } })],
    }, {
      lines: [remoteLine(LINE_A, VARIANT_A, 1, {
        primaryCollection: {
          type: 'collection_reference',
          reference: { __typename: 'Product', id: 'gid://shopify/Product/1', handle: 'sport', title: 'Sport' },
        },
      })],
    }, {
      lines: [remoteLine(LINE_A, VARIANT_A, 1, {
        primaryCollection: {
          type: 'collection_reference',
          reference: { ...PRIMARY_COLLECTION.reference, title: '' },
        },
      })],
    }];
    invalidLines.forEach((input) => expect(() => mapShopifyCart(remoteCart(input))).toThrow());
  });

  test('una línea sin merchandise hace fallar el mapping completo', () => {
    expect(() => mapShopifyCart(remoteCart({
      lines: [{
        id: LINE_A,
        quantity: 2,
        cost: { amountPerQuantity: money(), totalAmount: money('178.00') },
        merchandise: null,
      }],
    }))).toThrow('merchandise is missing');
  });

  test('un producto malformado hace fallar el mapping completo', () => {
    const line = remoteLine(LINE_A, VARIANT_A, 1);
    line.merchandise.product.id = '';
    expect(() => mapShopifyCart(remoteCart({ lines: [line] })))
      .toThrow('line.merchandise.product.id');
  });

  test('una línea remota sin id utilizable hace fallar el mapping completo', () => {
    expect(() => mapShopifyCart(remoteCart({
      lines: [
        remoteLine(LINE_A, VARIANT_A, 1),
        {
          id: '',
          quantity: 1,
          cost: { amountPerQuantity: money(), totalAmount: money() },
          merchandise: null,
        },
      ],
    }))).toThrow('line.id');
  });

  test('conserva el CartLine ID contextual que devuelve Storefront', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(CONTEXTUAL_LINE_A, VARIANT_A, 1)],
    }));
    expect(cart.lines[0].id).toBe(CONTEXTUAL_LINE_A);
  });

  test('rechaza parámetros no contractuales en CartLine ID', () => {
    for (const id of [
      `${LINE_A}?key=secret`,
      `${LINE_A}?cart=`,
      `${LINE_A}?cart=${'a'.repeat(32)}&extra=1`,
      `${LINE_A}#fragment`,
    ]) {
      expect(() => mapShopifyCart(remoteCart({ lines: [remoteLine(id, VARIANT_A, 1)] })))
        .toThrow('line.id');
    }
  });

  test('un carrito truncado por paginación bloquea checkout', () => {
    const cart = mapShopifyCart({
      ...remoteCart(),
      lines: { nodes: [remoteLine(LINE_A, VARIANT_A, 1)], pageInfo: { hasNextPage: true } },
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.canCheckout).toBe(false);
    expect(cart.globalError).toBe(SHOPIFY_CART_OVERFLOW_MESSAGE);
  });

  test('el máximo comercial de líneas no bloquea un Cart con exactamente 50', () => {
    const cart = mapShopifyCart(remoteCart({ lines: remoteLines(MAX_CART_LINES) }));
    expect(cart.lines).toHaveLength(MAX_CART_LINES);
    expect(cart.canCheckout).toBe(true);
    expect(cart.globalError).toBeUndefined();
  });

  test('un Cart remoto con más de 50 líneas bloquea checkout aunque no esté truncado', () => {
    const cart = mapShopifyCart(remoteCart({ lines: remoteLines(MAX_CART_LINES + 1) }));
    expect(cart.lines).toHaveLength(MAX_CART_LINES + 1);
    expect(cart.canCheckout).toBe(false);
    expect(cart.globalError).toBe(MAX_CART_LINES_MESSAGE);
  });

  test('un snapshot de cantidades truncado no se usa para detectar ajustes', () => {
    const complete = previousLinesFromQuantitySnapshot({
      lines: {
        nodes: [{ id: LINE_A, quantity: 2, merchandise: { id: VARIANT_A } }],
        pageInfo: { hasNextPage: false },
      },
    });
    expect(complete).toEqual([{ id: LINE_A, variantId: VARIANT_A, quantity: 2 }]);
    expect(previousLinesFromQuantitySnapshot({
      lines: {
        nodes: [{ id: LINE_A, quantity: 2, merchandise: { id: VARIANT_A } }],
        pageInfo: { hasNextPage: true },
      },
    })).toBeUndefined();
  });

  test('el snapshot impide una variante nueva al llegar a 50 líneas, no una ya presente', () => {
    const atLimit = {
      lines: {
        nodes: remoteLines(MAX_CART_LINES).map((line) => ({
          id: line.id,
          quantity: line.quantity,
          merchandise: { id: line.merchandise.id },
        })),
        pageInfo: { hasNextPage: false },
      },
    };
    expect(wouldExceedShopifyCartLineLimit(atLimit, numberedVariantId(MAX_CART_LINES + 1))).toBe(true);
    expect(wouldExceedShopifyCartLineLimit(atLimit, numberedVariantId(1))).toBe(false);
    expect(wouldExceedShopifyCartLineLimit({
      lines: {
        nodes: [{ id: LINE_A, quantity: 1, merchandise: { id: VARIANT_A } }],
        pageInfo: { hasNextPage: false },
      },
    }, VARIANT_C)).toBe(false);
    expect(wouldExceedShopifyCartLineLimit({
      lines: {
        nodes: [{ id: LINE_A, quantity: 1, merchandise: { id: VARIANT_A } }],
        pageInfo: { hasNextPage: true },
      },
    }, VARIANT_C)).toBe(true);
  });
});

describe('quantityRule autoritativa', () => {
  test('sin máximo usa el límite técnico, no stock', () => {
    const availability = mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 1, increment: 1, maximum: null },
    });
    expect(availability).toMatchObject({
      minimum: 1,
      increment: 1,
      maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
      limitReason: 'technical',
    });
  });

  test('rechaza reglas que el contrato 1/1 no soporta', () => {
    expect(() => mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 2, increment: 2, maximum: 10 },
    })).toThrow('minimum=1 and increment=1');
  });

  test('un máximo superior al límite técnico no se presenta como stock', () => {
    const availability = mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 1, increment: 1, maximum: 500 },
    });
    expect(availability).toMatchObject({
      maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
      limitReason: 'technical',
    });
  });

  test('un máximo de quantityRule válido bloquea cantidades superiores', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 6, {
        quantityRule: { minimum: 1, increment: 1, maximum: 5 },
      })],
    }));
    expect(cart.canCheckout).toBe(false);
    expect(cart.lineErrors[0]).toMatchObject({ code: 'quantity_limit', severity: 'error' });
  });
});

describe('límite técnico de cantidad en el servicio Shopify', () => {
  test('rechaza cantidades fuera de 1..99 sin llamar al gateway', async () => {
    const { gateway, ...service } = createService({});
    const tooMany = await service.add(undefined, VARIANT_A, 100);
    const zero = await service.add(undefined, VARIANT_A, 0);
    const update = await service.update(CART_ID, LINE_A, 100);
    expect(tooMany.success).toBe(false);
    expect(zero.success).toBe(false);
    expect(update.success).toBe(false);
    expect(tooMany.error.code).toBe('validation');
    expect(gateway.queries).toHaveLength(0);
  });
});

describe('cart nulo y conservación del carrito', () => {
  test('cartCreate con cart null no es un vacío exitoso', async () => {
    const result = await createShopifyCartService(createGateway({
      create: () => ({ cartCreate: { cart: null, userErrors: [], warnings: [] } }),
    }), checkoutHosts).add(undefined, VARIANT_A, 1);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('provider_error');
    expect(result.cart.lines).toHaveLength(0);
  });

  test('cartLinesAdd con cart null no es un vacío exitoso', async () => {
    const result = await createShopifyCartService(createGateway({
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({ cartLinesAdd: { cart: null, userErrors: [], warnings: [] } }),
    }), checkoutHosts).add(CART_ID, VARIANT_C, 1);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('provider_error');
  });

  test('GET cart null es un carrito expirado o vacío, no un error de mutación', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: null }),
    }), checkoutHosts).get(CART_ID);
    expect(result.cart.lines).toHaveLength(0);
    expect(result.cart.canCheckout).toBe(false);
    expect(result.cartId).toBeUndefined();
  });

  test('userErrors conservan el cart autoritativo retornado', () => {
    const result = interpretShopifyCartMutation(
      payload({
        cart: remoteCart({
          lines: [
            remoteLine(LINE_A, VARIANT_A, 1),
            remoteLine(LINE_B, VARIANT_B, 2),
          ],
        }),
        userErrors: [{ code: 'INVALID_INCREMENT', message: 'bad increment text', field: ['quantity'] }],
      }),
      { kind: 'update', lineId: LINE_B, requestedQuantity: 3 }
    );
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('quantity_limit');
    expect(result.cart.lines).toHaveLength(2);
  });
});

describe('checkout preflight contra el Cart remoto', () => {
  test('un carrito válido con checkoutUrl segura queda ready', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: remoteCart() }),
    });
    const result = await service.checkout(CART_ID);
    expect(result.status).toBe('ready');
    expect(result.url).toBe(CHECKOUT_URL);
    expect(result.cart.canCheckout).toBe(true);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get']);
  });

  test('un carrito vacío queda blocked', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: remoteCart({ lines: [] }) }),
    });
    const result = await service.checkout(CART_ID);
    expect(result.status).toBe('blocked');
    expect(result.message).toContain('vacío');
    expect(gateway.queries.map((item) => item.name)).toEqual(['get']);
  });

  test('una variante no disponible bloquea la preparación de checkout', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({
        cart: remoteCart({
          lines: [remoteLine(LINE_A, VARIANT_A, 1, { availableForSale: false })],
        }),
      }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('blocked');
    expect(result.cart.canCheckout).toBe(false);
  });

  test('una línea con merchandise nulo hace fallar cerrado checkout', async () => {
    const result = createShopifyCartService(createGateway({
      get: () => ({
        cart: remoteCart({
          lines: [{
            id: LINE_A,
            quantity: 1,
            cost: { amountPerQuantity: money(), totalAmount: money() },
            merchandise: null,
          }],
        }),
      }),
    }), checkoutHosts).checkout(CART_ID);
    await expect(result).rejects.toThrow('merchandise is missing');
  });

  test('una quantityRule no soportada hace fallar la preparación de checkout', async () => {
    const result = createShopifyCartService(createGateway({
      get: () => ({
        cart: remoteCart({
          lines: [remoteLine(LINE_A, VARIANT_A, 5, {
            quantityRule: { minimum: 2, increment: 2, maximum: 10 },
          })],
        }),
      }),
    }), checkoutHosts).checkout(CART_ID);
    await expect(result).rejects.toThrow('minimum=1 and increment=1');
  });

  test('un warning ya resuelto no impide checkout si el cart es comprable', async () => {
    const cart = mapShopifyCart(
      remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 2)] }),
      [{ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'adjusted', target: LINE_A }]
    );
    expect(cart.lineErrors.some((error) => error.severity === 'notice')).toBe(true);
    expect(cart.canCheckout).toBe(true);
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 2)] }) }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('ready');
  });

  test('checkoutUrl ausente no queda ready', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart({ checkoutUrl: null }) }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).not.toBe('ready');
    expect(result.url).toBeUndefined();
  });

  test('checkoutUrl de un host no permitido sigue rechazada', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({
        cart: remoteCart({ checkoutUrl: 'https://kingbelt.myshopify.com.evil.test/checkouts/cn/test' }),
      }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).not.toBe('ready');
    expect(result.url).toBeUndefined();
  });

  test('un Cart remoto con más de 50 líneas queda blocked', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart({ lines: remoteLines(MAX_CART_LINES + 1) }) }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('blocked');
    expect(result.cart.canCheckout).toBe(false);
    expect(result.url).toBeUndefined();
  });

  test('un cart remoto nulo en checkout es expired', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: null }),
    });
    const result = await service.checkout(CART_ID);
    expect(result.status).toBe('expired');
    expect(result.cart.lines).toHaveLength(0);
    expect(result.cartId).toBeUndefined();
    expect(gateway.queries.map((item) => item.name)).toEqual(['get']);
  });

  test('checkout usa el checkoutUrl del carrito sin parámetros de mercado', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: remoteCart() }),
    });
    const result = await service.checkout(CART_ID);
    expect(result.status).toBe('ready');
    expect(result.url).toBe(CHECKOUT_URL);
    const url = new URL(result.url);
    expect(url.searchParams.has('country')).toBe(false);
    expect(url.searchParams.has('currency')).toBe(false);
    expect(url.searchParams.has('language')).toBe(false);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get']);
  });

  test('checkout alinea un carrito FR con identity y no vuelve a leer', async () => {
    const foreign = remoteCart({ buyerIdentity: { countryCode: 'FR' } });
    const aligned = remoteCart();
    const { gateway, ...service } = createService({
      get: () => ({ cart: foreign }),
      identity: () => ({ cartBuyerIdentityUpdate: payload({ cart: aligned }) }),
    });
    const result = await service.checkout(CART_ID);
    expect(result.status).toBe('ready');
    expect(result.url).toBe(CHECKOUT_URL);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get', 'identity']);
  });

  test('checkout conserva los query params del checkoutUrl de Shopify', async () => {
    const url = 'https://kingbelt.myshopify.com/cart/c/example?key=opaque-test-value';
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart({ checkoutUrl: url }) }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('ready');
    expect(result.url).toBe(url);
  });
});

describe('contexto de mercado del carrito Shopify', () => {
  test('cartCreate envía buyerIdentity.countryCode ES del contexto central', async () => {
    const { gateway, ...service } = createService({
      create: () => ({ cartCreate: payload() }),
    });
    await service.add(undefined, VARIANT_A, 1);
    const create = gateway.queries.find((item) => item.name === 'create');
    expect(create.query).toContain(SHOPIFY_CART_IN_CONTEXT_DIRECTIVE);
    expect(create.query).not.toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(create.query).not.toContain('$country');
    expect(create.variables.input.buyerIdentity.countryCode).toBe('ES');
    expect(create.variables.input.buyerIdentity).toEqual(shopifyCartBuyerIdentity());
    expect(create.variables).not.toHaveProperty('country');
    expect(create.variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    expect(create.variables.input.buyerIdentity).not.toHaveProperty('email');
    expect(create.variables.input.buyerIdentity).not.toHaveProperty('customerAccessToken');
    expect(gateway.queries.some((item) => item.name === 'identity')).toBe(false);
  });

  test('un carrito ya alineado con ES no dispara cartBuyerIdentityUpdate', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: remoteCart() }),
    });
    const result = await service.get(CART_ID);
    expect(result.cart.canCheckout).toBe(true);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get']);
    const get = gateway.queries[0];
    expect(get.query).toContain(SHOPIFY_CART_IN_CONTEXT_DIRECTIVE);
    expect(get.query).toContain('buyerIdentity { countryCode }');
    expect(get.query).not.toContain('$country');
    expect(get.variables).not.toHaveProperty('country');
    expect(get.variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
  });

  test('mutaciones sobre un carrito ES no disparan cartBuyerIdentityUpdate', async () => {
    const { gateway, ...service } = createService({
      get: () => ({ cart: remoteCart() }),
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({ cartLinesAdd: payload() }),
      update: () => ({ cartLinesUpdate: payload() }),
      remove: () => ({ cartLinesRemove: payload() }),
    });
    await service.get(CART_ID);
    await service.add(CART_ID, VARIANT_A, 1);
    await service.update(CART_ID, LINE_A, 2);
    await service.remove(CART_ID, LINE_A);
    expect(gateway.queries.filter((item) => item.name === 'identity')).toHaveLength(0);
  });

  test('un carrito FR se alinea con exactamente un cartBuyerIdentityUpdate a ES', async () => {
    const foreign = remoteCart({ buyerIdentity: { countryCode: 'FR' } });
    const aligned = remoteCart();
    const { gateway, ...service } = createService({
      get: () => ({ cart: foreign }),
      identity: (_query, variables) => {
        expect(variables.buyerIdentity.countryCode).toBe('ES');
        expect(variables.buyerIdentity).toEqual(shopifyCartBuyerIdentity());
        expect(variables.cartId).toBe(CART_ID);
        expect(variables).not.toHaveProperty('country');
        expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
        return { cartBuyerIdentityUpdate: payload({ cart: aligned }) };
      },
    });
    const result = await service.get(CART_ID);
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.canCheckout).toBe(true);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get', 'identity']);
  });

  test('un identity update que sigue en FR rechaza el carrito', async () => {
    const foreign = remoteCart({ buyerIdentity: { countryCode: 'FR' } });
    const { gateway, ...service } = createService({
      get: () => ({ cart: foreign }),
      identity: () => ({ cartBuyerIdentityUpdate: payload({ cart: foreign }) }),
    });
    await expect(service.get(CART_ID)).rejects.toThrow('Shopify cart country does not match ES.');
    expect(gateway.queries.map((item) => item.name)).toEqual(['get', 'identity']);
    expect(gateway.queries.filter((item) => item.name === 'identity')).toHaveLength(1);
  });

  test('cartLinesAdd con moneda incorrecta no devuelve success', async () => {
    const usdCart = remoteCart();
    usdCart.cost.subtotalAmount.currencyCode = 'USD';
    const { ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({ cartLinesAdd: payload({ cart: usdCart }) }),
    });
    await expect(service.add(CART_ID, VARIANT_A, 1)).rejects.toThrow(
      'Shopify cart currency does not match EUR at cost.subtotalAmount.'
    );
  });

  test('mapShopifyCart rechaza un país distinto de ES', () => {
    expect(() => mapShopifyCart(remoteCart({ buyerIdentity: { countryCode: 'FR' } }))).toThrow(
      'Shopify cart country does not match ES.'
    );
  });

  test('mapShopifyCart rechaza un subtotal que no sea EUR', () => {
    const cart = remoteCart();
    cart.cost.subtotalAmount.currencyCode = 'USD';
    expect(() => mapShopifyCart(cart)).toThrow(
      'Shopify cart currency does not match EUR at cost.subtotalAmount.'
    );
  });

  test('mapShopifyCart rechaza un precio unitario que no sea EUR', () => {
    const cart = remoteCart();
    cart.lines.nodes[0].cost.amountPerQuantity.currencyCode = 'USD';
    expect(() => mapShopifyCart(cart)).toThrow(
      'Shopify cart currency does not match EUR at lines[0].cost.amountPerQuantity.'
    );
  });

  test('mapShopifyCart rechaza un total de línea que no sea EUR', () => {
    const cart = remoteCart();
    cart.lines.nodes[0].cost.totalAmount.currencyCode = 'USD';
    expect(() => mapShopifyCart(cart)).toThrow(
      'Shopify cart currency does not match EUR at lines[0].cost.totalAmount.'
    );
  });

  test('mapShopifyCart acepta ES con todos los importes en EUR', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 2)],
    }));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);
    expect(cart.subtotal.currency).toBe('EUR');
    expect(cart.lines[0].product.unitPrice.currency).toBe('EUR');
    expect(cart.lines[0].lineTotal.currency).toBe('EUR');
    expect(cart.lines[0].availability.status).toBe('available');
    expect(cart.canCheckout).toBe(true);
    expect(cart.lineErrors).toEqual([]);
  });
});

describe('recuperación de Cart caducado en add', () => {
  test('un snapshot nulo crea un Cart nuevo y no llama cartLinesAdd', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: null }),
      create: (_query, variables) => {
        expect(variables.input.lines[0]).toEqual({ merchandiseId: VARIANT_C, quantity: 2 });
        return {
          cartCreate: payload({
            cart: remoteCart({
              id: NEW_CART_ID,
              lines: [remoteLine(LINE_C, VARIANT_C, 2)],
            }),
          }),
        };
      },
    });

    const result = await service.add(CART_ID, VARIANT_C, 2);

    expect(result.success).toBe(true);
    expect(result.cartId).toBe(NEW_CART_ID);
    expect(result.cart.lines.map((line) => line.variantId)).toEqual([VARIANT_C]);
    expect(result.cart.lines[0].quantity).toBe(2);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'create']);
  });

  test('un Cart existente vacío sigue usando cartLinesAdd', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart({ lines: [] }) }),
      add: () => ({
        cartLinesAdd: payload({
          cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }),
        }),
      }),
    });

    const result = await service.add(CART_ID, VARIANT_A, 1);

    expect(result.success).toBe(true);
    expect(result.cartId).toBe(CART_ID);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('un Cart existente usa cartLinesAdd y no cartCreate', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 1)] }) }),
      add: () => ({
        cartLinesAdd: payload({
          cart: remoteCart({ lines: [remoteLine(LINE_A, VARIANT_A, 2)] }),
        }),
      }),
    });

    const result = await service.add(CART_ID, VARIANT_A, 1);

    expect(result.success).toBe(true);
    expect(result.cartId).toBe(CART_ID);
    expect(result.cart.lines[0].quantity).toBe(2);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('una carrera de caducidad confirma el Cart nulo y crea uno nuevo una sola vez', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({
        cartLinesAdd: {
          cart: null,
          userErrors: [{
            code: 'INVALID',
            message: 'Cart does not exist',
            field: ['cartId'],
          }],
          warnings: [],
        },
      }),
      get: () => ({ cart: null }),
      create: () => ({
        cartCreate: payload({
          cart: remoteCart({
            id: NEW_CART_ID,
            lines: [remoteLine(LINE_C, VARIANT_C, 1)],
          }),
        }),
      }),
    });

    const result = await service.add(CART_ID, VARIANT_C, 1);

    expect(result.success).toBe(true);
    expect(result.cartId).toBe(NEW_CART_ID);
    expect(result.cart.lines.map((line) => line.variantId)).toEqual([VARIANT_C]);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add', 'get', 'create']);
  });

  test('not_found con Cart todavía existente no crea otro Cart', async () => {
    const current = remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1), remoteLine(LINE_B, VARIANT_B, 1)],
    });
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: current }),
      add: () => ({
        cartLinesAdd: {
          cart: null,
          userErrors: [{
            code: 'INVALID_MERCHANDISE_LINE',
            message: 'line gone internals',
            field: ['lines'],
          }],
          warnings: [],
        },
      }),
      get: () => ({ cart: current }),
    });

    const result = await service.add(CART_ID, VARIANT_C, 1);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('not_found');
    expect(result.cartId).toBe(CART_ID);
    expect(result.cart.lines.map((line) => line.id)).toEqual([LINE_A, LINE_B]);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add', 'get']);
  });

  test('una variante unavailable no crea un Cart nuevo', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => ({
        cartLinesAdd: payload({
          cart: remoteCart(),
          userErrors: [{
            code: 'MERCHANDISE_NOT_APPLICABLE',
            message: 'variant internals',
            field: ['merchandiseId'],
          }],
        }),
      }),
    });

    const result = await service.add(CART_ID, VARIANT_C, 1);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('unavailable');
    expect(result.cartId).toBe(CART_ID);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('un error de red en cartLinesAdd no crea otro Cart', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => {
        throw new ShopifyStorefrontRequestError('network', 'Shopify Storefront network error.');
      },
    });

    await expect(service.add(CART_ID, VARIANT_C, 1)).rejects.toBeInstanceOf(ShopifyStorefrontRequestError);
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('un timeout en cartLinesAdd no crea otro Cart', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => {
        throw new ShopifyStorefrontRequestError('timeout', 'Shopify Storefront request timed out.');
      },
    });

    await expect(service.add(CART_ID, VARIANT_C, 1)).rejects.toMatchObject({ kind: 'timeout' });
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('un HTTP 500 en cartLinesAdd no crea otro Cart', async () => {
    const { gateway, ...service } = createService({
      quantities: () => ({ cart: remoteCart() }),
      add: () => {
        throw new ShopifyStorefrontRequestError('http', 'Shopify Storefront request failed with HTTP 500.', 500);
      },
    });

    await expect(service.add(CART_ID, VARIANT_C, 1)).rejects.toMatchObject({ kind: 'http', status: 500 });
    expect(gateway.queries.map((item) => item.name)).toEqual(['quantities', 'add']);
  });

  test('update y remove del happy path no hacen una query extra', async () => {
    const { gateway, ...service } = createService({
      update: () => ({ cartLinesUpdate: payload() }),
      remove: () => ({ cartLinesRemove: payload({ cart: remoteCart({ lines: [] }) }) }),
    });

    await service.update(CART_ID, LINE_A, 2);
    await service.remove(CART_ID, LINE_A);
    expect(gateway.queries.map((item) => item.name)).toEqual(['update', 'remove']);
  });
});
