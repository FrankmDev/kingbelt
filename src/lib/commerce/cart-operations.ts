import { getVariantAvailability } from './inventory';
import { getLocalVariant, resolveLegacyVariant, type LocalVariantRecord } from './local-catalog';
import { multiplyMoney, sumMoney, zeroMoney } from './money';
import { MAX_CART_QUANTITY } from './product-variants';
import { toCartProduct } from './product-mapper';
import type { PersistedCartEntry } from './local-cart-storage';
import type {
  AddToCartInput,
  Cart,
  CartLine,
  CartLineError,
  CartOperationResult,
} from './types';

const createLineId = (variantId: string): string => `variant:${encodeURIComponent(variantId)}`;

const buildLine = (record: LocalVariantRecord, quantity: number): CartLine => ({
  id: createLineId(record.variant.id),
  variantId: record.variant.id,
  product: toCartProduct(record.product, record.variant),
  selectedOptions: record.variant.selectedOptions,
  quantity,
  availability: getVariantAvailability(record.variant),
  lineTotal: multiplyMoney(record.variant.price, quantity),
});

const computeLineErrors = (lines: readonly CartLine[]): CartLineError[] => {
  const errors: CartLineError[] = [];
  lines.forEach((line) => {
    if (line.availability.status === 'out_of_stock') {
      errors.push({ lineId: line.id, code: 'out_of_stock', message: line.availability.message ?? 'Producto agotado.' });
    } else if (line.availability.status === 'unavailable') {
      errors.push({ lineId: line.id, code: 'unavailable', message: line.availability.message ?? 'Producto no disponible.' });
    } else if (line.quantity > line.availability.maxQuantity) {
      errors.push({ lineId: line.id, code: 'insufficient_stock', message: `Solo quedan ${line.availability.maxQuantity} unidades.` });
    }
  });
  return errors;
};

export const computeCart = (
  lines: readonly CartLine[],
  status: Cart['status'] = 'idle',
  extraErrors: readonly CartLineError[] = []
): Cart => {
  const refreshedLines = lines.flatMap((line) => {
    const record = getLocalVariant(line.variantId);
    return record ? [buildLine(record, line.quantity)] : [];
  });
  const lineErrors = [...computeLineErrors(refreshedLines), ...extraErrors];
  const hasBlockingError = lineErrors.some((error) =>
    ['out_of_stock', 'insufficient_stock', 'unavailable'].includes(error.code)
  );
  return {
    lines: refreshedLines,
    itemCount: refreshedLines.reduce((total, line) => total + line.quantity, 0),
    subtotal: refreshedLines.length ? sumMoney(refreshedLines.map((line) => line.lineTotal)) : zeroMoney(),
    lineErrors,
    status,
    canCheckout: refreshedLines.length > 0 && !hasBlockingError,
  };
};

export const emptyCart = (status: Cart['status'] = 'idle'): Cart => computeCart([], status);

