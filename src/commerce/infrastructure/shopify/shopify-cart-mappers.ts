import { emptyCart } from '../../application/cart-service';
import type {
  Cart,
  CartLine,
  CartLineError,
  CartLineErrorCode,
  CartOperationErrorCode,
  CartOperationMessage,
  CartOperationResult,
} from '../../domain/cart';
import { MAX_CART_LINES, MAX_CART_LINES_MESSAGE } from '../../domain/cart';
import { productId, variantId } from '../../domain/identifiers';
import {
  getQuantityLimitMessage,
  isQuantityAllowed,
  TECHNICAL_LINE_QUANTITY_LIMIT,
  type LineAvailability,
} from '../../domain/inventory';
import { moneyFromDecimal } from '../../domain/money';
import { isAllowedImageUrl } from '../../domain/url-policy';
import { publicSecurityConfig } from '../../../config/security';
import { SHOPIFY_MARKET_CONTEXT, SHOPIFY_PRIMARY_COLLECTION_METAFIELD } from './config';
import { isShopifyImageIdentifier } from './shopify-image-identifier';

export interface ShopifyCartMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyCartImage {
  id: string;
  url: string;
  width: number;
  height: number;
  altText?: string | null;
}

export interface ShopifyCartQuantityRule {
  minimum: number;
  increment: number;
  maximum?: number | null;
}

export interface ShopifyCartMerchandise {
  id: string;
  availableForSale: boolean;
  currentlyNotInStock: boolean;
  quantityRule: ShopifyCartQuantityRule;
  selectedOptions: Array<{ name: string; value: string }>;
  image?: ShopifyCartImage | null;
  product: {
    id: string;
    handle: string;
    title: string;
    modelReference?: { value?: string | null } | null;
    primaryCollection?: {
      type?: string | null;
      value?: string | null;
      reference?: {
        __typename?: string;
        id?: string;
        handle?: string;
        title?: string;
      } | null;
    } | null;
    featuredImage?: ShopifyCartImage | null;
  };
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  cost: { amountPerQuantity: ShopifyCartMoney; totalAmount: ShopifyCartMoney };
  merchandise: ShopifyCartMerchandise | null;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl?: string | null;
  buyerIdentity?: { countryCode?: string | null } | null;
  cost: { subtotalAmount: ShopifyCartMoney };
  lines: { nodes: ShopifyCartLine[]; pageInfo?: { hasNextPage: boolean } };
}

export interface ShopifyCartQuantitySnapshot {
  lines: {
    nodes: Array<{ id: string; quantity: number; merchandise: { id: string } | null }>;
    pageInfo?: { hasNextPage: boolean };
  };
}

export interface ShopifyCartUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

export interface ShopifyCartWarning {
  code: string;
  message: string;
  target: string;
}

export interface ShopifyCartPayload {
  cart: ShopifyCart | null;
  userErrors: ShopifyCartUserError[];
  warnings: ShopifyCartWarning[];
}

export interface ShopifyCartAvailabilityInput {
  availableForSale: boolean;
  currentlyNotInStock: boolean;
  quantityRule: ShopifyCartQuantityRule;
}

export interface ShopifyCartMutationIntent {
  kind: 'create' | 'add' | 'update' | 'remove';
  merchandiseId?: string;
  lineId?: string;
  requestedQuantity?: number;
  previousLines?: ReadonlyArray<Pick<CartLine, 'id' | 'variantId' | 'quantity'>>;
}

export const SHOPIFY_CART_PROVIDER_ERROR_MESSAGE =
  'No se ha podido actualizar el carrito. Inténtalo de nuevo.';
export const SHOPIFY_CART_UPDATED_NOTICE =
  'Shopify ha actualizado el carrito. Revisa los productos antes de continuar.';
export const SHOPIFY_NOT_ENOUGH_STOCK_NOTICE =
  'Hemos ajustado la cantidad al stock disponible.';
