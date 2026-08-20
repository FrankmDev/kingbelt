import { describe, expect, mock, test } from 'bun:test';
import { demoProducts } from '../src/demo-catalog.ts';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import {
  applyCheckoutSyncNotice,
  buildCheckoutBlockedMessage,
  CHECKOUT_EXPIRED_MESSAGE,
  CHECKOUT_RETURN_CANCELLED,
  CHECKOUT_RETURN_COMPLETED,
  CHECKOUT_RETURN_PARAM,
  CheckoutTimeoutError,
  detectCheckoutSyncDelta,
  getCheckoutReturnNotice,
  parseCheckoutReturn,
  withCheckoutTimeout,
} from '../src/commerce/application/checkout.ts';
import { createShopifyCartAdapter } from '../src/commerce/infrastructure/shopify/shopify-cart-adapter.ts';
import {
  buildShopifyCheckoutHosts,
  getSafeCheckoutUrl,
  normalizeAllowedCheckoutHosts,
  normalizeCheckoutHost,
} from '../src/commerce/application/checkout-redirect.ts';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'demo' }));
const { createCartStore } = await import('../src/scripts/commerce/cart-store.ts');
import { demoCartCatalog } from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';

const service = createCartService(demoCartCatalog);
const variants = demoProducts
  .flatMap((product) => product.variants)
  .filter((variant) => variant.salesStatus === 'active');
const firstVariant = variants[0];
const secondVariant = variants.find((variant) => variant.id !== firstVariant.id);

const createProvider = ({ initialCart, checkout, refresh } = {}) => {
  let cart = initialCart ?? emptyCart();
  return {
    initialize: async () => cart,
    refresh: refresh ?? (async () => cart),
    addItem: async (input) => {
      const result = service.addToCart(cart, input);
      cart = result.cart;
      return result;
    },
    updateItem: async (lineId, quantity) => {
      const result = service.updateLineQuantity(cart, lineId, quantity);
      cart = result.cart;
      return result;
    },
    removeItem: async (lineId) => {
      const result = service.removeLine(cart, lineId);
      cart = result.cart;
      return result;
    },
    checkout: checkout ?? (async () => ({ status: 'unavailable', message: 'Demo' })),
    get cart() { return cart; },
    set cart(value) { cart = value; },
  };
};

describe('hosts y URLs de checkout seguras', () => {
  test('normaliza hosts permitidos y rechaza comodines, puertos y direcciones IP', () => {
    expect(normalizeCheckoutHost('checkout.example.com')).toBe('checkout.example.com');
    expect(normalizeCheckoutHost('*.example.com')).toBeNull();
    expect(normalizeCheckoutHost('checkout.example.com:443')).toBeNull();
    expect(normalizeCheckoutHost('203.0.113.10')).toBeNull();
    expect(normalizeAllowedCheckoutHosts(['Checkout.Example.com', 'checkout.example.com'])).toEqual([
      'checkout.example.com',
    ]);
  });

  test('solo permite HTTPS y un host exacto declarado por el proveedor', () => {
    const allowed = ['checkout.example.com'];
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://checkout.example.com/cart/1',
        allowedHosts: allowed,
      })?.hostname
    ).toBe('checkout.example.com');
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://checkout.example.com.evil.test/cart/1',
        allowedHosts: allowed,
      })
    ).toBeNull();
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'http://checkout.example.com/cart/1',
        allowedHosts: allowed,
      })
    ).toBeNull();
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://user:pass@checkout.example.com/cart/1',
        allowedHosts: allowed,
      })
    ).toBeNull();
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://checkout.example.com:8443/cart/1',
        allowedHosts: allowed,
      })
    ).toBeNull();
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://evil.example.com/cart/1',
        allowedHosts: allowed,
      })
    ).toBeNull();
  });

  test('el adaptador Shopify declara hosts explícitos sin sufijos ambiguos', () => {
    const hosts = buildShopifyCheckoutHosts('kingbelt.myshopify.com');
    expect(hosts).toContain('kingbelt.myshopify.com');
    expect(hosts).toContain('checkout.shopify.com');
    expect(hosts.some((host) => host.includes('*'))).toBe(false);
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://kingbelt.myshopify.com/checkouts/cn/test',
        allowedHosts: hosts,
      })?.hostname
    ).toBe('kingbelt.myshopify.com');
    expect(
      getSafeCheckoutUrl({
        status: 'ready',
        url: 'https://kingbelt.myshopify.com.evil.test/checkouts/cn/test',
        allowedHosts: hosts,
      })
    ).toBeNull();
  });
});

