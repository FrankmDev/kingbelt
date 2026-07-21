import { getLocalCatalogProduct, isKnownProductSelection } from './local-catalog';
import { getVariantAvailability } from './inventory';
import { multiplyMoney, sumMoney, zeroMoney } from './money';
import type { PersistedCartLine } from './local-cart-storage';
import type {
  AddToCartInput,
  Cart,
  CartLine,
  CartLineError,
  CartOperationResult,
  LocalCatalogProduct,
} from './types';

export const MAX_CART_QUANTITY = 99;

const createLineId = (productId: string, color: string, size: string) =>
  [productId, color, size].map((value) => encodeURIComponent(value)).join('::');

const buildLine = (
  entry: LocalCatalogProduct,
  color: string,
  size: string,
  quantity: number
): CartLine => {
  const availability = getVariantAvailability({
    productId: entry.product.id,
    color,
    size,
  });

  return {
    id: createLineId(entry.product.id, color, size),
    productId: entry.product.id,
    product: entry.product,
    color,
    size,
    quantity,
    availability,
    lineTotal: multiplyMoney(entry.product.unitPrice, quantity),
  };
};

const computeLineErrors = (lines: readonly CartLine[]): CartLineError[] => {
  const errors: CartLineError[] = [];

  lines.forEach((line) => {
    const { availability } = line;

    if (availability.status === 'out_of_stock') {
      errors.push({
        lineId: line.id,
        code: 'out_of_stock',
        message: availability.message ?? 'Producto agotado.',
      });
      return;
    }

    if (availability.status === 'unavailable') {
      errors.push({
        lineId: line.id,
        code: 'unavailable',
        message: availability.message ?? 'Producto no disponible.',
      });
      return;
    }

    if (line.quantity > availability.maxQuantity) {
      errors.push({
        lineId: line.id,
        code: 'insufficient_stock',
        message: `Solo quedan ${availability.maxQuantity} unidades.`,
      });
    }
  });

  return errors;
};

export const computeCart = (
  lines: readonly CartLine[],
  status: Cart['status'] = 'idle',
  extraErrors: readonly CartLineError[] = []
): Cart => {
  const refreshedLines = lines.map((line) => {
    const entry = getLocalCatalogProduct(line.productId);
    if (!entry) return line;

    return buildLine(entry, line.color, line.size, line.quantity);
  });

  const lineErrors = [...computeLineErrors(refreshedLines), ...extraErrors];
  const hasBlockingError = lineErrors.some((error) =>
    ['out_of_stock', 'insufficient_stock', 'unavailable'].includes(error.code)
  );

  return {
    lines: refreshedLines,
    itemCount: refreshedLines.reduce((total, line) => total + line.quantity, 0),
    subtotal: refreshedLines.length
      ? sumMoney(refreshedLines.map((line) => line.lineTotal))
      : zeroMoney(),
    lineErrors,
    status,
    canCheckout: refreshedLines.length > 0 && !hasBlockingError,
  };
};

export const emptyCart = (status: Cart['status'] = 'idle'): Cart =>
  computeCart([], status);

