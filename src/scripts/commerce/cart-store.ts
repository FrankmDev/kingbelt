import { emptyCart } from '@commerce/application/cart-service';
import { formatMoney } from '@commerce/domain/money';
import { cartProvider } from '@commerce/cart';
import type { CartProvider } from '@commerce/application/cart-provider';
import type {
  AddToCartInput,
  Cart,
  CartLine,
  CartOperationResult,
} from '@commerce/domain/cart';
import {
  DEFAULT_CHECKOUT_TIMEOUT_MS,
  type CheckoutResult,
} from '@commerce/application/checkout';
import { runCheckoutOrchestration } from '@commerce/application/checkout-orchestration';
import {
  CART_DRAWER_OPEN_EVENT,
  type CartDrawerEventDetail,
} from '@shared/browser/cart-events';

interface PendingQuantityMutation {
  desiredQuantity: number;
  waiters: Array<(result: CartOperationResult) => void>;
}

const errorMessage = 'No se pudo actualizar el carrito. Inténtalo de nuevo.';

export const createCartStore = (
  provider: CartProvider,
  options: { checkoutTimeoutMs?: number } = {}
) => {
  const checkoutTimeoutMs = options.checkoutTimeoutMs ?? DEFAULT_CHECKOUT_TIMEOUT_MS;
  let currentCart: Cart = emptyCart();
  let initialization: Promise<void> | null = null;
  let mutationTail: Promise<void> = Promise.resolve();
  let checkoutRequest: Promise<CheckoutResult> | null = null;
  let externalRefreshQueued = false;
  let externalSubscriptionBound = false;
  const subscribers = new Set<(cart: Cart) => void>();
  const addRequests = new Map<string, Promise<CartOperationResult>>();
  const removeRequests = new Map<string, Promise<CartOperationResult>>();
  const quantityRequests = new Map<string, PendingQuantityMutation>();

  const publishCart = (cart: Cart) => {
    currentCart = cart;
    subscribers.forEach((callback) => callback(currentCart));
  };

  const providerFailure = (fallback: Cart, message = errorMessage): CartOperationResult => {
    const cart: Cart = {
      ...fallback,
      status: 'error',
      globalError: message,
    };
    publishCart(cart);
    return {
      success: false,
      cart,
      error: { code: 'provider_error', message },
    };
  };

  const init = (): Promise<void> => {
    if (initialization) return initialization;

    publishCart({ ...currentCart, status: 'recovering', globalError: undefined });
    initialization = provider
      .initialize()
      .then((cart) => publishCart({ ...cart, status: 'idle' }))
      .catch(() => {
        publishCart({
          ...emptyCart('error'),
          globalError: 'No se pudo recuperar el carrito guardado.',
        });
      });

    if (!externalSubscriptionBound && provider.subscribeToExternalChanges) {
      externalSubscriptionBound = true;
      provider.subscribeToExternalChanges(() => {
        if (externalRefreshQueued) return;
        externalRefreshQueued = true;
        void schedule(async () => {
          const fallback = currentCart;
          publishCart({ ...currentCart, status: 'recovering', globalError: undefined });
          try {
            const cart = await provider.refresh();
            publishCart({ ...cart, status: 'idle' });
          } catch {
            providerFailure(fallback, 'No se pudo sincronizar el carrito con otra pestaña.');
          } finally {
            externalRefreshQueued = false;
          }
        });
      });
    }

    return initialization;
  };

  const schedule = <T>(task: () => Promise<T>): Promise<T> => {
    const scheduled = mutationTail.then(async () => {
      await init();
      return task();
    });
    mutationTail = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  };

  const runMutation = (
    operation: () => Promise<CartOperationResult>
  ): Promise<CartOperationResult> => schedule(async () => {
    const fallback = currentCart;
    publishCart({ ...currentCart, status: 'updating', globalError: undefined });
    try {
      const result = await operation();
      const nextCart: Cart = { ...result.cart, status: 'idle' };
      const normalizedResult = { ...result, cart: nextCart };
      publishCart(nextCart);
      return normalizedResult;
    } catch {
      return providerFailure(fallback);
    }
  });

  const add = (input: AddToCartInput): Promise<CartOperationResult> => {
    const key = `${input.variantId}\u0000${input.quantity}`;
    const existing = addRequests.get(key);
    if (existing) return existing;

    const request = runMutation(() => provider.addItem(input)).finally(() => {
      if (addRequests.get(key) === request) addRequests.delete(key);
    });
    addRequests.set(key, request);
    return request;
  };

  const updateQuantity = (
    lineId: string,
    quantity: number
  ): Promise<CartOperationResult> => {
    const existing = quantityRequests.get(lineId);
    if (existing) {
      existing.desiredQuantity = quantity;
      return new Promise((resolve) => existing.waiters.push(resolve));
    }

    const pending: PendingQuantityMutation = {
      desiredQuantity: quantity,
      waiters: [],
    };
    quantityRequests.set(lineId, pending);

    const request = schedule(async () => {
      const fallback = currentCart;
      publishCart({ ...currentCart, status: 'updating', globalError: undefined });
      try {
        let result: CartOperationResult;
        let appliedQuantity: number;
        do {
          appliedQuantity = pending.desiredQuantity;
          result = await provider.updateItem(lineId, appliedQuantity);
        } while (result.success && appliedQuantity !== pending.desiredQuantity);

        // Libera la línea antes de publicar: cualquier cambio posterior crea una
        // nueva mutación en lugar de quedar absorbida por una entrada ya resuelta.
        quantityRequests.delete(lineId);
        const nextCart: Cart = { ...result.cart, status: 'idle' };
        const normalizedResult = { ...result, cart: nextCart };
        publishCart(nextCart);
        return normalizedResult;
      } catch {
        quantityRequests.delete(lineId);
        return providerFailure(fallback);
      }
    });

    void request.then((result) => {
      pending.waiters.forEach((resolve) => resolve(result));
    });
    return new Promise((resolve) => pending.waiters.push(resolve));
  };

  const remove = (lineId: string): Promise<CartOperationResult> => {
    const existing = removeRequests.get(lineId);
    if (existing) return existing;

    const request = runMutation(() => provider.removeItem(lineId)).finally(() => {
      if (removeRequests.get(lineId) === request) removeRequests.delete(lineId);
    });
    removeRequests.set(lineId, request);
    return request;
  };

  const reset = (): Promise<CartOperationResult> =>
    runMutation(() => provider.resetCart());

  const checkout = (): Promise<CheckoutResult> => {
    if (checkoutRequest) return checkoutRequest;

    checkoutRequest = schedule(async () => {
      const beforeSync = currentCart;
      publishCart({ ...beforeSync, status: 'checkout', globalError: undefined });
      const outcome = await runCheckoutOrchestration(
        { checkout: () => provider.checkout() },
        { beforeSync, timeoutMs: checkoutTimeoutMs }
      );
      publishCart(outcome.cart);
      return outcome.result;
    }).finally(() => {
      checkoutRequest = null;
    });

    return checkoutRequest;
  };

  return {
    init,
    getCart: () => currentCart,
    add,
    updateQuantity,
    remove,
    reset,
    checkout,
    subscribe(callback: (cart: Cart) => void) {
      subscribers.add(callback);
      callback(currentCart);
      return () => subscribers.delete(callback);
    },
  };
};