export const SHOPIFY_OUT_OF_STOCK_NOTICE =
  'Un producto se ha agotado y el carrito se ha actualizado.';
export const SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE =
  'Este producto no está disponible para tu ubicación.';
export const SHOPIFY_CART_OVERFLOW_MESSAGE =
  'El carrito tiene más productos de los que podemos mostrar. Elimina algún artículo para continuar.';

const SHOPIFY_CART_LINE_ID_PATTERN =
  /^gid:\/\/shopify\/CartLine\/[^/?#\s]+(?:\?cart=[A-Za-z0-9_-]{1,128})?$/;

const OPERATION_ERROR_MESSAGES: Record<CartOperationErrorCode, string> = {
  validation: 'Los datos enviados no son válidos.',
  out_of_stock: 'El producto está agotado.',
  insufficient_stock: 'La cantidad supera el stock disponible.',
  quantity_limit: 'La cantidad no cumple las reglas de esta variante.',
  unavailable: 'Este producto no está disponible.',
  not_found: 'La línea o variante ya no está en el carrito.',
  provider_error: SHOPIFY_CART_PROVIDER_ERROR_MESSAGE,
};

const fieldIncludes = (field: readonly string[] | null | undefined, name: string): boolean =>
  (field ?? []).some((part) => part === name);

const requiredText = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Shopify cart field is invalid at ${path}.`);
  }
  return value;
};

const requiredShopifyGid = (
  value: unknown,
  resource: 'CartLine' | 'ProductVariant' | 'Product' | 'Collection',
  path: string
): string => {
  const id = requiredText(value, path);
  const valid = resource === 'CartLine'
    ? SHOPIFY_CART_LINE_ID_PATTERN.test(id)
    : new RegExp(`^gid://shopify/${resource}/[^/?#\\s]+$`).test(id);
  if (!valid) {
    throw new Error(`Shopify cart field is invalid at ${path}.`);
  }
  return id;
};

const requiredShopifyImageGid = (value: unknown, path: string): string => {
  if (!isShopifyImageIdentifier(value)) {
    throw new Error(`Shopify cart field is invalid at ${path}.`);
  }
  return value;
};

const requiredHandle = (value: unknown, path: string): string => {
  const handle = requiredText(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    throw new Error(`Shopify cart field is invalid at ${path}.`);
  }
  return handle;
};

const quantityRuleParts = (
  rule: ShopifyCartQuantityRule
): { minimum: number; increment: number; maximum?: number } => {
  if (rule.minimum !== 1 || rule.increment !== 1) {
    throw new Error('Shopify cart quantityRule only supports minimum=1 and increment=1.');
  }
  const maximum = rule.maximum == null
    ? undefined
    : Number.isSafeInteger(rule.maximum) && rule.maximum >= 1
      ? rule.maximum
      : (() => { throw new Error('Shopify cart quantityRule maximum is invalid.'); })();
  return {
    minimum: rule.minimum,
    increment: rule.increment,
    ...(maximum === undefined ? {} : { maximum }),
  };
};

const quantityLimit = (
  maximum: number | undefined,
  technicalLimit: number
): Pick<LineAvailability, 'maxQuantity' | 'limitReason'> => {
  const candidates: Array<{ value: number; reason: LineAvailability['limitReason']; priority: number }> = [
    { value: technicalLimit, reason: 'technical', priority: 3 },
  ];
  if (maximum !== undefined) {
    candidates.push({ value: maximum, reason: 'quantity_rule', priority: 1 });
  }
  candidates.sort((left, right) => left.value - right.value || left.priority - right.priority);
  return { maxQuantity: candidates[0].value, limitReason: candidates[0].reason };
};