const validateInput = (
  input: AddToCartInput
): { entry: LocalCatalogProduct; color: string; size: string } | CartOperationResult => {
  const entry = getLocalCatalogProduct(input.productId);
  if (!entry) {
    return {
      success: false,
      cart: emptyCart(),
      error: { code: 'not_found', message: 'Producto no encontrado.' },
    };
  }

  const color = input.color.trim();
  const size = input.size.trim();

  if (!color) {
    return {
      success: false,
      cart: emptyCart(),
      error: { code: 'validation', message: 'Selecciona un color.', field: 'color' },
    };
  }

  if (!entry.colors.includes(color)) {
    return {
      success: false,
      cart: emptyCart(),
      error: { code: 'validation', message: 'El color seleccionado no es válido.', field: 'color' },
    };
  }

  if (!size) {
    return {
      success: false,
      cart: emptyCart(),
      error: { code: 'validation', message: 'Selecciona una talla.', field: 'size' },
    };
  }

  if (!entry.sizes.includes(size)) {
    return {
      success: false,
      cart: emptyCart(),
      error: { code: 'validation', message: 'La talla seleccionada no es válida.', field: 'size' },
    };
  }

  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_CART_QUANTITY
  ) {
    return {
      success: false,
      cart: emptyCart(),
      error: {
        code: 'validation',
        message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}.`,
        field: 'quantity',
      },
    };
  }

  return { entry, color, size };
};

export const addToCart = (cart: Cart, input: AddToCartInput): CartOperationResult => {
  const validated = validateInput(input);
  if ('success' in validated) return { ...validated, cart };

  const { entry, color, size } = validated;
  const availability = getVariantAvailability({
    productId: entry.product.id,
    color,
    size,
  });

  if (availability.status === 'out_of_stock') {
    return {
      success: false,
      cart,
      error: { code: 'out_of_stock', message: availability.message ?? 'Producto agotado.' },
    };
  }

  if (availability.status === 'unavailable') {
    return {
      success: false,
      cart,
      error: { code: 'unavailable', message: availability.message ?? 'Producto no disponible.' },
    };
  }

  const lineId = createLineId(entry.product.id, color, size);
  const existing = cart.lines.find((line) => line.id === lineId);
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;

  if (nextQuantity > availability.maxQuantity || nextQuantity > MAX_CART_QUANTITY) {
    const maxQuantity = Math.min(availability.maxQuantity, MAX_CART_QUANTITY);
    return {
      success: false,
      cart,
      error: {
        code: 'insufficient_stock',
        message: maxQuantity > 0 ? `Solo quedan ${maxQuantity} unidades.` : 'Sin stock disponible.',
        field: 'quantity',
      },
    };
  }

  const nextLines = existing
    ? cart.lines.map((line) =>
        line.id === lineId ? buildLine(entry, color, size, nextQuantity) : line
      )
    : [...cart.lines, buildLine(entry, color, size, input.quantity)];

  return { success: true, cart: computeCart(nextLines) };
};

export const updateLineQuantity = (
  cart: Cart,
  lineId: string,
  quantity: number
): CartOperationResult => {
  const line = cart.lines.find((item) => item.id === lineId);

  if (!line) {
    return {
      success: false,
      cart,
      error: { code: 'not_found', message: 'Línea no encontrada.' },
    };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
    return {
      success: false,
      cart,
      error: {
        code: 'validation',
        message: `La cantidad debe estar entre 1 y ${MAX_CART_QUANTITY}.`,
        field: 'quantity',
      },
    };
  }

  const entry = getLocalCatalogProduct(line.productId);
  if (!entry || !isKnownProductSelection(entry, line.color, line.size)) {
    return {
      success: false,
      cart,
      error: { code: 'not_found', message: 'El producto ya no está disponible.' },
    };
  }

  const availability = getVariantAvailability({
    productId: line.productId,
    color: line.color,
    size: line.size,
  });

  if (availability.status === 'out_of_stock' || availability.status === 'unavailable') {
    return {
      success: false,
      cart: computeCart(cart.lines),
      error: {
        code: availability.status,
        message: availability.message ?? 'Producto no disponible.',
      },
    };
  }

  if (quantity > availability.maxQuantity) {
    const adjustedQuantity = availability.maxQuantity;
    const adjustedLines = cart.lines.map((item) =>
      item.id === lineId
        ? buildLine(entry, item.color, item.size, adjustedQuantity)
        : item
    );

    return {
      success: true,
      cart: computeCart(adjustedLines),
      adjustedQuantity,
      notice: {
        code: 'quantity_adjusted',
        message: `Cantidad ajustada a ${adjustedQuantity} unidades.`,
      },
    };
  }

  const nextLines = cart.lines.map((item) =>
    item.id === lineId ? buildLine(entry, item.color, item.size, quantity) : item
  );

  return { success: true, cart: computeCart(nextLines) };
};

export const removeLine = (cart: Cart, lineId: string): CartOperationResult => {
  if (!cart.lines.some((line) => line.id === lineId)) {
    return {
      success: false,
      cart,
      error: { code: 'not_found', message: 'Línea no encontrada.' },
    };
  }

  return {
    success: true,
    cart: computeCart(cart.lines.filter((line) => line.id !== lineId)),
    notice: { code: 'product_removed', message: 'Producto eliminado del carrito.' },
  };
};

/** Reconstruye únicamente desde identidades previamente validadas. */
export const restoreCart = (persistedLines: readonly PersistedCartLine[]): Cart => {
  const restored = new Map<string, CartLine>();
  const recoveryErrors: CartLineError[] = [];
  let skippedProducts = 0;

  persistedLines.forEach((persisted) => {
    const entry = getLocalCatalogProduct(persisted.productId);
    if (!entry || !isKnownProductSelection(entry, persisted.color, persisted.size)) {
      skippedProducts += 1;
      return;
    }

    const lineId = createLineId(persisted.productId, persisted.color, persisted.size);
    const existingQuantity = restored.get(lineId)?.quantity ?? 0;
    const availability = getVariantAvailability({
      productId: persisted.productId,
      color: persisted.color,
      size: persisted.size,
    });
    const requestedQuantity = Math.min(
      existingQuantity + persisted.quantity,
      MAX_CART_QUANTITY
    );
    const quantity =
      availability.maxQuantity > 0
        ? Math.min(requestedQuantity, availability.maxQuantity)
        : requestedQuantity;

    restored.set(lineId, buildLine(entry, persisted.color, persisted.size, quantity));

    if (quantity < requestedQuantity) {
      recoveryErrors.push({
        lineId,
        code: 'quantity_adjusted',
        message: `Cantidad ajustada a ${quantity} unidades según el stock disponible.`,
        severity: 'notice',
      });
    }
  });

  const cart = computeCart([...restored.values()], 'idle', recoveryErrors);
  if (skippedProducts > 0) {
    cart.globalError =
      skippedProducts === 1
        ? 'Un producto guardado ya no está disponible y se ha retirado del carrito.'
        : `${skippedProducts} productos guardados ya no están disponibles y se han retirado del carrito.`;
  }

  return cart;
};
