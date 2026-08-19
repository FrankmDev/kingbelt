import { COMMERCE_SOURCE } from 'astro:env/client';

export type CommerceSource = 'demo' | 'shopify';

export const isCommerceSource = (value: unknown): value is CommerceSource =>
  value === 'demo' || value === 'shopify';

/** Valida el enum explícito. No infiere el origen desde la plataforma, tokens ni la URL de la petición. */
export const resolveCommerceSource = (value: unknown): CommerceSource => {
  if (isCommerceSource(value)) return value;
  throw new Error(
    'Invalid COMMERCE_SOURCE. Set COMMERCE_SOURCE to "demo" or "shopify" in the deployment environment variables.'
  );
};

/** Fuente de comercio declarada por el entorno y validada por Astro. */
export const commerceSource: CommerceSource = resolveCommerceSource(COMMERCE_SOURCE);

export const isShopifyCommerce = (): boolean => commerceSource === 'shopify';

export const isDemoCommerce = (): boolean => commerceSource === 'demo';

/** Selecciona exactamente una rama sin inicializar el proveedor no elegido. */
export const selectCommerceProvider = <Provider>(
  providers: Readonly<Record<CommerceSource, () => Provider>>
): Provider => providers[commerceSource]();
