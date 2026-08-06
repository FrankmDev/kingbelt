import { describe, expect, test } from 'bun:test';
import { demoProducts } from '../src/demo-catalog.ts';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import { MAX_CART_LINES } from '../src/commerce/domain/cart.ts';
import { createDemoCartAdapter } from '../src/commerce/infrastructure/demo/demo-cart-adapter.ts';
import { demoCartCatalog } from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';
import {
  LOCAL_CART_STORAGE_KEY,
  persistCart,
  readPersistedCart,
} from '../src/commerce/infrastructure/demo/cart-storage.ts';
import { createCartStore } from '../src/scripts/commerce/cart-store.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

class FailingWriteStorage extends MemoryStorage {
  setItem() { throw new Error('quota'); }
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const tickUntil = async (predicate, attempts = 20) => {
  for (let index = 0; index < attempts && !predicate(); index += 1) await Promise.resolve();
  expect(predicate()).toBe(true);
};

const variants = demoProducts
  .flatMap((product) => product.variants)
  .filter((variant) => variant.salesStatus === 'active' && (
    variant.inventory.kind === 'unknown' || variant.inventory.quantity > 3 || variant.inventoryPolicy === 'continue'
  ));
const firstVariant = variants[0];
const secondVariant = variants.find((variant) => variant.id !== firstVariant.id);
const service = createCartService(demoCartCatalog);

const createProvider = ({ initialCart, initialize, updateItem } = {}) => {
  let cart = initialCart ?? emptyCart();
  return {
    initialize: initialize ?? (async () => cart),
    refresh: async () => cart,
    addItem: async (input) => {
      const result = service.addToCart(cart, input);
      cart = result.cart;
      return result;
    },
    updateItem: updateItem ?? (async (lineId, quantity) => {
      const result = service.updateLineQuantity(cart, lineId, quantity);
      cart = result.cart;
      return result;
    }),
    removeItem: async (lineId) => {
      const result = service.removeLine(cart, lineId);
      cart = result.cart;
      return result;
    },
    checkout: async () => ({ status: 'unavailable', message: 'Demo' }),
    get cart() { return cart; },
    set cart(value) { cart = value; },
  };
};

describe('barrera de inicialización y mutaciones deterministas', () => {
  test('una adición espera a la recuperación y se aplica sobre el carrito recuperado', async () => {
    const gate = deferred();
    const restored = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let addCalls = 0;
    const provider = createProvider({
      initialCart: restored,
      initialize: async () => {
        await gate.promise;
        return restored;
      },
    });
    const originalAdd = provider.addItem;
    provider.addItem = async (input) => {
      addCalls += 1;
      return originalAdd(input);
    };
    const store = createCartStore(provider);

    const request = store.add({ variantId: firstVariant.id, quantity: 1 });
    await Promise.resolve();
    expect(addCalls).toBe(0);
    gate.resolve();

    const result = await request;
    expect(result.success).toBe(true);
    expect(result.cart.lines[0].quantity).toBe(2);
  });

  test('deduplica una adición idéntica mientras está en vuelo', async () => {
    const gate = deferred();
    let calls = 0;
    const provider = createProvider();
    const originalAdd = provider.addItem;
    provider.addItem = async (input) => {
      calls += 1;
      await gate.promise;
      return originalAdd(input);
    };
    const store = createCartStore(provider);
    await store.init();

    const first = store.add({ variantId: firstVariant.id, quantity: 1 });
    const repeated = store.add({ variantId: firstVariant.id, quantity: 1 });
    expect(repeated).toBe(first);
    gate.resolve();
    await Promise.all([first, repeated]);
    expect(calls).toBe(1);
    expect(store.getCart().lines[0].quantity).toBe(1);
  });

  test('coalesce cambios rápidos de cantidad y solo publica el valor final como estable', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const gate = deferred();
    let calls = 0;
    const provider = createProvider({ initialCart: initial });
    provider.updateItem = async (lineId, quantity) => {
      calls += 1;
      if (calls === 1) await gate.promise;
      const result = service.updateLineQuantity(provider.cart, lineId, quantity);
      provider.cart = result.cart;
      return result;
    };
    const store = createCartStore(provider);
    const stableQuantities = [];
    store.subscribe((cart) => {
      if (cart.status === 'idle' && cart.lines[0]) stableQuantities.push(cart.lines[0].quantity);
    });
    await store.init();
    const lineId = store.getCart().lines[0].id;

    const first = store.updateQuantity(lineId, 2);
    await tickUntil(() => calls === 1);
    const latest = store.updateQuantity(lineId, 4);
    gate.resolve();
    const [firstResult, latestResult] = await Promise.all([first, latest]);

    expect(calls).toBe(2);
    expect(firstResult.cart.lines[0].quantity).toBe(4);
    expect(latestResult.cart.lines[0].quantity).toBe(4);
    expect(stableQuantities).toEqual([1, 4]);
  });

  test('una cantidad solicitada al publicarse el estado estable programa una nueva mutación', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({ initialCart: initial });
    const appliedQuantities = [];
    const originalUpdate = provider.updateItem;
    provider.updateItem = async (lineId, quantity) => {
      appliedQuantities.push(quantity);
      return originalUpdate(lineId, quantity);
    };
    const store = createCartStore(provider);
    await store.init();
    const lineId = store.getCart().lines[0].id;

    let followUpSent = false;
    store.subscribe((cart) => {
      if (!followUpSent && cart.status === 'idle' && cart.lines[0]?.quantity === 2) {
        followUpSent = true;
        void store.updateQuantity(lineId, 3);
      }
    });

    await store.updateQuantity(lineId, 2);
    await tickUntil(() => store.getCart().lines[0]?.quantity === 3);
    expect(appliedQuantities).toEqual([2, 3]);
    expect(store.getCart().status).toBe('idle');
  });

