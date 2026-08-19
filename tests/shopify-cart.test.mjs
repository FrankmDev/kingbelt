import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createShopifyCartService } from '../src/commerce/infrastructure/shopify/shopify-cart.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  shopifyCartBuyerIdentity,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  interpretShopifyCartMutation,
  mapShopifyCart,
  mapShopifyCartAvailability,
  mapShopifyCartErrorCode,
  previousLinesFromQuantitySnapshot,
  SHOPIFY_CART_OVERFLOW_MESSAGE,
  SHOPIFY_CART_UPDATED_NOTICE,
  SHOPIFY_NOT_ENOUGH_STOCK_NOTICE,
  SHOPIFY_OUT_OF_STOCK_NOTICE,
  SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE,
  SHOPIFY_UNAVAILABLE_LINE_TITLE,
} from '../src/commerce/infrastructure/shopify/shopify-cart-mappers.ts';
import { TECHNICAL_LINE_QUANTITY_LIMIT } from '../src/commerce/domain/inventory.ts';
import { isQuantityAllowed } from '../src/commerce/domain/inventory.ts';

const root = resolve(import.meta.dir, '..');
const checkoutHosts = ['kingbelt.myshopify.com', 'checkout.shopify.com'];
const VARIANT_A = 'gid://shopify/ProductVariant/111';
const VARIANT_B = 'gid://shopify/ProductVariant/222';
const VARIANT_C = 'gid://shopify/ProductVariant/333';
const LINE_A = 'gid://shopify/CartLine/line-a';
const LINE_B = 'gid://shopify/CartLine/line-b';
const LINE_C = 'gid://shopify/CartLine/line-c';
const LINE_MISSING = 'gid://shopify/CartLine/line-missing';
const CART_ID = 'gid://shopify/Cart/test-cart';
const CHECKOUT_URL = 'https://kingbelt.myshopify.com/checkouts/cn/test';

const money = (amount = '89.00') => ({ amount, currencyCode: 'EUR' });

