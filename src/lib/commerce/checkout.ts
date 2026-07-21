import type { CheckoutResult } from './types';

/** Estado de demostración del proveedor local. No simula pedidos ni pagos. */
export const requestLocalCheckout = async (): Promise<CheckoutResult> => ({
  status: 'unavailable',
  message: 'El checkout de demostración todavía no está conectado.',
});

/**
 * Defensa adicional antes de abandonar el sitio. El adaptador Shopify deberá
 * declarar explícitamente sus hosts de checkout (dominio propio o Shopify).
 */
export const getSafeCheckoutUrl = (result: CheckoutResult): URL | null => {
  if (!result.url || !result.allowedHosts?.length) return null;

  try {
    const url = new URL(result.url);
    const allowedHosts = new Set(result.allowedHosts.map((host) => host.toLowerCase()));

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
};
