import type { Cart } from '../domain/cart';
import { commerceRules } from '../domain/commerce-rules';

export type CheckoutStatus =
  | 'ready'
  | 'blocked'
  | 'unavailable'
  | 'expired'
  | 'error';

export interface CheckoutResult {
  status: CheckoutStatus;
  url?: string;
  /** Hosts exactos autorizados por el adaptador; la UI no acepta sufijos ni comodines. */
  allowedHosts?: readonly string[];
  message?: string;
  /** Carrito reconciliado por la fuente autoritativa tras la sincronización. */
  cart?: Cart;
  /** Indica que el precio visible cambió respecto al snapshot previo al checkout. */
  priceChanged?: boolean;
}

export interface CheckoutSyncDelta {
  priceChanged: boolean;
  quantitiesAdjusted: boolean;
  linesRemoved: boolean;
  messages: string[];
}

export const DEFAULT_CHECKOUT_TIMEOUT_MS = commerceRules.checkout.timeoutMs;

export class CheckoutTimeoutError extends Error {
  constructor(message = 'checkout_timeout') {
    super(message);
    this.name = 'CheckoutTimeoutError';
  }
}

export {
  buildShopifyCheckoutHosts,
  getSafeCheckoutUrl,
  MAX_CHECKOUT_URL_LENGTH,
  normalizeAllowedCheckoutHosts,
  normalizeCheckoutHost,
} from './checkout-redirect';

export {
  CHECKOUT_RETURN_CANCELLED,
  CHECKOUT_RETURN_COMPLETED,
  CHECKOUT_RETURN_PARAM,
  getCheckoutReturnNotice,
  parseCheckoutReturn,
  type CheckoutReturnKind,
} from './checkout-return';

const mergeNotices = (existing: string | undefined, addition: string): string =>
  existing?.includes(addition) ? existing : existing ? `${existing} ${addition}` : addition;

export const detectCheckoutSyncDelta = (before: Cart, after: Cart): CheckoutSyncDelta => {
  const messages: string[] = [];
  const beforeById = new Map(before.lines.map((line) => [line.id, line]));
  let priceChanged = false;
  let quantitiesAdjusted = false;
  let linesRemoved = false;

  after.lines.forEach((line) => {
    const previous = beforeById.get(line.id);
    if (!previous) return;
    if (previous.product.unitPrice.amountMinor !== line.product.unitPrice.amountMinor) {
      priceChanged = true;
    }
    if (previous.quantity !== line.quantity) {
      quantitiesAdjusted = true;
    }
  });

  if (after.lines.length < before.lines.length) {
    linesRemoved = true;
    messages.push('Algunos productos ya no están disponibles y se han retirado del carrito.');
  }

  if (quantitiesAdjusted && !after.lineErrors.some((error) => error.code === 'quantity_adjusted')) {
    messages.push('Las cantidades se han ajustado según la disponibilidad actual.');
  }

  if (priceChanged) {
    messages.push('Los precios se han actualizado según la tienda.');
  }

  return { priceChanged, quantitiesAdjusted, linesRemoved, messages };
};

export const applyCheckoutSyncNotice = (cart: Cart, delta: CheckoutSyncDelta): Cart => {
  if (!delta.messages.length) return cart;
  const notice = delta.messages.join(' ');
  return { ...cart, globalNotice: mergeNotices(cart.globalNotice, notice) };
};

export const buildCheckoutBlockedMessage = (cart: Cart): string => {
  if (!cart.lines.length) return 'El carrito está vacío.';
  const hasBlockingLineError = cart.lineErrors.some((error) => error.severity !== 'notice');
  if (hasBlockingLineError) {
    return 'Revisa los productos marcados antes de finalizar la compra.';
  }
  return 'No se puede continuar al checkout con el carrito actual.';
};

export const withCheckoutTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_CHECKOUT_TIMEOUT_MS
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new CheckoutTimeoutError()), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
};

/** Estado de demostración del proveedor local. No simula pedidos ni pagos. */
export const requestDemoCheckout = async (): Promise<CheckoutResult> => ({
  status: 'unavailable',
  message:
    'El checkout de demostración todavía no está conectado. Impuestos, envíos y descuentos se aplicarán en Shopify.',
});
