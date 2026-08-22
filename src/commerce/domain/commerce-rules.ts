/**
 * Decisiones operativas de comercio que todavía no proceden de Shopify.
 *
 * `technicalLineQuantityLimit` protege inputs y persistencia; no representa
 * existencias ni una política comercial. Las decisiones marcadas como
 * `pending` son defaults conservadores de la demo y deben confirmarse antes
 * de activar la tienda real.
 */
export const commerceRules = {
  cart: {
    technicalLineQuantityLimit: 99,
    maximumDistinctLines: 50,
  },
  pricing: {
    /** Precio comercial mínimo de una variante, en unidades mínimas de moneda. */
    minimumVariantUnitPriceMinor: 1,
  },
  quantity: {
    /** Política admitida hasta que la interfaz soporte reglas escalonadas. */
    supportedMinimum: 1,
    supportedIncrement: 1,
  },
  checkout: {
    /** Tiempo máximo de espera antes de ofrecer recuperación sin vaciar el carrito. */
    timeoutMs: 30_000,
  },
  availability: {
    lowStockThreshold: 2,
    exposeExactInventory: false,
    decisionStatus: 'pending',
  },
} as const;

export const isCommercialVariantPrice = (amountMinor: number): boolean =>
  Number.isSafeInteger(amountMinor)
  && amountMinor >= commerceRules.pricing.minimumVariantUnitPriceMinor;