const cartStore = createCartStore(cartProvider);

export const initCartStore = cartStore.init;
export const getCart = cartStore.getCart;
export const addProductToCart = cartStore.add;
export const changeLineQuantity = cartStore.updateQuantity;
export const deleteLine = cartStore.remove;
export const resetCurrentCart = cartStore.reset;
export const startCheckout = cartStore.checkout;
export const subscribeCart = cartStore.subscribe;

export const openCartDrawer = (trigger?: HTMLElement | null) => {
  const activeElement = document.activeElement;
  const fallbackTrigger = activeElement instanceof HTMLElement ? activeElement : null;
  document.dispatchEvent(
    new CustomEvent<CartDrawerEventDetail>(CART_DRAWER_OPEN_EVENT, {
      detail: { trigger: trigger ?? fallbackTrigger },
    })
  );
};

export const getLineError = (cart: Cart, lineId: string) =>
  cart.lineErrors.find((error) => error.lineId === lineId);

export const formatLineMeta = (line: CartLine) =>
  line.selectedOptions
    .map((option) => `${option.name}: ${option.value}${option.name === 'Talla' ? ' cm' : ''}`)
    .join(' · ');

export { formatMoney };
export { CART_DRAWER_OPEN_EVENT } from '@shared/browser/cart-events';
export type { CartDrawerEventDetail } from '@shared/browser/cart-events';
