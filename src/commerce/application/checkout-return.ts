export const CHECKOUT_RETURN_PARAM = 'kb_checkout';
export const CHECKOUT_RETURN_COMPLETED = 'completed';
export const CHECKOUT_RETURN_CANCELLED = 'cancelled';

const MAX_RETURN_VALUE_LENGTH = 32;
const RETURN_VALUE_PATTERN = /^[a-z]+$/;

export type CheckoutReturnKind =
  | typeof CHECKOUT_RETURN_COMPLETED
  | typeof CHECKOUT_RETURN_CANCELLED;

export const parseCheckoutReturn = (
  searchParams: URLSearchParams
): CheckoutReturnKind | null => {
  const value = searchParams.get(CHECKOUT_RETURN_PARAM)?.trim().toLowerCase();
  if (
    !value ||
    value.length > MAX_RETURN_VALUE_LENGTH ||
    !RETURN_VALUE_PATTERN.test(value)
  ) {
    return null;
  }
  if (value === CHECKOUT_RETURN_COMPLETED) return CHECKOUT_RETURN_COMPLETED;
  if (value === CHECKOUT_RETURN_CANCELLED) return CHECKOUT_RETURN_CANCELLED;
  return null;
};

export const getCheckoutReturnNotice = (kind: CheckoutReturnKind): string => {
  switch (kind) {
    case CHECKOUT_RETURN_COMPLETED:
      return 'Gracias por tu compra. Si necesitas ayuda con tu pedido, contáctanos.';
    case CHECKOUT_RETURN_CANCELLED:
      return 'Has vuelto del checkout. Tu carrito sigue disponible para revisarlo.';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
