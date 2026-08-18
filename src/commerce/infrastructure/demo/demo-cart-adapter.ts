import {
  CART_CATALOG_PATH,
  parseCartCatalogSnapshot,
} from '../../application/cart-catalog';
import {
  createCartService,
  emptyCart,
} from '../../application/cart-service';
import type { CartCatalog } from '../../application/cart-service';
import { requestDemoCheckout } from '../../application/checkout';
import { demoCartCatalog } from './demo-catalog-adapter';
import {
  LEGACY_CART_STORAGE_KEYS,
  LOCAL_CART_STORAGE_KEY,
  persistCart,
  readPersistedCart,
  type PersistedCartReadResult,
  type StorageLike,
} from './cart-storage';
import type { AddToCartInput, Cart, CartOperationResult } from '../../domain/cart';
import type { CartProvider } from '../../application/cart-provider';

interface DemoCartAdapterOptions {
  storage?: StorageLike | null;
  catalog?: CartCatalog;
  loadPublishedCatalog?: () => Promise<unknown>;
}

const CART_LOCK_NAME = 'kingbelt:cart';
const STORAGE_UNAVAILABLE_NOTICE =
  'El carrito se mantiene en esta pestaña, pero el navegador no permite guardarlo ahora mismo.';

const getBrowserStorage = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const getBrowserLockManager = (): LockManager | null => {
  try {
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null;
  } catch {
    return null;
  }
};

const appendNotice = (cart: Cart, message: string): Cart => ({
  ...cart,
  globalNotice: cart.globalNotice?.includes(message)
    ? cart.globalNotice
    : cart.globalNotice
      ? `${cart.globalNotice} ${message}`
      : message,
});

export const createDemoCartAdapter = (
  options: DemoCartAdapterOptions = {}
): CartProvider => {
  let activeCatalog = options.catalog ?? demoCartCatalog;
  const catalog: CartCatalog = {
    getVariant: (variantId) => activeCatalog.getVariant(variantId),
    resolveLegacyVariant: (productId, color, size) =>
      activeCatalog.resolveLegacyVariant(productId, color, size),
  };
  const cartService = createCartService(catalog);
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
  const browserStorageUnavailable =
    options.storage === undefined && typeof window !== 'undefined' && storage === null;
  const lockManager = options.storage === undefined ? getBrowserLockManager() : null;
  const externalListeners = new Set<() => void>();
  let cart: Cart = emptyCart();
  let operationTail: Promise<void> = Promise.resolve();
  let storageDegraded = browserStorageUnavailable;
  const shouldLoadPublishedCatalog =
    options.catalog === undefined &&
    (options.storage === undefined || options.loadPublishedCatalog !== undefined);
  let publishedCatalogLoaded = false;

  const readPublishedSnapshot = async (): Promise<unknown> => {
    if (options.loadPublishedCatalog) return options.loadPublishedCatalog();
    const response = await fetch(CART_CATALOG_PATH, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('catalog_unavailable');
    return response.json();
  };

  const loadPublishedCatalog = async (): Promise<void> => {
    if (!shouldLoadPublishedCatalog || publishedCatalogLoaded) return;
    publishedCatalogLoaded = true;
    try {
      const next = parseCartCatalogSnapshot(await readPublishedSnapshot());
      if (next) activeCatalog = next;
    } catch {
      // Conserva el catálogo de respaldo; addItem falla cerrado si el ID no existe.
    }
  };

  const runExclusive = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = operationTail.then(() =>
      lockManager
        ? lockManager.request(CART_LOCK_NAME, { mode: 'exclusive' }, operation)
        : operation()
    );
    operationTail = run.then(() => undefined, () => undefined);
    return run;
  };

  const read = (): PersistedCartReadResult => storage
    ? readPersistedCart(storage)
    : { lines: [], source: 'empty', discardedCount: 0 };

  const restore = (persisted: PersistedCartReadResult, fallback: Cart): Cart => {
    if (persisted.source === 'unavailable') {
      storageDegraded = true;
      return appendNotice(fallback, STORAGE_UNAVAILABLE_NOTICE);
    }
    if (persisted.source === 'invalid') {
      return {
        ...fallback,
        globalError: 'El carrito guardado no era válido. Se ha ignorado para proteger tus datos.',
      };
    }
    if (persisted.source === 'empty') return emptyCart();
    return cartService.restoreCart(persisted.lines, persisted.discardedCount);
  };

  const save = (nextCart: Cart): Cart => {
    if (!storage) {
      return browserStorageUnavailable ? appendNotice(nextCart, STORAGE_UNAVAILABLE_NOTICE) : nextCart;
    }
    if (persistCart(storage, nextCart)) {
      storageDegraded = false;
      return nextCart;
    }
    storageDegraded = true;
    return appendNotice(nextCart, STORAGE_UNAVAILABLE_NOTICE);
  };

  const prepareMutationBase = (): Cart => {
    if (!storage) return cartService.refreshCart(cart);
    if (storageDegraded) return cartService.refreshCart(cart);
    const persisted = read();
    if (persisted.source === 'invalid' || persisted.source === 'unavailable') {
      return restore(persisted, cartService.refreshCart(cart));
    }
    return restore(persisted, cart);
  };

  const mutate = (
    operation: (base: Cart) => CartOperationResult
  ): Promise<CartOperationResult> => runExclusive(async () => {
    const base = prepareMutationBase();
    const result = operation(base);
    const nextCart = result.success ? save(result.cart) : result.cart;
    cart = nextCart;
    return { ...result, cart: nextCart };
  });

  if (typeof window !== 'undefined' && options.storage === undefined) {
    window.addEventListener('storage', (event) => {
      if (
        event.key !== null &&
        event.key !== LOCAL_CART_STORAGE_KEY &&
        !LEGACY_CART_STORAGE_KEYS.includes(event.key as (typeof LEGACY_CART_STORAGE_KEYS)[number])
      ) return;
      externalListeners.forEach((listener) => listener());
    });
  }

  return {
    initialize: () => runExclusive(async () => {
      await loadPublishedCatalog();
      if (!storage) {
        if (browserStorageUnavailable) cart = appendNotice(cart, STORAGE_UNAVAILABLE_NOTICE);
        return cart;
      }
      const persisted = read();
      const fallback = persisted.source === 'invalid' ? emptyCart() : cart;
      cart = restore(persisted, fallback);
      if (persisted.source === 'current' || persisted.source === 'legacy') cart = save(cart);
      return cart;
    }),

    refresh: () => runExclusive(async () => {
      if (!storage || storageDegraded) {
        cart = cartService.refreshCart(cart);
        if (browserStorageUnavailable) cart = appendNotice(cart, STORAGE_UNAVAILABLE_NOTICE);
        return cart;
      }
      const persisted = read();
      if (persisted.source !== 'unavailable') storageDegraded = false;
      cart = restore(persisted, cart);
      return cart;
    }),

    addItem: (input: AddToCartInput) =>
      mutate((base) => cartService.addToCart(base, input)),

    updateItem: (lineId: string, quantity: number) =>
      mutate((base) => cartService.updateLineQuantity(base, lineId, quantity)),

    removeItem: (lineId: string) =>
      mutate((base) => cartService.removeLine(base, lineId)),

    checkout: requestDemoCheckout,

    subscribeToExternalChanges(listener) {
      externalListeners.add(listener);
      return () => externalListeners.delete(listener);
    },
  };
};
