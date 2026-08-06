const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^[\da-f:]+$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export const MAX_CHECKOUT_URL_LENGTH = 2_048;

/** Proyección mínima para validar una salida de checkout sin acoplar módulos. */
export interface CheckoutRedirectCandidate {
  status: string;
  url?: string;
  allowedHosts?: readonly string[];
}

/** Normaliza un host permitido; rechaza comodines, puertos y sufijos ambiguos. */
export const normalizeCheckoutHost = (host: string): string | null => {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed || trimmed.includes('*') || trimmed.includes('/') || trimmed.includes(':')) return null;
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return null;
  if (!HOSTNAME_PATTERN.test(trimmed)) return null;
  if (IPV4_PATTERN.test(trimmed) || (trimmed.includes(':') && IPV6_PATTERN.test(trimmed))) return null;
  return trimmed;
};

export const normalizeAllowedCheckoutHosts = (
  hosts: readonly string[]
): readonly string[] => {
  const normalized = hosts
    .map((host) => normalizeCheckoutHost(host))
    .filter((host): host is string => host !== null);
  return [...new Set(normalized)];
};

/** Hosts explícitos para checkout Shopify; sin comodines ni coincidencia por sufijo. */
export const buildShopifyCheckoutHosts = (storeDomain: string): readonly string[] => {
  const normalizedStore = normalizeCheckoutHost(storeDomain);
  return normalizeAllowedCheckoutHosts(
    [normalizedStore, 'checkout.shopify.com'].filter((host): host is string => Boolean(host))
  );
};

const isHostnameAllowed = (hostname: string, allowedHosts: ReadonlySet<string>): boolean =>
  allowedHosts.has(hostname.toLowerCase());

/**
 * Defensa adicional antes de abandonar el sitio. El adaptador debe declarar
 * explícitamente sus hosts de checkout (dominio propio o Shopify).
 */
export const getSafeCheckoutUrl = (result: CheckoutRedirectCandidate): URL | null => {
  if (
    result.status !== 'ready' ||
    !result.url ||
    !result.allowedHosts?.length ||
    result.url.length > MAX_CHECKOUT_URL_LENGTH ||
    result.url !== result.url.trim() ||
    CONTROL_CHARACTER_PATTERN.test(result.url)
  ) {
    return null;
  }

  const allowedHosts = new Set(normalizeAllowedCheckoutHosts(result.allowedHosts));
  if (!allowedHosts.size) return null;

  try {
    const url = new URL(result.url);
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      !isHostnameAllowed(hostname, allowedHosts)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
};
