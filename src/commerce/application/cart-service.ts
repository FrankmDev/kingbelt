import { getQuantityLimitMessage, getVariantAvailability } from '../domain/inventory';
import type { LineAvailability } from '../domain/inventory';
import { multiplyMoney, sumMoney, zeroMoney } from '../domain/money';
import { MAX_CART_QUANTITY } from '../domain/variants';
import { getSelectedOptionLabels, toCartProduct } from '../domain/product-mappers';
import type {
  AddToCartInput,
  Cart,
  CartLine,
  CartLineError,
  CartOperationResult,
} from '../domain/cart';
import { MAX_CART_LINES } from '../domain/cart';
import type {
  Product,
  CollectionReference,
  ProductVariant,
} from '../domain/catalog';
import type { VariantId } from '../domain/identifiers';

export interface CartCatalogVariant {
  product: Product;
  variant: ProductVariant;
  primaryCollection: CollectionReference;
}

export interface CartCatalog {
  getVariant(variantId: string): CartCatalogVariant | undefined;
  resolveLegacyVariant(productId: string, color: string, size: string): ProductVariant | undefined;
}

export interface PersistedCartLine {
  variantId: VariantId;
  quantity: number;
}

export interface LegacyPersistedCartLine {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export type PersistedCartEntry = PersistedCartLine | LegacyPersistedCartLine;

const createLineId = (variantId: string): string => `variant:${encodeURIComponent(variantId)}`;

const buildLine = (record: CartCatalogVariant, quantity: number): CartLine => ({
  id: createLineId(record.variant.id),
  variantId: record.variant.id,
  product: toCartProduct(record.product, record.variant, record.primaryCollection),
  selectedOptions: getSelectedOptionLabels(record.product, record.variant),
  quantity,
  availability: getVariantAvailability(record.variant),
  lineTotal: multiplyMoney(record.variant.price, quantity),
});

const getLimitErrorCode = (
  availability: LineAvailability
): 'insufficient_stock' | 'quantity_limit' =>
  availability.limitReason === 'inventory' ? 'insufficient_stock' : 'quantity_limit';

const computeLineErrors = (lines: readonly CartLine[]): CartLineError[] => {
  const errors: CartLineError[] = [];
  lines.forEach((line) => {
    if (line.availability.status === 'out_of_stock') {
      errors.push({ lineId: line.id, code: 'out_of_stock', message: line.availability.message, severity: 'error' });
    } else if (line.availability.status === 'unavailable') {
      errors.push({ lineId: line.id, code: 'unavailable', message: line.availability.message, severity: 'error' });
    } else if (line.quantity > line.availability.maxQuantity) {
      errors.push({
        lineId: line.id,
        code: getLimitErrorCode(line.availability),
        message: getQuantityLimitMessage(line.availability),
        severity: 'error',
      });
    }
  });
  return errors;
};

const computeCart = (
  catalog: CartCatalog,
  lines: readonly CartLine[],
  status: Cart['status'] = 'idle',
  extraErrors: readonly CartLineError[] = []
): Cart => {
  const refreshedLines = lines.flatMap((line) => {
    const record = catalog.getVariant(line.variantId);
    return record ? [buildLine(record, line.quantity)] : [];
  });
  const lineErrors = [...computeLineErrors(refreshedLines), ...extraErrors];
  const hasBlockingError = lineErrors.some((error) => error.severity !== 'notice');
  return {
    lines: refreshedLines,
    itemCount: refreshedLines.reduce((total, line) => total + line.quantity, 0),
    subtotal: refreshedLines.length ? sumMoney(refreshedLines.map((line) => line.lineTotal)) : zeroMoney(),
    lineErrors,
    status,
    canCheckout: refreshedLines.length > 0 && !hasBlockingError,
  };
};

export const emptyCart = (status: Cart['status'] = 'idle'): Cart => ({
  lines: [],
  itemCount: 0,
  subtotal: zeroMoney(),
  lineErrors: [],
  status,
  canCheckout: false,
});

const validateInput = (
  catalog: CartCatalog,
  cart: Cart,
  input: AddToCartInput
): { record: CartCatalogVariant; quantity: number } | CartOperationResult => {
  const variantId = input.variantId?.trim();
  if (!variantId || variantId.length > 256) {
    return { success: false, cart, error: { code: 'validation', message: 'Selecciona una variante válida.', field: 'variant' } };
  }
  const record = catalog.getVariant(variantId);
  if (!record) {
    return { success: false, cart, error: { code: 'not_found', message: 'La variante seleccionada no existe.', field: 'variant' } };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_CART_QUANTITY) {
    return {
      success: false,
      cart,
      error: {
        code: 'validation',
        message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}; este es un límite técnico del carrito.`,
        field: 'quantity',
      },
    };
  }
  return { record, quantity: input.quantity };
};

const addToCart = (catalog: CartCatalog, cart: Cart, input: AddToCartInput): CartOperationResult => {
  const validated = validateInput(catalog, cart, input);
  if ('success' in validated) return validated;
  const { record, quantity } = validated;
  const availability = getVariantAvailability(record.variant);
  if (availability.status === 'out_of_stock' || availability.status === 'unavailable') {
    return { success: false, cart, error: { code: availability.status, message: availability.message, field: 'variant' } };
  }

  const lineId = createLineId(record.variant.id);
  const existing = cart.lines.find((line) => line.id === lineId);
  if (!existing && cart.lines.length >= MAX_CART_LINES) {
    return {
      success: false,
      cart,
      error: {
        code: 'validation',
        message: `El carrito admite un máximo de ${MAX_CART_LINES} productos distintos.`,
        field: 'variant',
      },
    };
  }
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > availability.maxQuantity) {
    return {
      success: false,
      cart,
      error: {
        code: getLimitErrorCode(availability),
        message: getQuantityLimitMessage(availability),
        field: 'quantity',
      },
    };
  }

  const nextLines = existing
    ? cart.lines.map((line) => line.id === lineId ? buildLine(record, nextQuantity) : line)
    : [...cart.lines, buildLine(record, quantity)];
  return { success: true, cart: computeCart(catalog, nextLines) };
};

const updateLineQuantity = (
  catalog: CartCatalog,
  cart: Cart,
  lineId: string,
  quantity: number
): CartOperationResult => {
  const line = cart.lines.find((item) => item.id === lineId);
  if (!line) return { success: false, cart, error: { code: 'not_found', message: 'Línea no encontrada.' } };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
    return {
      success: false,
      cart,
      error: {
        code: 'validation',
        message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}; este es un límite técnico del carrito.`,
        field: 'quantity',
      },
    };
  }
  const record = catalog.getVariant(line.variantId);
  if (!record) return { success: false, cart, error: { code: 'not_found', message: 'La variante ya no está disponible.' } };
  const availability = getVariantAvailability(record.variant);
  if (availability.status === 'out_of_stock' || availability.status === 'unavailable') {
    return { success: false, cart: computeCart(catalog, cart.lines), error: { code: availability.status, message: availability.message } };
  }
  if (quantity > availability.maxQuantity) {
    const adjustedQuantity = availability.maxQuantity;
    const adjustedLines = cart.lines.map((item) => item.id === lineId ? buildLine(record, adjustedQuantity) : item);
    return {
      success: true,
      cart: computeCart(catalog, adjustedLines),
      adjustedQuantity,
      notice: { code: 'quantity_adjusted', message: getQuantityLimitMessage(availability, 'adjusted') },
    };
  }
  return {
    success: true,
    cart: computeCart(catalog, cart.lines.map((item) => item.id === lineId ? buildLine(record, quantity) : item)),
  };
};