describe('reconciliación de checkout', () => {
  test('detecta cambios de precio, cantidad y líneas retiradas', () => {
    const before = service.restoreCart([{ variantId: firstVariant.id, quantity: 3 }]);
    const after = structuredClone(before);
    after.lines[0].product.unitPrice = {
      ...after.lines[0].product.unitPrice,
      amountMinor: after.lines[0].product.unitPrice.amountMinor + 500,
    };
    after.lines[0].quantity = 2;

    const delta = detectCheckoutSyncDelta(before, after);
    expect(delta.priceChanged).toBe(true);
    expect(delta.quantitiesAdjusted).toBe(true);
    expect(applyCheckoutSyncNotice(after, delta).globalNotice).toContain('precios');
  });

  test('detecta una línea retirada por identidad aunque el recuento no cambie', () => {
    const before = service.restoreCart([
      { variantId: firstVariant.id, quantity: 1 },
      { variantId: secondVariant.id, quantity: 1 },
    ]);
    const after = structuredClone(before);
    after.lines = [
      after.lines[0],
      { ...after.lines[1], id: `${after.lines[1].id}-replaced` },
    ];

    const delta = detectCheckoutSyncDelta(before, after);
    expect(before.lines).toHaveLength(2);
    expect(after.lines).toHaveLength(2);
    expect(delta.linesRemoved).toBe(true);
    expect(delta.messages.join(' ')).toContain('ya no están disponibles');
  });

  test('no marca removed cuando solo aparece una línea nueva', () => {
    const before = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const after = service.restoreCart([
      { variantId: firstVariant.id, quantity: 1 },
      { variantId: secondVariant.id, quantity: 1 },
    ]);
    after.lines[0].id = before.lines[0].id;

    const delta = detectCheckoutSyncDelta(before, after);
    expect(delta.linesRemoved).toBe(false);
  });

  test('sin cambios de precio, cantidad ni identidad no emite avisos', () => {
    const before = service.restoreCart([
      { variantId: firstVariant.id, quantity: 1 },
      { variantId: secondVariant.id, quantity: 1 },
    ]);
    const after = structuredClone(before);

    expect(detectCheckoutSyncDelta(before, after)).toEqual({
      priceChanged: false,
      quantitiesAdjusted: false,
      linesRemoved: false,
      messages: [],
    });
  });

  test('un cambio de precio unitario emite el aviso de precios actualizados', () => {
    const before = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const after = structuredClone(before);
    after.lines[0].product.unitPrice = {
      ...after.lines[0].product.unitPrice,
      amountMinor: 9200,
    };

    const delta = detectCheckoutSyncDelta(before, after);
    expect(delta.priceChanged).toBe(true);
    expect(delta.quantitiesAdjusted).toBe(false);
    expect(delta.linesRemoved).toBe(false);
    expect(delta.messages.join(' ')).toContain('precios');
  });

  test('un cambio de cantidad marca quantitiesAdjusted', () => {
    const before = service.restoreCart([{ variantId: firstVariant.id, quantity: 3 }]);
    const after = structuredClone(before);
    after.lines[0].quantity = 2;

    const delta = detectCheckoutSyncDelta(before, after);
    expect(delta.quantitiesAdjusted).toBe(true);
    expect(delta.priceChanged).toBe(false);
    expect(delta.linesRemoved).toBe(false);
  });

  test('un carrito bloqueado comunica líneas inválidas o agotadas', () => {
    const cart = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const blocked = {
      ...cart,
      canCheckout: false,
      lineErrors: [{
        lineId: cart.lines[0].id,
        code: 'out_of_stock',
        message: 'Agotado temporalmente.',
        severity: 'error',
      }],
    };
    expect(buildCheckoutBlockedMessage(blocked)).toContain('marcados');
  });
});

const CHECKOUT_HOSTS = ['checkout.example.com'];
const CHECKOUT_URL = 'https://checkout.example.com/cart/1';

const readyCheckout = (cart, extras = {}) => ({
  status: 'ready',
  url: CHECKOUT_URL,
  allowedHosts: CHECKOUT_HOSTS,
  cart,
  ...extras,
});

const soldOutCart = (cart) => {
  const next = structuredClone(cart);
  next.lines[0].availability = {
    status: 'out_of_stock',
    message: 'Agotado',
    maxQuantity: 0,
    quantityKnown: true,
    backorder: false,
    limitReason: 'inventory',
  };
  next.canCheckout = false;
  next.lineErrors = [{
    lineId: next.lines[0].id,
    code: 'out_of_stock',
    message: 'Agotado',
    severity: 'error',
  }];
  return next;
};