const merchandise = (id, {
  availableForSale = true,
  currentlyNotInStock = false,
  quantityRule = { minimum: 1, increment: 1, maximum: null },
  handle = 'cinturon-test',
  metafield = null,
  collections = { nodes: [] },
} = {}) => ({
  id,
  title: 'Negro / 90',
  availableForSale,
  currentlyNotInStock,
  quantityRule,
  selectedOptions: [{ name: 'Color', value: 'Negro' }, { name: 'Talla', value: '90' }],
  image: {
    id: `gid://shopify/MediaImage/${id}`,
    url: 'https://cdn.shopify.com/s/files/1/test.jpg',
    width: 800,
    height: 1000,
    altText: 'Cinturón de prueba',
  },
  product: {
    id: 'gid://shopify/Product/1',
    handle,
    title: 'Cinturón de prueba',
    productType: 'Piel lisa',
    metafield,
    collections,
    featuredImage: null,
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

const remoteCart = ({
  lines = [remoteLine(LINE_A, VARIANT_A, 1)],
  checkoutUrl = CHECKOUT_URL,
  totalQuantity,
  buyerIdentity = { countryCode: SHOPIFY_MARKET_CONTEXT.country },
} = {}) => ({
  id: CART_ID,
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
      expect(query).toContain('metafield(namespace: "kingbelt", key: "model_reference")');
      expect(query).toContain('collections(first: 1) { nodes { title } }');
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

  test('usa la referencia comercial y la colección publicadas, no el handle ni productType', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 1, {
        metafield: { value: 'ATLAS-35' },
        collections: { nodes: [{ title: 'Sport' }] },
      })],
    }));
    expect(cart.lines[0].product.reference).toBe('ATLAS-35');
    expect(cart.lines[0].product.collection).toBe('Sport');
  });

  test('una línea sin merchandise se conserva como no disponible y bloquea checkout', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [{
        id: LINE_A,
        quantity: 2,
        cost: { amountPerQuantity: money(), totalAmount: money('178.00') },
        merchandise: null,
      }],
    }));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({
      id: LINE_A,
      product: { title: SHOPIFY_UNAVAILABLE_LINE_TITLE, href: '/' },
      quantity: 2,
    });
    expect(cart.canCheckout).toBe(false);
    expect(cart.lineErrors[0]).toMatchObject({ lineId: LINE_A, code: 'unavailable', severity: 'error' });
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

  test('respeta mínimo, incremento y máximo reales', () => {
    const stepped = mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 2, increment: 2, maximum: 10 },
    });
    expect(stepped).toMatchObject({
      minimum: 2,
      increment: 2,
      maxQuantity: 10,
      limitReason: 'quantity_rule',
    });
    expect(isQuantityAllowed(2, stepped)).toBe(true);
    expect(isQuantityAllowed(4, stepped)).toBe(true);
    expect(isQuantityAllowed(10, stepped)).toBe(true);
    expect(isQuantityAllowed(1, stepped)).toBe(false);
    expect(isQuantityAllowed(3, stepped)).toBe(false);

    const triple = mapShopifyCartAvailability({
      availableForSale: true,
      currentlyNotInStock: false,
      quantityRule: { minimum: 3, increment: 3, maximum: 12 },
    });
    expect(triple).toMatchObject({ minimum: 3, increment: 3, maxQuantity: 12, limitReason: 'quantity_rule' });
    expect(isQuantityAllowed(6, triple)).toBe(true);
    expect(isQuantityAllowed(4, triple)).toBe(false);
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

  test('una cantidad fuera de quantityRule bloquea checkout', () => {
    const cart = mapShopifyCart(remoteCart({
      lines: [remoteLine(LINE_A, VARIANT_A, 5, {
        quantityRule: { minimum: 2, increment: 2, maximum: 10 },
      })],
    }));
    expect(cart.canCheckout).toBe(false);
    expect(cart.lineErrors[0]).toMatchObject({ code: 'quantity_limit', severity: 'error' });
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
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart() }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('ready');
    expect(result.url).toBe(CHECKOUT_URL);
    expect(result.cart.canCheckout).toBe(true);
  });

  test('un carrito vacío queda blocked', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: remoteCart({ lines: [] }) }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('blocked');
    expect(result.message).toContain('vacío');
  });

  test('una línea unavailable bloquea checkout', async () => {
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

  test('una cantidad fuera de quantityRule bloquea checkout', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({
        cart: remoteCart({
          lines: [remoteLine(LINE_A, VARIANT_A, 5, {
            quantityRule: { minimum: 2, increment: 2, maximum: 10 },
          })],
        }),
      }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('blocked');
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

  test('un cart remoto nulo en checkout es expired', async () => {
    const result = await createShopifyCartService(createGateway({
      get: () => ({ cart: null }),
    }), checkoutHosts).checkout(CART_ID);
    expect(result.status).toBe('expired');
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
    expect(gateway.queries.every((item) => item.name !== 'identity')).toBe(true);
  });
});

describe('contexto de mercado del carrito Shopify', () => {
  test('cartCreate envía buyerIdentity.countryCode del contexto central', async () => {
    const { gateway, ...service } = createService({
      create: () => ({ cartCreate: payload() }),
    });
    await service.add(undefined, VARIANT_A, 1);
    const create = gateway.queries.find((item) => item.name === 'create');
    expect(create.query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(create.variables.input.buyerIdentity).toEqual(shopifyCartBuyerIdentity());
    expect(create.variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
    expect(create.variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    expect(create.variables.input.buyerIdentity).not.toHaveProperty('email');
    expect(create.variables.input.buyerIdentity).not.toHaveProperty('customerAccessToken');
    expect(gateway.queries.some((item) => item.name === 'identity')).toBe(false);
  });

  test('un carrito ya alineado con ES no dispara cartBuyerIdentityUpdate', async () => {
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
    expect(gateway.queries.some((item) => item.name === 'identity')).toBe(false);
  });

  test('un carrito con otro país se alinea con cartBuyerIdentityUpdate', async () => {
    const foreign = remoteCart({ buyerIdentity: { countryCode: 'US' } });
    const aligned = remoteCart();
    const { gateway, ...service } = createService({
      get: () => ({ cart: foreign }),
      identity: (_query, variables) => {
        expect(variables.buyerIdentity).toEqual(shopifyCartBuyerIdentity());
        expect(variables.cartId).toBe(CART_ID);
        expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
        return { cartBuyerIdentityUpdate: payload({ cart: aligned }) };
      },
    });
    const result = await service.get(CART_ID);
    expect(result.cart.lines).toHaveLength(1);
    expect(gateway.queries.map((item) => item.name)).toEqual(['get', 'identity']);
  });

  test('catálogo y carrito consumen el mismo país central', async () => {
    const { gateway, ...service } = createService({
      create: () => ({ cartCreate: payload() }),
    });
    await service.add(undefined, VARIANT_A, 1);
    const create = gateway.queries.find((item) => item.name === 'create');
    expect(create.variables.input.buyerIdentity.countryCode).toBe(SHOPIFY_MARKET_CONTEXT.country);
    expect(create.variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
  });
});
