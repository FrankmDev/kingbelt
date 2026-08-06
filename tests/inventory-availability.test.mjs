import { describe, expect, test } from 'bun:test';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import {
  getQuantityLimitMessage,
  getVariantAvailability,
  TECHNICAL_LINE_QUANTITY_LIMIT,
} from '../src/commerce/domain/inventory.ts';
import { commerceRules } from '../src/commerce/domain/commerce-rules.ts';
import { toPublicBuyBoxVariant } from '../src/commerce/domain/product-mappers.ts';
import { createCartStore } from '../src/scripts/commerce/cart-store.ts';
import { demoCartCatalog } from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';
import { demoProducts } from '../src/demo-catalog.ts';
import { serializeJsonForHtml } from '../src/shared/security/serialize-json-for-html.ts';

const availabilityVariant = ({
  salesStatus = 'active',
  quantity = 10,
  inventoryPolicy = 'deny',
  maximum,
} = {}) => ({
  salesStatus,
  inventory: quantity === null ? { kind: 'unknown' } : { kind: 'known', quantity },
  inventoryPolicy,
  quantityRule: {
    minimum: 1,
    increment: 1,
    ...(maximum === undefined ? {} : { maximum }),
  },
});

const demoRecord = () => {
  const variant = demoProducts
    .flatMap((product) => product.variants)
    .find((item) => item.salesStatus === 'active' && item.inventory.kind === 'known' && item.inventory.quantity > 3);
  return structuredClone(demoCartCatalog.getVariant(variant.id));
};

const mutableCatalog = (initialRecord) => {
  let record = initialRecord;
  return {
    catalog: {
      getVariant: (id) => record?.variant.id === id ? record : undefined,
      resolveLegacyVariant: () => undefined,
    },
    get record() { return record; },
    set record(value) { record = value; },
  };
};

describe('interpretación única de disponibilidad', () => {
  test('variante activa con stock conocido', () => {
    expect(getVariantAvailability(availabilityVariant({ quantity: 10 }))).toEqual({
      status: 'available',
      purchasable: true,
      maxQuantity: 10,
      minimum: 1,
      increment: 1,
      limitReason: 'inventory',
      quantityKnown: true,
      backorder: false,
      message: 'Disponible.',
    });
  });

  test('variante activa con stock desconocido usa un límite técnico, no stock ficticio', () => {
    const availability = getVariantAvailability(availabilityVariant({ quantity: null }));
    expect(availability).toMatchObject({
      status: 'available',
      purchasable: true,
      maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
      limitReason: 'technical',
      quantityKnown: false,
    });
    expect(getQuantityLimitMessage(availability)).toContain('al carrito');
    expect(getQuantityLimitMessage(availability)).not.toContain('quedan');
  });

  test('pocas unidades se comunica sin exponer la cifra exacta', () => {
    const availability = getVariantAvailability(availabilityVariant({ quantity: 2 }));
    expect(availability).toMatchObject({ status: 'limited', purchasable: true, maxQuantity: 2 });
    expect(availability.message).toBe('Quedan pocas unidades.');
    expect(getQuantityLimitMessage(availability)).toBe('La cantidad supera el stock disponible.');
  });

  test('variante agotada bloquea compra', () => {
    expect(getVariantAvailability(availabilityVariant({ quantity: 0 }))).toMatchObject({
      status: 'out_of_stock',
      purchasable: false,
      maxQuantity: 0,
      limitReason: 'inventory',
    });
  });

  test('variante no publicada prevalece sobre stock y política de continuación', () => {
    expect(getVariantAvailability(availabilityVariant({
      salesStatus: 'unavailable',
      quantity: 10,
      inventoryPolicy: 'continue',
    }))).toMatchObject({
      status: 'unavailable',
      purchasable: false,
      maxQuantity: 0,
      limitReason: 'unavailable',
    });
  });

  test('venta autorizada sin stock permanece comprable y respeta el límite comercial', () => {
    expect(getVariantAvailability(availabilityVariant({
      quantity: 0,
      inventoryPolicy: 'continue',
      maximum: 4,
    }))).toEqual({
      status: 'available',
      purchasable: true,
      maxQuantity: 4,
      minimum: 1,
      increment: 1,
      limitReason: 'quantity_rule',
      quantityKnown: true,
      backorder: true,
      message: 'Disponible para pedir.',
    });
  });

  test('un máximo comercial limita la compra sin presentarse como inventario', () => {
    const availability = getVariantAvailability(availabilityVariant({ quantity: 20, maximum: 3 }));
    expect(availability).toMatchObject({ maxQuantity: 3, limitReason: 'quantity_rule' });
    expect(getQuantityLimitMessage(availability)).toBe('El máximo por compra para esta variante es 3.');
  });

  test('el carrito aplica el máximo comercial con un error distinto al de stock', () => {
    const state = mutableCatalog(demoRecord());
    state.record.variant.quantityRule.maximum = 2;
    const service = createCartService(state.catalog);
    const result = service.addToCart(emptyCart(), {
      variantId: state.record.variant.id,
      quantity: 3,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code: 'quantity_limit', field: 'quantity' });
    expect(result.error.message).toBe('El máximo por compra para esta variante es 2.');
    expect(result.error.message).not.toContain('stock');
  });
});