  test('un error del proveedor conserva el último carrito válido', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 2 }]);
    const provider = createProvider({
      initialCart: initial,
      updateItem: async () => { throw new Error('provider down'); },
    });
    const store = createCartStore(provider);
    await store.init();
    const result = await store.updateQuantity(initial.lines[0].id, 3);

    expect(result.success).toBe(false);
    expect(store.getCart().lines[0].quantity).toBe(2);
    expect(store.getCart().status).toBe('error');
  });
});

describe('persistencia defensiva y pestañas', () => {
  test('el formato guardado contiene exclusivamente versión, IDs de variante y cantidades', () => {
    const storage = new MemoryStorage();
    const cart = service.restoreCart([{ variantId: firstVariant.id, quantity: 2 }]);
    expect(persistCart(storage, cart)).toBe(true);
    const payload = JSON.parse(storage.getItem(LOCAL_CART_STORAGE_KEY));

    expect(Object.keys(payload).sort()).toEqual(['lines', 'version']);
    expect(Object.keys(payload.lines[0]).sort()).toEqual(['quantity', 'variantId']);
  });

  test('rechaza líneas dañadas, duplicadas, excesivas y payloads sobredimensionados', () => {
    const storage = new MemoryStorage();
    const set = (value) => storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(value));

    set({ version: 4, lines: [{ variantId: firstVariant.id, quantity: 1 }, { nope: true }] });
    expect(readPersistedCart(storage).source).toBe('invalid');
    set({ version: 4, lines: [{ variantId: firstVariant.id, quantity: 1, price: 1 }] });
    expect(readPersistedCart(storage).source).toBe('invalid');
    set({ version: 4, lines: [
      { variantId: firstVariant.id, quantity: 1 },
      { variantId: firstVariant.id, quantity: 1 },
    ] });
    expect(readPersistedCart(storage).source).toBe('invalid');
    set({ version: 4, lines: Array.from({ length: MAX_CART_LINES + 1 }, (_, index) => ({
      variantId: `variant:${index}`,
      quantity: 1,
    })) });
    expect(readPersistedCart(storage).source).toBe('invalid');
    storage.setItem(LOCAL_CART_STORAGE_KEY, 'x'.repeat(20_000));
    expect(readPersistedCart(storage).source).toBe('invalid');
  });

  test('un fallo de escritura mantiene y acumula el carrito en memoria', async () => {
    const adapter = createDemoCartAdapter({ storage: new FailingWriteStorage() });
    await adapter.initialize();
    const first = await adapter.addItem({ variantId: firstVariant.id, quantity: 1 });
    const second = await adapter.addItem({ variantId: firstVariant.id, quantity: 1 });

    expect(first.cart.globalNotice).toContain('esta pestaña');
    expect(second.cart.lines[0].quantity).toBe(2);
    expect(second.cart.globalNotice).toContain('esta pestaña');
  });

  test('dos adaptadores releen el snapshot guardado y no pisan líneas de otra pestaña', async () => {
    const storage = new MemoryStorage();
    const firstTab = createDemoCartAdapter({ storage });
    const secondTab = createDemoCartAdapter({ storage });
    await Promise.all([firstTab.initialize(), secondTab.initialize()]);

    await firstTab.addItem({ variantId: firstVariant.id, quantity: 1 });
    await secondTab.addItem({ variantId: secondVariant.id, quantity: 1 });
    const synchronized = await firstTab.refresh();

    expect(synchronized.lines.map((line) => line.variantId).sort()).toEqual(
      [firstVariant.id, secondVariant.id].sort()
    );
  });
});