export const mapShopifyCartAvailability = (
  input: ShopifyCartAvailabilityInput,
  technicalLimit = TECHNICAL_LINE_QUANTITY_LIMIT
): LineAvailability => {
  const validTechnicalLimit = Number.isSafeInteger(technicalLimit) && technicalLimit > 0
    ? technicalLimit
    : TECHNICAL_LINE_QUANTITY_LIMIT;
  const rule = quantityRuleParts(input.quantityRule);
  const limit = quantityLimit(rule.maximum, validTechnicalLimit);

  if (input.availableForSale !== true) {
    return {
      status: 'unavailable',
      purchasable: false,
      maxQuantity: 0,
      minimum: rule.minimum,
      increment: rule.increment,
      limitReason: 'unavailable',
      quantityKnown: false,
      backorder: false,
      message: 'Esta variante no está disponible.',
    };
  }

  if (input.currentlyNotInStock === true) {
    return {
      status: 'available',
      purchasable: true,
      ...limit,
      minimum: rule.minimum,
      increment: rule.increment,
      quantityKnown: false,
      backorder: true,
      message: 'Disponible para pedir.',
    };
  }

  return {
    status: 'available',
    purchasable: true,
    ...limit,
    minimum: rule.minimum,
    increment: rule.increment,
    quantityKnown: false,
    backorder: false,
    message: 'Disponible.',
  };
};

export const mapShopifyCartErrorCode = (
  code: string | null | undefined,
  field?: readonly string[] | null
): CartOperationErrorCode => {
  switch (code) {
    case 'INVALID_INCREMENT':
    case 'MAXIMUM_EXCEEDED':
    case 'MINIMUM_NOT_MET':
      return 'quantity_limit';
    case 'LESS_THAN':
      return fieldIncludes(field, 'quantity') ? 'quantity_limit' : 'validation';
    case 'INVALID_MERCHANDISE_LINE':
      return 'not_found';
    case 'MERCHANDISE_NOT_APPLICABLE':
      return 'unavailable';
    case 'SERVICE_UNAVAILABLE':
      return 'provider_error';
    case 'CART_TOO_LARGE':
      return 'validation';
    case 'INVALID':
      return fieldIncludes(field, 'cartId') ? 'not_found' : 'validation';
    default:
      return 'provider_error';
  }
};

export const publicCartOperationError = (
  code: CartOperationErrorCode,
  field?: CartOperationMessage['field']
): CartOperationMessage => ({
  code,
  message: OPERATION_ERROR_MESSAGES[code],
  ...(field ? { field } : {}),
});

const errorFieldFromUserError = (
  code: CartOperationErrorCode,
  field?: readonly string[] | null
): CartOperationMessage['field'] => {
  if (code === 'quantity_limit' || fieldIncludes(field, 'quantity')) return 'quantity';
  if (
    code === 'not_found' ||
    code === 'unavailable' ||
    code === 'out_of_stock' ||
    fieldIncludes(field, 'merchandiseId')
  ) {
    return 'variant';
  }
  return undefined;
};

const mapUserErrors = (errors: readonly ShopifyCartUserError[]): CartOperationMessage => {
  const primary = errors[0];
  const code = mapShopifyCartErrorCode(primary?.code, primary?.field);
  return publicCartOperationError(code, errorFieldFromUserError(code, primary?.field));
};

const shopifyImageAlt = (image: ShopifyCartImage): string =>
  image.altText?.trim() || 'Producto KingBelt';

const toCartImage = (image: ShopifyCartImage | null | undefined) => {
  if (!image) return undefined;
  const id = requiredShopifyImageGid(image.id, 'line.merchandise.image.id');
  const url = requiredText(image.url, 'line.merchandise.image.url');
  if (!isAllowedImageUrl(url, publicSecurityConfig.remoteImageHosts)) {
    throw new Error('Shopify cart image URL is not allowed.');
  }
  if (!Number.isSafeInteger(image.width) || image.width <= 0) {
    throw new Error('Shopify cart image width is invalid.');
  }
  if (!Number.isSafeInteger(image.height) || image.height <= 0) {
    throw new Error('Shopify cart image height is invalid.');
  }
  return {
    id,
    url,
    width: image.width,
    height: image.height,
    altText: shopifyImageAlt(image),
  };
};