const withLinePrice = (cart, amountMinor) => {
  const next = structuredClone(cart);
  next.lines[0].product.unitPrice = { ...next.lines[0].product.unitPrice, amountMinor };
  next.lines[0].lineTotal = {
    ...next.lines[0].lineTotal,
    amountMinor: amountMinor * next.lines[0].quantity,
  };
  return next;
};

describe('flujo de checkout en el store', () => {
  test('checkout realiza una sola operación remota sin refresh', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let refreshCalls = 0;
    let checkoutCalls = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => {
        checkoutCalls += 1;
        return readyCheckout(initial);
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(refreshCalls).toBe(0);
    expect(checkoutCalls).toBe(1);
    expect(result.status).toBe('ready');
    expect(result.priceChanged).toBe(false);
    expect(store.getCart().status).toBe('idle');
    expect(store.getCart().lines[0].id).toBe(initial.lines[0].id);
  });

  test('un ready con el mismo precio no marca priceChanged', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let refreshCalls = 0;
    let checkoutCalls = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => {
        checkoutCalls += 1;
        return readyCheckout(structuredClone(initial));
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('ready');
    expect(result.priceChanged).toBe(false);
    expect(refreshCalls).toBe(0);
    expect(checkoutCalls).toBe(1);
  });

  test('un cambio de precio en el Cart de checkout se detecta sin refresh', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    initial.lines[0].product.unitPrice = { ...initial.lines[0].product.unitPrice, amountMinor: 8900 };
    initial.lines[0].lineTotal = { ...initial.lines[0].lineTotal, amountMinor: 8900 };
    let refreshCalls = 0;
    let checkoutCalls = 0;
    const authoritative = withLinePrice(initial, 9200);
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => {
        checkoutCalls += 1;
        return readyCheckout(authoritative);
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('ready');
    expect(result.priceChanged).toBe(true);
    expect(store.getCart().lines[0].product.unitPrice.amountMinor).toBe(9200);
    expect(store.getCart().globalNotice).toContain('precios');
    expect(refreshCalls).toBe(0);
    expect(checkoutCalls).toBe(1);
  });

  test('una cantidad ajustada en checkout actualiza el Cart y avisa sin refresh', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 3 }]);
    let refreshCalls = 0;
    const authoritative = structuredClone(initial);
    authoritative.lines[0].quantity = 2;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => readyCheckout(authoritative),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('ready');
    expect(store.getCart().lines[0].quantity).toBe(2);
    expect(store.getCart().globalNotice).toContain('cantidades');
    expect(refreshCalls).toBe(0);
  });

  test('una línea retirada en checkout actualiza el Cart y avisa sin refresh', async () => {
    const initial = service.restoreCart([
      { variantId: firstVariant.id, quantity: 1 },
      { variantId: secondVariant.id, quantity: 1 },
    ]);
    let refreshCalls = 0;
    const authoritative = structuredClone(initial);
    authoritative.lines = [authoritative.lines[0]];
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => readyCheckout(authoritative),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('ready');
    expect(store.getCart().lines).toHaveLength(1);
    expect(store.getCart().lines[0].id).toBe(initial.lines[0].id);
    expect(store.getCart().globalNotice).toContain('ya no están disponibles');
    expect(refreshCalls).toBe(0);
  });

  test('un blocked usa el Cart autoritativo de checkout sin refresh', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const blocked = soldOutCart(initial);
    let refreshCalls = 0;
    let checkoutCalls = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return blocked;
      },
      checkout: async () => {
        checkoutCalls += 1;
        return { status: 'blocked', cart: blocked, message: 'Agotado' };
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('blocked');
    expect(store.getCart()).toMatchObject({ canCheckout: false, status: 'idle' });
    expect(store.getCart().lineErrors[0].code).toBe('out_of_stock');
    expect(refreshCalls).toBe(0);
    expect(checkoutCalls).toBe(1);
  });

  test('ready con canCheckout false se convierte en blocked', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const blocked = soldOutCart(initial);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => readyCheckout(blocked),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('blocked');
    expect(getSafeCheckoutUrl(result)).toBeNull();
    expect(store.getCart().canCheckout).toBe(false);
  });

  test('ready sin Cart autoritativo es error y conserva beforeSync', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => ({
        status: 'ready',
        url: CHECKOUT_URL,
        allowedHosts: CHECKOUT_HOSTS,
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('error');
    expect(getSafeCheckoutUrl(result)).toBeNull();
    expect(store.getCart().lines).toHaveLength(1);
    expect(store.getCart().status).toBe('error');
  });

  test('ready sin URL es error', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => ({
        status: 'ready',
        cart: initial,
        allowedHosts: CHECKOUT_HOSTS,
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('error');
    expect(store.getCart().lines).toHaveLength(1);
  });

  test('ready sin allowedHosts es error', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => ({
        status: 'ready',
        url: CHECKOUT_URL,
        cart: initial,
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('error');
    expect(store.getCart().lines).toHaveLength(1);
  });

  test('expired deja un carrito vacío autoritativo', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => ({
        status: 'expired',
        cart: emptyCart(),
        message: CHECKOUT_EXPIRED_MESSAGE,
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('expired');
    expect(result.message).toBe(CHECKOUT_EXPIRED_MESSAGE);
    expect(store.getCart().lines).toHaveLength(0);
    expect(store.getCart().status).toBe('idle');
    expect(store.getCart().globalNotice).toContain('caducado');
  });

  test('expired no regenera checkout sin volver a añadir productos', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    const provider = createProvider({
      initialCart: initial,
      checkout: async () => ({
        status: 'expired',
        cart: emptyCart(),
        message: CHECKOUT_EXPIRED_MESSAGE,
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    expect((await store.checkout()).status).toBe('expired');
    expect(store.getCart().lines).toHaveLength(0);
    expect((await store.checkout()).status).toBe('expired');
    expect(store.getCart().lines).toHaveLength(0);
  });

  test('deduplica checkouts simultáneos y conserva el carrito ante errores', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let refreshCalls = 0;
    let checkoutCalls = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: async () => {
        checkoutCalls += 1;
        throw new Error('provider down');
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const first = store.checkout();
    const second = store.checkout();
    expect(second).toBe(first);
    const result = await first;

    expect(checkoutCalls).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(result.status).toBe('error');
    expect(store.getCart().lines).toHaveLength(1);
    expect(store.getCart().status).toBe('error');
  });

  test('un timeout de checkout conserva el carrito y no llama refresh', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 2 }]);
    let refreshCalls = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return initial;
      },
      checkout: () => new Promise(() => {}),
    });
    const store = createCartStore(provider, { checkoutTimeoutMs: 10 });
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('error');
    expect(result.message).toContain('conservado');
    expect(store.getCart().lines[0].quantity).toBe(2);
    expect(store.getCart().status).toBe('error');
    expect(refreshCalls).toBe(0);
  });

  test('withCheckoutTimeout rechaza promesas lentas', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 50));
    await expect(withCheckoutTimeout(slow, 5)).rejects.toBeInstanceOf(CheckoutTimeoutError);
  });
});

