import { describe, expect, test } from 'bun:test';
import { demoProducts } from '../src/demo-catalog.ts';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import {
  applyCheckoutSyncNotice,
  buildCheckoutBlockedMessage,
  CHECKOUT_RETURN_CANCELLED,
  CHECKOUT_RETURN_COMPLETED,
  CHECKOUT_RETURN_PARAM,
  CheckoutTimeoutError,
  detectCheckoutSyncDelta,
  getCheckoutReturnNotice,
  parseCheckoutReturn,
  withCheckoutTimeout,
} from '../src/commerce/application/checkout.ts';
import {
  buildShopifyCheckoutHosts,
  getSafeCheckoutUrl,
  normalizeAllowedCheckoutHosts,
  normalizeCheckoutHost,
} from '../src/commerce/application/checkout-redirect.ts';
import { createCartStore } from '../src/scripts/commerce/cart-store.ts';
import { demoCartCatalog } from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';

const service = createCartService(demoCartCatalog);
const variants = demoProducts
  .flatMap((product) => product.variants)
  .filter((variant) => variant.salesStatus === 'active');
const firstVariant = variants[0];

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

describe('sincronización previa al checkout', () => {
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

describe('flujo de checkout en el store', () => {
  test('deduplica checkouts simultáneos y conserva el carrito ante errores', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let checkoutCalls = 0;
    const provider = createProvider({
      initialCart: initial,
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
    expect(result.status).toBe('error');
    expect(store.getCart().lines).toHaveLength(1);
    expect(store.getCart().status).toBe('error');
  });

  test('sincroniza con la autoridad antes de crear checkout y bloquea líneas inválidas', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let refreshCalls = 0;
    const soldOut = structuredClone(initial);
    soldOut.lines[0].availability = {
      status: 'out_of_stock',
      message: 'Agotado',
      maxQuantity: 0,
      quantityKnown: true,
      backorder: false,
      limitReason: 'inventory',
    };
    soldOut.canCheckout = false;
    soldOut.lineErrors = [{
      lineId: soldOut.lines[0].id,
      code: 'out_of_stock',
      message: 'Agotado',
      severity: 'error',
    }];

    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        refreshCalls += 1;
        return soldOut;
      },
      checkout: async () => ({
        status: 'ready',
        url: 'https://checkout.example.com/cart/1',
        allowedHosts: ['checkout.example.com'],
      }),
    });
    const store = createCartStore(provider);
    await store.init();

    const result = await store.checkout();
    expect(refreshCalls).toBe(1);
    expect(result.status).toBe('blocked');
    expect(store.getCart().canCheckout).toBe(false);
  });

  test('propaga cambios de precio antes de redirigir y permite regenerar checkout caducado', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 1 }]);
    let attempts = 0;
    const provider = createProvider({
      initialCart: initial,
      refresh: async () => {
        const refreshed = service.refreshCart(initial);
        refreshed.lines[0].product.unitPrice = {
          ...refreshed.lines[0].product.unitPrice,
          amountMinor: refreshed.lines[0].product.unitPrice.amountMinor + 250,
        };
        refreshed.lines[0].lineTotal = {
          ...refreshed.lines[0].lineTotal,
          amountMinor: refreshed.lines[0].product.unitPrice.amountMinor * refreshed.lines[0].quantity,
        };
        return refreshed;
      },
      checkout: async () => {
        attempts += 1;
        if (attempts === 1) {
          return { status: 'expired', message: 'Sesión caducada' };
        }
        return {
          status: 'ready',
          url: 'https://checkout.example.com/cart/2',
          allowedHosts: ['checkout.example.com'],
        };
      },
    });
    const store = createCartStore(provider);
    await store.init();

    const expired = await store.checkout();
    expect(expired.status).toBe('expired');
    expect(store.getCart().globalNotice).toContain('caduc');

    const regenerated = await store.checkout();
    expect(regenerated.status).toBe('ready');
    expect(getSafeCheckoutUrl(regenerated)?.pathname).toBe('/cart/2');
    expect(attempts).toBe(2);
  });

  test('un timeout conserva el carrito y ofrece recuperación', async () => {
    const initial = service.restoreCart([{ variantId: firstVariant.id, quantity: 2 }]);
    const provider = createProvider({
      initialCart: initial,
      refresh: () => new Promise(() => {}),
    });
    const store = createCartStore(provider, { checkoutTimeoutMs: 10 });
    await store.init();

    const result = await store.checkout();
    expect(result.status).toBe('error');
    expect(result.message).toContain('conservado');
    expect(store.getCart().lines[0].quantity).toBe(2);
    expect(store.getCart().status).toBe('error');
  });

  test('withCheckoutTimeout rechaza promesas lentas', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 50));
    await expect(withCheckoutTimeout(slow, 5)).rejects.toBeInstanceOf(CheckoutTimeoutError);
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
