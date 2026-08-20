import type { Cart } from '../domain/cart';
import { emptyCart } from './cart-service';
import type { CheckoutResult } from './checkout';
import {
  applyCheckoutSyncNotice,
  buildCheckoutBlockedMessage,
  CHECKOUT_EXPIRED_MESSAGE,
  CheckoutTimeoutError,
  detectCheckoutSyncDelta,
  withCheckoutTimeout,
} from './checkout';

const CHECKOUT_TIMEOUT_MESSAGE =
  'La preparación del checkout está tardando más de lo habitual. Tu carrito se ha conservado; inténtalo de nuevo.';
const CHECKOUT_ERROR_MESSAGE = 'No se pudo preparar el checkout. Inténtalo de nuevo.';

export interface CheckoutOrchestrationPorts {
  checkout(): Promise<CheckoutResult>;
}

export interface CheckoutOrchestrationOptions {
  beforeSync: Cart;
  timeoutMs: number;
}

export interface CheckoutOrchestrationOutcome {
  cart: Cart;
  result: CheckoutResult;
}

const preserveBeforeSync = (
  beforeSync: Cart,
  result: Pick<CheckoutResult, 'status' | 'message'>
): CheckoutOrchestrationOutcome => {
  const message = result.message ?? CHECKOUT_ERROR_MESSAGE;
  return {
    cart: { ...beforeSync, status: 'error', globalError: message },
    result: { ...result, status: result.status, cart: beforeSync, message },
  };
};

/** Una operación remota de checkout; el snapshot local solo sirve para avisos UX. */
export const runCheckoutOrchestration = async (
  ports: CheckoutOrchestrationPorts,
  options: CheckoutOrchestrationOptions
): Promise<CheckoutOrchestrationOutcome> => {
  const { beforeSync, timeoutMs } = options;

  try {
    const result = await withCheckoutTimeout(ports.checkout(), timeoutMs);

    const applyDelta = (authoritative: Cart) => {
      const delta = detectCheckoutSyncDelta(beforeSync, authoritative);
      return {
        cart: applyCheckoutSyncNotice(authoritative, delta),
        priceChanged: Boolean(result.priceChanged || delta.priceChanged),
      };
    };

    switch (result.status) {
      case 'ready': {
        if (!result.cart || !result.url || !result.allowedHosts?.length) {
          return preserveBeforeSync(beforeSync, { status: 'error', message: result.message });
        }

        const synced = applyDelta(result.cart);
        if (!synced.cart.canCheckout) {
          return {
            cart: { ...synced.cart, status: 'idle' },
            result: {
              status: 'blocked',
              cart: synced.cart,
              priceChanged: synced.priceChanged,
              message: result.message ?? buildCheckoutBlockedMessage(synced.cart),
            },
          };
        }

        return {
          cart: { ...synced.cart, status: 'idle' },
          result: { ...result, cart: synced.cart, priceChanged: synced.priceChanged },
        };
      }
      case 'blocked': {
        if (!result.cart) {
          return {
            cart: { ...beforeSync, status: 'idle' },
            result: {
              status: 'blocked',
              cart: beforeSync,
              message: result.message ?? buildCheckoutBlockedMessage(beforeSync),
            },
          };
        }

        const synced = applyDelta(result.cart);
        return {
          cart: { ...synced.cart, status: 'idle' },
          result: {
            ...result,
            cart: synced.cart,
            priceChanged: synced.priceChanged,
            message: result.message ?? buildCheckoutBlockedMessage(synced.cart),
          },
        };
      }
      case 'expired': {
        const expiredCart = result.cart ?? emptyCart();
        const message = result.message ?? CHECKOUT_EXPIRED_MESSAGE;
        const notice = expiredCart.globalNotice?.includes(message)
          ? expiredCart.globalNotice
          : expiredCart.globalNotice
            ? `${expiredCart.globalNotice} ${message}`
            : message;
        return {
          cart: { ...expiredCart, status: 'idle', globalNotice: notice },
          result: { ...result, cart: expiredCart, message },
        };
      }
      case 'error':
      case 'unavailable':
        return preserveBeforeSync(beforeSync, result);
    }
  } catch (error) {
    const message = error instanceof CheckoutTimeoutError
      ? CHECKOUT_TIMEOUT_MESSAGE
      : CHECKOUT_ERROR_MESSAGE;
    return preserveBeforeSync(beforeSync, { status: 'error', message });
  }
};