const primaryCollectionTitle = (
  metafield: ShopifyCartMerchandise['product']['primaryCollection']
): string => {
  const reference = metafield?.type === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.type
    ? metafield.reference
    : undefined;
  if (reference?.__typename !== 'Collection') {
    throw new Error('invalid primary collection');
  }
  requiredShopifyGid(reference.id, 'Collection', 'line.merchandise.product.primaryCollection.reference.id');
  requiredHandle(reference.handle, 'line.merchandise.product.primaryCollection.reference.handle');
  const title = requiredText(reference.title, 'line.merchandise.product.primaryCollection.reference.title');
  return title;
};

const mapShopifyCartLine = (line: ShopifyCartLine): CartLine => {
  const lineId = requiredShopifyGid(line.id, 'CartLine', 'line.id');
  const merchandise = line.merchandise;
  if (!merchandise) {
    throw new Error('Shopify cart line merchandise is missing.');
  }
  const merchandiseId = requiredShopifyGid(merchandise.id, 'ProductVariant', 'line.merchandise.id');
  const remoteProductId = requiredShopifyGid(merchandise.product?.id, 'Product', 'line.merchandise.product.id');
  const handle = requiredHandle(merchandise.product.handle, 'line.merchandise.product.handle');
  const title = requiredText(merchandise.product.title, 'line.merchandise.product.title');
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
    throw new Error('Shopify cart line quantity is invalid.');
  }
  const selectedOptions = merchandise.selectedOptions.map((selection, index) => ({
    name: requiredText(selection.name, `line.merchandise.selectedOptions[${index}].name`),
    value: requiredText(selection.value, `line.merchandise.selectedOptions[${index}].value`),
  }));
  if (new Set(selectedOptions.map((selection) => selection.name.toLocaleLowerCase('es'))).size !== selectedOptions.length) {
    throw new Error('Shopify cart selectedOptions contains duplicate options.');
  }
  const image = toCartImage(merchandise.image ?? merchandise.product.featuredImage);
  const reference = merchandise.product.modelReference?.value == null
    ? handle
    : requiredText(merchandise.product.modelReference.value, 'line.merchandise.product.modelReference.value');
  const collection = primaryCollectionTitle(merchandise.product.primaryCollection);
  return {
    id: lineId,
    variantId: variantId(merchandiseId),
    product: {
      id: productId(remoteProductId),
      handle,
      title,
      collection,
      reference,
      unitPrice: moneyFromDecimal(
        line.cost.amountPerQuantity.amount,
        line.cost.amountPerQuantity.currencyCode
      ),
      ...(image ? { image } : {}),
      href: `/productos/${handle}`,
    },
    selectedOptions,
    quantity: line.quantity,
    availability: mapShopifyCartAvailability({
      availableForSale: merchandise.availableForSale,
      currentlyNotInStock: merchandise.currentlyNotInStock,
      quantityRule: merchandise.quantityRule,
    }),
    lineTotal: moneyFromDecimal(line.cost.totalAmount.amount, line.cost.totalAmount.currencyCode),
  };
};

const limitErrorCode = (
  availability: LineAvailability
): Extract<CartLineErrorCode, 'insufficient_stock' | 'quantity_limit'> =>
  availability.limitReason === 'inventory' ? 'insufficient_stock' : 'quantity_limit';