const removeLine = (catalog: CartCatalog, cart: Cart, lineId: string): CartOperationResult => {
  if (!cart.lines.some((line) => line.id === lineId)) {
    return { success: false, cart, error: { code: 'not_found', message: 'Línea no encontrada.' } };
  }
  return {
    success: true,
    cart: computeCart(catalog, cart.lines.filter((line) => line.id !== lineId)),
    notice: { code: 'product_removed', message: 'Producto eliminado del carrito.' },
  };
};

const isLegacyEntry = (entry: PersistedCartEntry): entry is Extract<PersistedCartEntry, { productId: string }> =>
  'productId' in entry;

const restoreCart = (
  catalog: CartCatalog,
  persistedLines: readonly PersistedCartEntry[],
  previouslyDiscarded = 0
): Cart => {
  const restored = new Map<string, CartLine>();
  const recoveryErrors: CartLineError[] = [];
  let discarded = previouslyDiscarded + Math.max(0, persistedLines.length - MAX_CART_LINES);

  persistedLines.slice(0, MAX_CART_LINES).forEach((persisted) => {
    const variant = isLegacyEntry(persisted)
      ? catalog.resolveLegacyVariant(persisted.productId, persisted.color, persisted.size)
      : catalog.getVariant(persisted.variantId)?.variant;
    const record = variant ? catalog.getVariant(variant.id) : undefined;
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
      recoveryErrors.push({
        lineId,
        code: 'quantity_adjusted',
        message: getQuantityLimitMessage(availability, 'adjusted'),
        severity: 'notice',
      });
    }
  });

  const cart = computeCart(catalog, [...restored.values()], 'idle', recoveryErrors);
  if (discarded > 0) {
    cart.globalNotice = discarded === 1
      ? 'Una variante guardada ya no existe o no era válida; se ha retirado del carrito.'
      : `${discarded} variantes guardadas ya no existen o no eran válidas; se han retirado del carrito.`;
  }
  return cart;
};

export const createCartService = (catalog: CartCatalog) => ({
  addToCart: (cart: Cart, input: AddToCartInput) => addToCart(catalog, cart, input),
  updateLineQuantity: (cart: Cart, lineId: string, quantity: number) =>
    updateLineQuantity(catalog, cart, lineId, quantity),
  removeLine: (cart: Cart, lineId: string) => removeLine(catalog, cart, lineId),
  restoreCart: (persistedLines: readonly PersistedCartEntry[], previouslyDiscarded = 0) =>
    restoreCart(catalog, persistedLines, previouslyDiscarded),
  refreshCart: (cart: Cart) => restoreCart(
    catalog,
    cart.lines.map(({ variantId, quantity }) => ({ variantId, quantity }))
  ),
});
