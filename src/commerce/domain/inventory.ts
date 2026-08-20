import type { ProductVariant } from './catalog';
import { commerceRules } from './commerce-rules';

export const TECHNICAL_LINE_QUANTITY_LIMIT = commerceRules.cart.technicalLineQuantityLimit;

export const isTechnicalLineQuantity = (quantity: number): boolean =>
  Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= TECHNICAL_LINE_QUANTITY_LIMIT;

export type AvailabilityStatus =
  | 'available'
  | 'limited'
  | 'out_of_stock'
  | 'unavailable';

export interface LineAvailability {
  status: AvailabilityStatus;
  purchasable: boolean;
  maxQuantity: number;
  minimum: number;
  increment: number;
  limitReason: 'inventory' | 'quantity_rule' | 'technical' | 'unavailable';
  quantityKnown: boolean;
  backorder: boolean;
  message: string;
}

type VariantAvailabilityInput = Pick<
  ProductVariant,
  'salesStatus' | 'inventory' | 'inventoryPolicy' | 'quantityRule'
>;

const getTechnicalLimit = (value: number): number =>
  Number.isSafeInteger(value) && value > 0
    ? value
    : TECHNICAL_LINE_QUANTITY_LIMIT;

const getConfiguredMaximum = (value: number | undefined): number | undefined =>
  Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;

const getLimit = (
  variant: VariantAvailabilityInput,
  technicalLimit: number,
  inventoryCapsQuantity: boolean
): Pick<LineAvailability, 'maxQuantity' | 'limitReason'> => {
  const candidates: Array<{ value: number; reason: LineAvailability['limitReason']; priority: number }> = [
    { value: technicalLimit, reason: 'technical', priority: 3 },
  ];
  const quantityMaximum = getConfiguredMaximum(variant.quantityRule.maximum);
  if (quantityMaximum !== undefined) {
    candidates.push({ value: quantityMaximum, reason: 'quantity_rule', priority: 1 });
  }
  if (inventoryCapsQuantity && variant.inventory.kind === 'known') {
    candidates.push({ value: variant.inventory.quantity, reason: 'inventory', priority: 2 });
  }
  candidates.sort((left, right) => left.value - right.value || left.priority - right.priority);
  return { maxQuantity: candidates[0].value, limitReason: candidates[0].reason };
};

export const getVariantAvailability = (
  variant: VariantAvailabilityInput,
  technicalLimit = TECHNICAL_LINE_QUANTITY_LIMIT
): LineAvailability => {
  const validTechnicalLimit = getTechnicalLimit(technicalLimit);
  const quantityKnown = variant.inventory.kind === 'known';
  const quantityRule = variant.quantityRule;
  const rule = {
    minimum: quantityRule.minimum,
    increment: quantityRule.increment,
  };

  if (variant.salesStatus === 'unavailable') {
    return {
      status: 'unavailable',
      purchasable: false,
      maxQuantity: 0,
      ...rule,
      limitReason: 'unavailable',
      quantityKnown,
      backorder: false,
      message: 'Esta variante no está disponible.',
    };
  }

  if (variant.inventory.kind === 'known' && variant.inventory.quantity <= 0) {
    if (variant.inventoryPolicy === 'continue') {
      return {
        status: 'available',
        purchasable: true,
        ...getLimit(variant, validTechnicalLimit, false),
        ...rule,
        quantityKnown: true,
        backorder: true,
        message: 'Disponible para pedir.',
      };
    }

    return {
      status: 'out_of_stock',
      purchasable: false,
      maxQuantity: 0,
      ...rule,
      limitReason: 'inventory',
      quantityKnown: true,
      backorder: false,
      message: 'Producto agotado.',
    };
  }

  if (variant.inventory.kind === 'unknown') {
    return {
      status: 'available',
      purchasable: true,
      ...getLimit(variant, validTechnicalLimit, false),
      ...rule,
      quantityKnown: false,
      backorder: false,
      message: 'Disponible.',
    };
  }

  if (variant.inventoryPolicy === 'continue') {
    return {
      status: 'available',
      purchasable: true,
      ...getLimit(variant, validTechnicalLimit, false),
      ...rule,
      quantityKnown: true,
      backorder: false,
      message: 'Disponible.',
    };
  }

  const limit = getLimit(variant, validTechnicalLimit, true);
  const limited = variant.inventory.quantity <= commerceRules.availability.lowStockThreshold;
  return {
    status: limited ? 'limited' : 'available',
    purchasable: true,
    ...limit,
    ...rule,
    quantityKnown: true,
    backorder: false,
    message: limited ? 'Quedan pocas unidades.' : 'Disponible.',
  };
};

export const isVariantPurchasable = (variant: VariantAvailabilityInput): boolean =>
  getVariantAvailability(variant).purchasable;

export const isQuantityAllowed = (
  quantity: number,
  rule: Pick<LineAvailability, 'minimum' | 'increment' | 'maxQuantity'>
): boolean =>
  Number.isSafeInteger(quantity) &&
  quantity >= rule.minimum &&
  quantity <= rule.maxQuantity &&
  (quantity - rule.minimum) % rule.increment === 0;

export const clampQuantityToRule = (
  quantity: number,
  rule: Pick<LineAvailability, 'minimum' | 'increment' | 'maxQuantity'>
): number => {
  if (rule.maxQuantity < rule.minimum) return 0;
  const bounded = Math.min(Math.max(quantity, rule.minimum), rule.maxQuantity);
  return rule.minimum + Math.floor((bounded - rule.minimum) / rule.increment) * rule.increment;
};

export const getQuantityLimitMessage = (
  availability: Pick<LineAvailability, 'limitReason' | 'maxQuantity' | 'message'>,
  action: 'exceeded' | 'adjusted' = 'exceeded'
): string => {
  if (action === 'adjusted') {
    return availability.limitReason === 'inventory'
      ? 'Hemos reducido la cantidad porque cambió el stock disponible.'
      : 'Hemos reducido la cantidad al máximo permitido para esta variante.';
  }

  if (availability.limitReason === 'quantity_rule') {
    return `El máximo por compra para esta variante es ${availability.maxQuantity}.`;
  }
  if (availability.limitReason === 'technical') {
    return `Puedes añadir hasta ${availability.maxQuantity} unidades de esta variante al carrito.`;
  }
  if (availability.limitReason === 'inventory') {
    return commerceRules.availability.exposeExactInventory
      ? `Solo quedan ${availability.maxQuantity} unidades.`
      : 'La cantidad supera el stock disponible.';
  }
  return availability.message;
};