describe('reconciliación y checkout', () => {
  test('una variante eliminada se retira, mientras una no disponible permanece y bloquea checkout', () => {
    const state = mutableCatalog(demoRecord());
    const service = createCartService(state.catalog);
    const variantId = state.record.variant.id;
    const restored = service.restoreCart([{ variantId, quantity: 1 }]);

    state.record.variant.salesStatus = 'unavailable';
    const unavailable = service.refreshCart(restored);
    expect(unavailable.lines).toHaveLength(1);
    expect(unavailable.lineErrors[0].code).toBe('unavailable');
    expect(unavailable.canCheckout).toBe(false);

    state.record = undefined;
    const removed = service.refreshCart(unavailable);
    expect(removed.lines).toHaveLength(0);
    expect(removed.globalNotice).toContain('ya no existe');
  });

  test('una cantidad guardada superior al nuevo stock se reduce de forma segura', () => {
    const state = mutableCatalog(demoRecord());
    const service = createCartService(state.catalog);
    const variantId = state.record.variant.id;
    const restored = service.restoreCart([{ variantId, quantity: 5 }]);

    state.record.variant.inventory = { kind: 'known', quantity: 2 };
    const refreshed = service.refreshCart(restored);
    expect(refreshed.lines[0].quantity).toBe(2);
    expect(refreshed.lineErrors[0]).toMatchObject({ code: 'quantity_adjusted', severity: 'notice' });
    expect(refreshed.lineErrors[0].message).not.toMatch(/\b2\b/);
    expect(refreshed.canCheckout).toBe(true);
  });

  test('stock cero con política continue permite checkout después de revalidar', async () => {
    const state = mutableCatalog(demoRecord());
    state.record.variant.inventory = { kind: 'known', quantity: 0 };
    state.record.variant.inventoryPolicy = 'continue';
    const service = createCartService(state.catalog);
    let cart = service.restoreCart([{ variantId: state.record.variant.id, quantity: 1 }]);
    let checkoutCalls = 0;
    const provider = {
      initialize: async () => cart,
      refresh: async () => service.refreshCart(cart),
      addItem: async (input) => service.addToCart(cart, input),
      updateItem: async (lineId, quantity) => service.updateLineQuantity(cart, lineId, quantity),
      removeItem: async (lineId) => service.removeLine(cart, lineId),
      checkout: async (snapshot) => {
        checkoutCalls += 1;
        cart = snapshot;
        return { status: 'ready', url: 'https://checkout.example.test/cart', allowedHosts: ['checkout.example.test'] };
      },
    };
    const store = createCartStore(provider);
    const result = await store.checkout();
    expect(result.status).toBe('ready');
    expect(checkoutCalls).toBe(1);
    expect(store.getCart().canCheckout).toBe(true);
  });

  test('un cambio impeditivo detectado al preparar checkout bloquea al proveedor', async () => {
    const state = mutableCatalog(demoRecord());
    const service = createCartService(state.catalog);
    const initial = service.restoreCart([{ variantId: state.record.variant.id, quantity: 1 }]);
    let checkoutCalls = 0;
    const provider = {
      initialize: async () => initial,
      refresh: async () => {
        state.record.variant.inventory = { kind: 'known', quantity: 0 };
        return service.refreshCart(initial);
      },
      addItem: async () => { throw new Error('not used'); },
      updateItem: async () => { throw new Error('not used'); },
      removeItem: async () => { throw new Error('not used'); },
      checkout: async () => {
        checkoutCalls += 1;
        return { status: 'ready' };
      },
    };
    const store = createCartStore(provider);
    const result = await store.checkout();
    expect(result.status).toBe('blocked');
    expect(checkoutCalls).toBe(0);
    expect(store.getCart().lineErrors[0].code).toBe('out_of_stock');
    expect(store.getCart().canCheckout).toBe(false);
  });
});

describe('proyección pública de la ficha', () => {
  test('no serializa cantidades exactas cuando exposeExactInventory es false', () => {
    expect(commerceRules.availability.exposeExactInventory).toBe(false);
    const variant = demoProducts
      .flatMap((product) => product.variants)
      .find((item) =>
        item.inventory.kind === 'known' &&
        item.inventory.quantity > 0 &&
        getVariantAvailability(item).limitReason === 'inventory'
      );
    expect(variant).toBeTruthy();
    expect(variant.inventory.kind).toBe('known');

    const projection = toPublicBuyBoxVariant(variant);
    expect(projection.inventory).toBeUndefined();
    expect(projection.availability.maxQuantity).toBeGreaterThan(0);
    expect(projection.availability.limitReason).not.toBe('inventory');
    expect(projection.availability.maxQuantity).not.toBe(variant.inventory.quantity);

    const json = serializeJsonForHtml({
      currency: 'EUR',
      options: [],
      variants: [projection],
    });
    expect(json).not.toMatch(/"inventory"\s*:/);
    expect(json).not.toMatch(/"quantity"\s*:/);
    expect(JSON.parse(json).variants[0].availability.status).toBeDefined();
  });
});