const availabilityLineErrors = (lines: readonly CartLine[]): CartLineError[] => {
  const errors: CartLineError[] = [];
  lines.forEach((line) => {
    if (line.availability.status === 'out_of_stock') {
      errors.push({
        lineId: line.id,
        code: 'out_of_stock',
        message: line.availability.message,
        severity: 'error',
      });
    } else if (line.availability.status === 'unavailable' || !line.availability.purchasable) {
      errors.push({
        lineId: line.id,
        code: 'unavailable',
        message: line.availability.message,
        severity: 'error',
      });
    } else if (!isQuantityAllowed(line.quantity, line.availability)) {
      errors.push({
        lineId: line.id,
        code: limitErrorCode(line.availability),
        message: getQuantityLimitMessage(line.availability),
        severity: 'error',
      });
    }
  });
  return errors;
};

const warningNotice = (
  code: string
): { lineCode: CartLineErrorCode; message: string } | undefined => {
  if (code === 'MERCHANDISE_NOT_ENOUGH_STOCK') {
    return { lineCode: 'quantity_adjusted', message: SHOPIFY_NOT_ENOUGH_STOCK_NOTICE };
  }
  if (code === 'MERCHANDISE_OUT_OF_STOCK') {
    return { lineCode: 'out_of_stock', message: SHOPIFY_OUT_OF_STOCK_NOTICE };
  }
  if (code === 'PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION') {
    return { lineCode: 'unavailable', message: SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE };
  }
  return undefined;
};

const resolveWarningLineId = (target: string, lines: readonly CartLine[]): string | undefined => {
  if (lines.some((line) => line.id === target)) return target;
  const byVariant = lines.filter((line) => line.variantId === target);
  return byVariant.length === 1 ? byVariant[0].id : undefined;
};

const uniqueMessages = (messages: readonly string[]): string[] =>
  [...new Set(messages.filter((message) => message.length > 0))];

const mergeNotice = (existing: string | undefined, addition: string): string =>
  existing?.includes(addition) ? existing : existing ? `${existing} ${addition}` : addition;

const applyWarnings = (
  lines: readonly CartLine[],
  warnings: readonly ShopifyCartWarning[]
): { lineErrors: CartLineError[]; globalMessages: string[] } => {
  const lineErrors: CartLineError[] = [];
  const globalMessages: string[] = [];
  const seen = new Set<string>();

  warnings.forEach((warning) => {
    const key = `${warning.target}\0${warning.code}`;
    if (seen.has(key)) return;
    seen.add(key);

    const mapped = warningNotice(warning.code);
    const message = mapped?.message ?? SHOPIFY_CART_UPDATED_NOTICE;
    const lineId = resolveWarningLineId(warning.target, lines);
    if (lineId && mapped) {
      lineErrors.push({
        lineId,
        code: mapped.lineCode,
        message,
        severity: 'notice',
      });
      return;
    }
    globalMessages.push(message);
  });

  return { lineErrors, globalMessages: uniqueMessages(globalMessages) };
};

const canCheckoutFrom = (lines: readonly CartLine[], lineErrors: readonly CartLineError[]): boolean =>
  lines.length > 0 && !lineErrors.some((error) => error.severity !== 'notice');

const assertCartCurrencyCode = (currencyCode: string | undefined, path: string): void => {
  if (currencyCode !== SHOPIFY_MARKET_CONTEXT.currency) {
    throw new Error(`Shopify cart currency does not match ${SHOPIFY_MARKET_CONTEXT.currency} at ${path}.`);
  }
};

const assertShopifyCartMarket = (remote: ShopifyCart): void => {
  if (remote.buyerIdentity?.countryCode !== SHOPIFY_MARKET_CONTEXT.country) {
    throw new Error(`Shopify cart country does not match ${SHOPIFY_MARKET_CONTEXT.country}.`);
  }
  assertCartCurrencyCode(remote.cost?.subtotalAmount?.currencyCode, 'cost.subtotalAmount');
  for (const [index, line] of remote.lines.nodes.entries()) {
    assertCartCurrencyCode(line.cost?.amountPerQuantity?.currencyCode, `lines[${index}].cost.amountPerQuantity`);
    assertCartCurrencyCode(line.cost?.totalAmount?.currencyCode, `lines[${index}].cost.totalAmount`);
  }
};