describe('adaptador HTTP Shopify de checkout', () => {
  test('checkout envía una sola request command=checkout', async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      calls.push(JSON.parse(init.body));
      return Response.json({
        status: 'ready',
        url: 'https://kingbelt.myshopify.com/checkouts/cn/test',
        allowedHosts: ['kingbelt.myshopify.com'],
        cart: emptyCart(),
      });
    };

    try {
      const result = await createShopifyCartAdapter().checkout();
      expect(calls).toEqual([{ command: 'checkout' }]);
      expect(result.status).toBe('ready');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('vuelta desde checkout', () => {
  test('interpreta parámetros de retorno y ofrece mensajes coherentes', () => {
    expect(parseCheckoutReturn(new URLSearchParams(`${CHECKOUT_RETURN_PARAM}=${CHECKOUT_RETURN_COMPLETED}`)))
      .toBe(CHECKOUT_RETURN_COMPLETED);
    expect(parseCheckoutReturn(new URLSearchParams(`${CHECKOUT_RETURN_PARAM}=${CHECKOUT_RETURN_CANCELLED}`)))
      .toBe(CHECKOUT_RETURN_CANCELLED);
    expect(parseCheckoutReturn(new URLSearchParams(`${CHECKOUT_RETURN_PARAM}=javascript:alert(1)`)))
      .toBeNull();
    expect(parseCheckoutReturn(new URLSearchParams(`${CHECKOUT_RETURN_PARAM}=${'a'.repeat(40)}`)))
      .toBeNull();
    expect(getCheckoutReturnNotice(CHECKOUT_RETURN_CANCELLED)).toContain('carrito');
  });
});
