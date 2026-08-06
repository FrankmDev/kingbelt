import type { Cart } from '../domain/cart';
import type { CheckoutResult } from './checkout';
import {
  applyCheckoutSyncNotice,
  buildCheckoutBlockedMessage,
  CheckoutTimeoutError,
  detectCheckoutSyncDelta,
  withCheckoutTimeout,
} from './checkout';

const CHECKOUT_EXPIRED_NOTICE = 'La sesión de checkout caducó; puedes generar una nueva.';
const CHECKOUT_TIMEOUT_MESSAGE =
  'La preparación del checkout está tardando más de lo habitual. Tu carrito se ha conservado; inténtalo de nuevo.';
const CHECKOUT_ERROR_MESSAGE = 'No se pudo preparar el checkout. Inténtalo de nuevo.';

const isFailureStatus = (status: CheckoutResult['status']): boolean =>
  status === 'error' || status === 'blocked' || status === 'expired' || status === 'unavailable';

/** Asegura `ready` solo cuando hay URL y hosts explícitos; evita redirecciones ambiguas. */
const normalizeCheckoutResult = (result: CheckoutResult): CheckoutResult => {
  if (
    result.url &&
    result.allowedHosts?.length &&
    !isFailureStatus(result.status)
  ) {
    return { ...result, status: 'ready' };
  }
  return result;
};

export interface CheckoutOrchestrationPorts {
  refresh(): Promise<Cart>;
  checkout(cart: Cart): Promise<CheckoutResult>;
}

export interface CheckoutOrchestrationOptions {
  beforeSync: Cart;
  timeoutMs: number;
}

export interface CheckoutOrchestrationOutcome {
  cart: Cart;
  result: CheckoutResult;
}

/** Caso de uso puro: sincroniza, valida y prepara checkout sin depender del navegador. */
export const runCheckoutOrchestration = async (
  ports: CheckoutOrchestrationPorts,
  options: CheckoutOrchestrationOptions
): Promise<CheckoutOrchestrationOutcome> => {
  const { beforeSync, timeoutMs } = options;

  try {
    const refreshed = await withCheckoutTimeout(ports.refresh(), timeoutMs);
    const delta = detectCheckoutSyncDelta(beforeSync, refreshed);
    const syncedCart = applyCheckoutSyncNotice(refreshed, delta);

    if (!syncedCart.canCheckout) {
      const blockedCart = { ...syncedCart, status: 'idle' as const };
      return {
        cart: blockedCart,
        result: {
          status: 'blocked',
          cart: syncedCart,
          priceChanged: delta.priceChanged,
          message: buildCheckoutBlockedMessage(syncedCart),
        },
      };
    }

    const result = normalizeCheckoutResult(
      await withCheckoutTimeout(ports.checkout(syncedCart), timeoutMs)
    );
    const authoritativeCart = result.cart ?? syncedCart;
    const priceChanged = Boolean(result.priceChanged || delta.priceChanged);

    if (result.status === 'expired') {
      const notice = authoritativeCart.globalNotice
        ? `${authoritativeCart.globalNotice} ${CHECKOUT_EXPIRED_NOTICE}`
        : CHECKOUT_EXPIRED_NOTICE;
      return {
        cart: { ...authoritativeCart, status: 'idle', globalNotice: notice },
        result: {
          ...result,
          cart: authoritativeCart,
          priceChanged,
          message: result.message ?? CHECKOUT_EXPIRED_NOTICE,
        },
      };
    }

    if (result.status === 'blocked') {
      return {
        cart: { ...authoritativeCart, status: 'idle' },
        result: {
          ...result,
          cart: authoritativeCart,
          priceChanged,
          message: result.message ?? buildCheckoutBlockedMessage(authoritativeCart),
        },
      };
    }

    if (result.status === 'error' || result.status === 'unavailable') {
      const message = result.message ?? CHECKOUT_ERROR_MESSAGE;
      return {
        cart: { ...beforeSync, status: 'error', globalError: message },
        result: {
          ...result,
          cart: beforeSync,
          priceChanged,
          message,
        },
      };
    }

    return {
      cart: { ...authoritativeCart, status: 'idle' },
      result: { ...result, cart: authoritativeCart, priceChanged },
    };
  } catch (error) {
    const timedOut = error instanceof CheckoutTimeoutError;
    const message = timedOut ? CHECKOUT_TIMEOUT_MESSAGE : CHECKOUT_ERROR_MESSAGE;
    return {
      cart: { ...beforeSync, status: 'error', globalError: message },
      result: { status: 'error', cart: beforeSync, message },
    };
  }
};