export const mapShopifyCart = (
  remote: ShopifyCart,
  warnings: readonly ShopifyCartWarning[] = []
): Cart => {
  assertShopifyCartMarket(remote);
  const lines = remote.lines.nodes.map(mapShopifyCartLine);
  const warningResult = applyWarnings(lines, warnings);
  const lineErrors = [...availabilityLineErrors(lines), ...warningResult.lineErrors];
  const truncated = remote.lines.pageInfo?.hasNextPage === true;
  const exceedsDistinctLineLimit = lines.length > MAX_CART_LINES;
  const capacityExceeded = truncated || exceedsDistinctLineLimit;
  const globalNotice = warningResult.globalMessages.reduce<string | undefined>(
    (current, message) => mergeNotice(current, message),
    undefined
  );
  return {
    lines,
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    subtotal: moneyFromDecimal(remote.cost.subtotalAmount.amount, remote.cost.subtotalAmount.currencyCode),
    lineErrors,
    status: 'idle',
    canCheckout: !capacityExceeded && canCheckoutFrom(lines, lineErrors),
    ...(truncated
      ? { globalError: SHOPIFY_CART_OVERFLOW_MESSAGE }
      : exceedsDistinctLineLimit
        ? { globalError: MAX_CART_LINES_MESSAGE }
        : {}),
    ...(globalNotice ? { globalNotice } : {}),
  };
};

const linesForVariant = (cart: Cart, merchandiseId: string): CartLine[] =>
  cart.lines.filter((line) => line.variantId === merchandiseId);

const previousQuantityForVariant = (
  previousLines: ShopifyCartMutationIntent['previousLines'],
  merchandiseId: string
): number =>
  (previousLines ?? [])
    .filter((line) => line.variantId === merchandiseId)
    .reduce((total, line) => total + line.quantity, 0);

const detectAdjustedQuantity = (
  cart: Cart,
  intent: ShopifyCartMutationIntent
): number | undefined => {
  const requested = intent.requestedQuantity;
  if (requested === undefined || !Number.isSafeInteger(requested)) return undefined;

  if (intent.kind === 'update' && intent.lineId) {
    const line = cart.lines.find((item) => item.id === intent.lineId);
    if (!line || line.quantity === requested) return undefined;
    return line.quantity;
  }

  if ((intent.kind === 'add' || intent.kind === 'create') && intent.merchandiseId) {
    if (intent.kind === 'add' && intent.previousLines === undefined) return undefined;
    const matching = linesForVariant(cart, intent.merchandiseId);
    if (matching.length !== 1) return undefined;
    const expected = previousQuantityForVariant(intent.previousLines, intent.merchandiseId) + requested;
    if (matching[0].quantity === expected) return undefined;
    return matching[0].quantity;
  }

  return undefined;
};

const intendedAddMissing = (cart: Cart, intent: ShopifyCartMutationIntent): boolean =>
  (intent.kind === 'add' || intent.kind === 'create') &&
  Boolean(intent.merchandiseId) &&
  !cart.lines.some((line) => line.variantId === intent.merchandiseId);

