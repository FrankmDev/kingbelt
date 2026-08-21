import { SHOPIFY_CUSTOMER_ACCOUNT_URL } from 'astro:env/server';
import {
  buildAccountAccessResponse,
  resolveCustomerAccountHref,
} from './application/hosted-url';
import { commerceSource } from './commerce-source';

/** CTA de cuenta para header y menú móvil. Una sola resolución server-side. */
export const getCustomerAccountHref = (): string | null =>
  resolveCustomerAccountHref({
    source: commerceSource,
    customerAccountUrl: SHOPIFY_CUSTOMER_ACCOUNT_URL,
  });

/**
 * `/cuenta/iniciar` en Shopify: redirect temporal al portal alojado, o 503 si falta la URL.
 * En demo devuelve null para renderizar el panel visual.
 */
export const getAccountAccessResponse = (): Response | null =>
  buildAccountAccessResponse(commerceSource, SHOPIFY_CUSTOMER_ACCOUNT_URL);
