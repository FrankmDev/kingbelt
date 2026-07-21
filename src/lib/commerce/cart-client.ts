import { emptyCart } from './cart-operations';
import { formatMoney } from './money';
import { commerceProvider } from './provider';
import type {
  AddToCartInput,
  Cart,
  CartLine,
  CartOperationResult,
  CheckoutResult,
} from './types';

export const CART_DRAWER_OPEN_EVENT = 'kb:cart:drawer-open';

interface CartDrawerEventDetail {
  trigger: HTMLElement | null;
}

let currentCart: Cart = emptyCart();
let initialization: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
let checkoutRequest: Promise<CheckoutResult> | null = null;
const subscribers = new Set<(cart: Cart) => void>();

const publishCart = (cart: Cart) => {
  currentCart = cart;
  subscribers.forEach((callback) => callback(currentCart));
};

const providerFailure = (): CartOperationResult => {
  const cart: Cart = {
    ...currentCart,
    status: 'error',
    globalError: 'No se pudo actualizar el carrito. Inténtalo de nuevo.',
  };
  publishCart(cart);

  return {
    success: false,
    cart,
    error: { code: 'provider_error', message: cart.globalError ?? 'Error de carrito.' },
  };
};

const enqueueMutation = (
  operation: () => Promise<CartOperationResult>
): Promise<CartOperationResult> => {
  let resolveResult: (result: CartOperationResult) => void = () => undefined;
  const resultPromise = new Promise<CartOperationResult>((resolve) => {
    resolveResult = resolve;
  });

  mutationQueue = mutationQueue
    .then(async () => {
      publishCart({ ...currentCart, status: 'updating', globalError: undefined });

      try {
        const result = await operation();
        const nextCart: Cart = { ...result.cart, status: 'idle' };
        const normalizedResult = { ...result, cart: nextCart };
        publishCart(nextCart);
        resolveResult(normalizedResult);
      } catch {
        resolveResult(providerFailure());
      }
    })
    .catch(() => {
      resolveResult(providerFailure());
    });

  return resultPromise;
};

export const initCartStore = (): Promise<void> => {
  if (initialization) return initialization;

  publishCart({ ...currentCart, status: 'recovering' });
  initialization = commerceProvider
    .initialize()
    .then((cart) => publishCart({ ...cart, status: 'idle' }))
    .catch(() => {
      publishCart({
        ...emptyCart('error'),
        globalError: 'No se pudo recuperar el carrito guardado.',
      });
    });

  return initialization;
};

export const getCart = (): Cart => currentCart;

export const addProductToCart = (input: AddToCartInput): Promise<CartOperationResult> =>
  enqueueMutation(() => commerceProvider.addItem(input));

export const changeLineQuantity = (
  lineId: string,
  quantity: number
): Promise<CartOperationResult> =>
  enqueueMutation(() => commerceProvider.updateItem(lineId, quantity));

export const deleteLine = (lineId: string): Promise<CartOperationResult> =>
  enqueueMutation(() => commerceProvider.removeItem(lineId));

export const startCheckout = (): Promise<CheckoutResult> => {
  if (checkoutRequest) return checkoutRequest;

  checkoutRequest = commerceProvider
    .checkout()
    .catch(() => ({
      status: 'error' as const,
      message: 'No se pudo preparar el checkout. Inténtalo de nuevo.',
    }))
    .finally(() => {
      checkoutRequest = null;
    });

  return checkoutRequest;
};

export const openCartDrawer = (trigger?: HTMLElement | null) => {
  const activeElement = document.activeElement;
  const fallbackTrigger = activeElement instanceof HTMLElement ? activeElement : null;

  document.dispatchEvent(
    new CustomEvent<CartDrawerEventDetail>(CART_DRAWER_OPEN_EVENT, {
      detail: { trigger: trigger ?? fallbackTrigger },
    })
  );
};

export const subscribeCart = (callback: (cart: Cart) => void) => {
  subscribers.add(callback);
  callback(currentCart);

  return () => subscribers.delete(callback);
};

export const getLineError = (cart: Cart, lineId: string) =>
  cart.lineErrors.find((error) => error.lineId === lineId);

export const formatLineMeta = (line: CartLine) =>
  `${line.color} · Talla ${line.size}${line.product.sizeUnit ? ` ${line.product.sizeUnit}` : ''}`;

export { formatMoney };
export type { CartDrawerEventDetail };
