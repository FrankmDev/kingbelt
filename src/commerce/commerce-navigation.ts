import { SHOPIFY_CUSTOMER_ACCOUNT_URL } from 'astro:env/server';
import {
  CUSTOMER_ACCOUNT_REDIRECT_STATUS,
  parseShopifyHostedUrl,
  resolveCustomerAccountHref,
  ShopifyHostedUrlError,
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
export const getAccountAccessResponse = (): Response | null => {
  if (commerceSource !== 'shopify') return null;

  try {
    return Response.redirect(
      parseShopifyHostedUrl(SHOPIFY_CUSTOMER_ACCOUNT_URL).href,
      CUSTOMER_ACCOUNT_REDIRECT_STATUS
    );
  } catch (error) {
    if (error instanceof ShopifyHostedUrlError) {
      return new Response('Shopify Customer Accounts are not configured.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    throw error;
  }
};