describe('reconciliación con catálogo autoritativo', () => {
  test('refresca precio y stock, ajusta cantidad y retira una variante eliminada con aviso', () => {
    const source = structuredClone(demoCartCatalog.getVariant(firstVariant.id));
    let activeRecord = source;
    const catalog = {
      getVariant: (id) => activeRecord?.variant.id === id ? activeRecord : undefined,
      resolveLegacyVariant: () => undefined,
    };
    const localService = createCartService(catalog);
    const restored = localService.restoreCart([{ variantId: firstVariant.id, quantity: 3 }]);
    const newPrice = restored.lines[0].product.unitPrice.amountMinor + 1_000;
    activeRecord.variant.price.amountMinor = newPrice;
    activeRecord.variant.inventory = { kind: 'known', quantity: 2 };

    const refreshed = localService.refreshCart(restored);
    expect(refreshed.lines[0].product.unitPrice.amountMinor).toBe(newPrice);
    expect(refreshed.lines[0].quantity).toBe(2);
    expect(refreshed.lineErrors[0].code).toBe('quantity_adjusted');
    expect(refreshed.subtotal.amountMinor).toBe(newPrice * 2);
    expect(Number.isSafeInteger(refreshed.subtotal.amountMinor)).toBe(true);

    activeRecord = undefined;
    const removed = localService.refreshCart(refreshed);
    expect(removed.lines).toHaveLength(0);
    expect(removed.globalNotice).toContain('retirado del carrito');
  });

  test('el dominio impide superar el límite de líneas distintas', () => {
    const template = structuredClone(demoCartCatalog.getVariant(firstVariant.id));
    const catalog = {
      getVariant: (id) => {
        const variant = { ...template.variant, id, sku: `SKU-${id}` };
        return { ...template, variant, product: { ...template.product, variants: [variant] } };
      },
      resolveLegacyVariant: () => undefined,
    };
    const localService = createCartService(catalog);
    let cart = emptyCart();
    for (let index = 0; index < MAX_CART_LINES; index += 1) {
      const result = localService.addToCart(cart, { variantId: `variant:${index}`, quantity: 1 });
      expect(result.success).toBe(true);
      cart = result.cart;
    }

    const rejected = localService.addToCart(cart, { variantId: 'variant:overflow', quantity: 1 });
    expect(rejected.success).toBe(false);
    expect(rejected.error.message).toContain(String(MAX_CART_LINES));
    expect(rejected.cart.lines).toHaveLength(MAX_CART_LINES);
  });
});
