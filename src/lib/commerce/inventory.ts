import type { AvailabilityStatus, LineAvailability } from './types';

export interface VariantKey {
  productId: string;
  color: string;
  size: string;
}

/** Reglas de inventario provisional para la demo local. */
interface InventoryRule {
  status: AvailabilityStatus;
  maxQuantity: number;
  message?: string;
}

const defaultRule: InventoryRule = {
  status: 'available',
  maxQuantity: 10,
};

/**
 * Productos de demostración con estados de disponibilidad variados.
 * Sustituir por consulta al proveedor de comercio (Shopify).
 */
const inventoryRules: Record<string, InventoryRule | ((variant: VariantKey) => InventoryRule)> = {
  /** Cinturón Garaje — agotado en todas las variantes. */
  'kb-sport-001': {
    status: 'out_of_stock',
    maxQuantity: 0,
    message: 'Producto agotado.',
  },
  /** Cinturón Bandera — stock limitado (máx. 2 unidades por variante). */
  'kb-casual-002': {
    status: 'limited',
    maxQuantity: 2,
    message: 'Quedan pocas unidades.',
  },
  /** Cinturón Circuito — talla 100 no disponible. */
  'kb-sport-002': (variant) =>
    variant.size === '100'
      ? {
          status: 'unavailable',
          maxQuantity: 0,
          message: 'Esta talla ya no está disponible.',
        }
      : {
          status: 'available',
          maxQuantity: 6,
        },
  /** Cinturón Huella — producto retirado del catálogo. */
  'kb-casual-008': {
    status: 'unavailable',
    maxQuantity: 0,
    message: 'Este producto ya no está disponible.',
  },
};

export const getVariantAvailability = (variant: VariantKey): LineAvailability => {
  const rule = inventoryRules[variant.productId];
  const resolved = typeof rule === 'function' ? rule(variant) : (rule ?? defaultRule);

  return {
    status: resolved.status,
    maxQuantity: resolved.maxQuantity,
    message: resolved.message,
  };
};

export const canAddToCart = (variant: VariantKey, quantity: number): boolean => {
  const availability = getVariantAvailability(variant);
  return availability.status === 'available' || availability.status === 'limited'
    ? quantity > 0 && quantity <= availability.maxQuantity
    : false;
};

export const isProductPurchasable = (
  productId: string,
  colors: readonly string[],
  sizes: readonly string[]
): boolean =>
  colors.some((color) =>
    sizes.some((size) => canAddToCart({ productId, color, size }, 1))
  );