const validateInput = (
  cart: Cart,
  input: AddToCartInput
): { record: LocalVariantRecord; quantity: number } | CartOperationResult => {
  const variantId = input.variantId?.trim();
  if (!variantId || variantId.length > 256) {
    return { success: false, cart, error: { code: 'validation', message: 'Selecciona una variante válida.', field: 'variant' } };
  }
  const record = getLocalVariant(variantId);
  if (!record) {
    return { success: false, cart, error: { code: 'not_found', message: 'La variante seleccionada no existe.', field: 'variant' } };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_CART_QUANTITY) {
    return { success: false, cart, error: { code: 'validation', message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}.`, field: 'quantity' } };
  }
  return { record, quantity: input.quantity };
};

export const addToCart = (cart: Cart, input: AddToCartInput): CartOperationResult => {
  const validated = validateInput(cart, input);
  if ('success' in validated) return validated;
  const { record, quantity } = validated;
  const availability = getVariantAvailability(record.variant);
  if (availability.status === 'out_of_stock' || availability.status === 'unavailable') {
    return { success: false, cart, error: { code: availability.status, message: availability.message ?? 'Producto no disponible.', field: 'variant' } };
  }

  const lineId = createLineId(record.variant.id);
  const existing = cart.lines.find((line) => line.id === lineId);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > availability.maxQuantity || nextQuantity > MAX_CART_QUANTITY) {
    const max = Math.min(availability.maxQuantity, MAX_CART_QUANTITY);
    return { success: false, cart, error: { code: 'insufficient_stock', message: max > 0 ? `Solo quedan ${max} unidades.` : 'Sin stock disponible.', field: 'quantity' } };
  }

  const nextLines = existing
    ? cart.lines.map((line) => line.id === lineId ? buildLine(record, nextQuantity) : line)
    : [...cart.lines, buildLine(record, quantity)];
  return { success: true, cart: computeCart(nextLines) };
};

export const updateLineQuantity = (
  cart: Cart,
  lineId: string,
  quantity: number
): CartOperationResult => {
  const line = cart.lines.find((item) => item.id === lineId);
  if (!line) return { success: false, cart, error: { code: 'not_found', message: 'Línea no encontrada.' } };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
    return { success: false, cart, error: { code: 'validation', message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}.`, field: 'quantity' } };
  }
  const record = getLocalVariant(line.variantId);
  if (!record) return { success: false, cart, error: { code: 'not_found', message: 'La variante ya no está disponible.' } };
  const availability = getVariantAvailability(record.variant);
  if (availability.status === 'out_of_stock' || availability.status === 'unavailable') {
    return { success: false, cart: computeCart(cart.lines), error: { code: availability.status, message: availability.message ?? 'Producto no disponible.' } };
  }
  if (quantity > availability.maxQuantity) {
    const adjustedQuantity = availability.maxQuantity;
    const adjustedLines = cart.lines.map((item) => item.id === lineId ? buildLine(record, adjustedQuantity) : item);
    return {
      success: true,
      cart: computeCart(adjustedLines),
      adjustedQuantity,
      notice: { code: 'quantity_adjusted', message: `Cantidad ajustada a ${adjustedQuantity} unidades.` },
    };
  }
  return {
    success: true,
    cart: computeCart(cart.lines.map((item) => item.id === lineId ? buildLine(record, quantity) : item)),
  };
};

export const removeLine = (cart: Cart, lineId: string): CartOperationResult => {
  if (!cart.lines.some((line) => line.id === lineId)) {
    return { success: false, cart, error: { code: 'not_found', message: 'Línea no encontrada.' } };
  }
  return {
    success: true,
    cart: computeCart(cart.lines.filter((line) => line.id !== lineId)),
    notice: { code: 'product_removed', message: 'Producto eliminado del carrito.' },
  };
};

const isLegacyEntry = (entry: PersistedCartEntry): entry is Extract<PersistedCartEntry, { productId: string }> =>
  'productId' in entry;

export const restoreCart = (
  persistedLines: readonly PersistedCartEntry[],
  previouslyDiscarded = 0
): Cart => {
  const restored = new Map<string, CartLine>();
  const recoveryErrors: CartLineError[] = [];
  let discarded = previouslyDiscarded;

  persistedLines.forEach((persisted) => {
    const variant = isLegacyEntry(persisted)
      ? resolveLegacyVariant(persisted.productId, persisted.color, persisted.size)
      : getLocalVariant(persisted.variantId)?.variant;
    const record = variant ? getLocalVariant(variant.id) : undefined;
    if (!record) {
      discarded += 1;
      return;
    }
    const lineId = createLineId(record.variant.id);
    const existingQuantity = restored.get(lineId)?.quantity ?? 0;
    const availability = getVariantAvailability(record.variant);
    const requestedQuantity = Math.min(existingQuantity + persisted.quantity, MAX_CART_QUANTITY);
    const quantity = availability.maxQuantity > 0
      ? Math.min(requestedQuantity, availability.maxQuantity)
      : requestedQuantity;
    restored.set(lineId, buildLine(record, quantity));
    if (quantity < requestedQuantity) {
      recoveryErrors.push({ lineId, code: 'quantity_adjusted', message: `Cantidad ajustada a ${quantity} unidades según el stock disponible.`, severity: 'notice' });
    }
  });

  const cart = computeCart([...restored.values()], 'idle', recoveryErrors);
  if (discarded > 0) {
    cart.globalNotice = discarded === 1
      ? 'Una línea guardada no pudo migrarse y se ha retirado del carrito.'
      : `${discarded} líneas guardadas no pudieron migrarse y se han retirado del carrito.`;
  }
  return cart;
};
