import { COMMERCE_SOURCE } from 'astro:env/client';

export type CommerceSource = 'demo' | 'shopify';

/** Fuente de comercio declarada por el entorno y validada por Astro. */
export const commerceSource: CommerceSource = COMMERCE_SOURCE;

/** Selecciona exactamente una rama sin inicializar el proveedor no elegido. */
export const selectCommerceProvider = <Provider>(
  providers: Readonly<Record<CommerceSource, () => Provider>>
): Provider => providers[commerceSource]();