const operationNotice = (
  cart: Cart,
  intent: ShopifyCartMutationIntent,
  warnings: readonly ShopifyCartWarning[],
  adjustedQuantity: number | undefined
): CartOperationMessage | undefined => {
  const warningCodes = new Set(warnings.map((warning) => warning.code));
  if (adjustedQuantity !== undefined || warningCodes.has('MERCHANDISE_NOT_ENOUGH_STOCK')) {
    const targetedLine = intent.kind === 'update'
      ? cart.lines.find((line) => line.id === intent.lineId)
      : intent.merchandiseId
        ? linesForVariant(cart, intent.merchandiseId)[0]
        : undefined;
    return {
      code: 'quantity_adjusted',
      message: warningCodes.has('MERCHANDISE_NOT_ENOUGH_STOCK')
        ? SHOPIFY_NOT_ENOUGH_STOCK_NOTICE
        : targetedLine
          ? getQuantityLimitMessage(targetedLine.availability, 'adjusted')
          : SHOPIFY_NOT_ENOUGH_STOCK_NOTICE,
    };
  }

  if (warningCodes.has('MERCHANDISE_OUT_OF_STOCK')) {
    return { code: 'product_removed', message: SHOPIFY_OUT_OF_STOCK_NOTICE };
  }
  if (warningCodes.has('PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION')) {
    return { code: 'unavailable', message: SHOPIFY_UNAVAILABLE_IN_LOCATION_NOTICE };
  }
  if (warnings.length > 0) {
    return { code: 'cart_updated', message: SHOPIFY_CART_UPDATED_NOTICE };
  }
  if (intent.kind === 'remove') {
    return { code: 'product_removed', message: 'Producto eliminado del carrito.' };
  }
  return undefined;
};

export const normalizeShopifyCartPayload = (
  payload: ShopifyCartPayload | null | undefined
): ShopifyCartPayload => ({
  cart: payload?.cart ?? null,
  userErrors: Array.isArray(payload?.userErrors) ? payload.userErrors : [],
  warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
});

export const interpretShopifyCartMutation = (
  payload: ShopifyCartPayload | null | undefined,
  intent: ShopifyCartMutationIntent
): CartOperationResult => {
  const { cart: remoteCart, userErrors, warnings } = normalizeShopifyCartPayload(payload);

  if (!remoteCart) {
    return {
      success: false,
      cart: emptyCart(),
      error: userErrors.length
        ? mapUserErrors(userErrors)
        : publicCartOperationError('provider_error'),
    };
  }

  const cart = mapShopifyCart(remoteCart, warnings);
  const adjustedQuantity = detectAdjustedQuantity(cart, intent);
  const notice = operationNotice(cart, intent, warnings, adjustedQuantity);

  if (userErrors.length) {
    return {
      success: false,
      cart,
      error: mapUserErrors(userErrors),
      ...(notice ? { notice } : {}),
      ...(adjustedQuantity === undefined ? {} : { adjustedQuantity }),
    };
  }

  if (intendedAddMissing(cart, intent)) {
    const outOfStock = warnings.some((warning) => warning.code === 'MERCHANDISE_OUT_OF_STOCK');
    return {
      success: false,
      cart,
      error: publicCartOperationError(outOfStock ? 'out_of_stock' : 'unavailable', 'variant'),
      ...(notice ? { notice } : {}),
    };
  }

  return {
    success: true,
    cart,
    ...(notice ? { notice } : {}),
    ...(adjustedQuantity === undefined ? {} : { adjustedQuantity }),
  };
};

export const previousLinesFromQuantitySnapshot = (
  snapshot: ShopifyCartQuantitySnapshot | null | undefined
): ShopifyCartMutationIntent['previousLines'] => {
  if (!snapshot?.lines?.nodes || snapshot.lines.pageInfo?.hasNextPage) return undefined;
  return snapshot.lines.nodes.flatMap((line) => {
    const merchandiseId = line.merchandise?.id;
    if (!merchandiseId || !Number.isSafeInteger(line.quantity) || line.quantity < 1) return [];
    try {
      return [{ id: line.id, variantId: variantId(merchandiseId), quantity: line.quantity }];
    } catch {
      return [];
    }
  });
};

export const wouldExceedShopifyCartLineLimit = (
  snapshot: ShopifyCartQuantitySnapshot,
  merchandiseId: string
): boolean => {
  const nodes = snapshot.lines.nodes;
  const introducingNewLine = !nodes.some((line) => line.merchandise?.id === merchandiseId);
  if (!introducingNewLine) return false;
  return snapshot.lines.pageInfo?.hasNextPage === true || nodes.length >= MAX_CART_LINES;
};
