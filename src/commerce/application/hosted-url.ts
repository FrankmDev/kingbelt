import { MAX_EXTERNAL_URL_LENGTH, normalizeExactHostname } from '../domain/url-policy';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export const MAX_HOSTED_URL_LENGTH = MAX_EXTERNAL_URL_LENGTH;
export const ACCOUNT_ACCESS_HREF = '/cuenta/iniciar';
export const CUSTOMER_ACCOUNT_REDIRECT_STATUS = 307 as const;
export const CUSTOMER_ACCOUNT_UNAVAILABLE_STATUS = 503 as const;
export const SHOPIFY_CUSTOMER_ACCOUNT_URL_NAME = 'SHOPIFY_CUSTOMER_ACCOUNT_URL' as const;
export const CUSTOMER_ACCOUNT_UNAVAILABLE_MESSAGE =
  'Shopify Customer Accounts are not configured.' as const;

const HOSTED_URL_MESSAGE =
  'must be an absolute HTTPS URL with an explicit hostname, without credentials, javascript:, data:, query, or unexpected fragments.';

export class ShopifyHostedUrlError extends Error {
  readonly name = 'ShopifyHostedUrlError';

  constructor(
    readonly variableName: string,
    message: string
  ) {
    super(message);
  }
}

const invalidHostedUrl = (variableName: string): never => {
  throw new ShopifyHostedUrlError(variableName, `${variableName} ${HOSTED_URL_MESSAGE}`);
};

const stripWrappingQuotes = (value: string): string => {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim();
  }
  return value;
};

/**
 * Valida una URL alojada de Shopify procedente solo de configuración server-side.
 * Exige HTTPS y hostname explícito; no aplica allowlist para permitir un dominio de cuentas propio.
 */
export const parseShopifyHostedUrl = (
  raw: unknown,
  variableName = SHOPIFY_CUSTOMER_ACCOUNT_URL_NAME
): URL => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ShopifyHostedUrlError(
      variableName,
      `Missing required Shopify configuration: ${variableName}`
    );
  }

  const value = stripWrappingQuotes(raw.trim());
  if (
    !value ||
    value.length > MAX_HOSTED_URL_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    /\s/.test(value) ||
    value.includes('\\') ||
    !ABSOLUTE_URL_PATTERN.test(value)
  ) {
    return invalidHostedUrl(variableName);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalidHostedUrl(variableName);
  }

  const hostname = normalizeExactHostname(url.hostname);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== '443') ||
    !hostname ||
    IPV4_PATTERN.test(hostname)
  ) {
    return invalidHostedUrl(variableName);
  }

  return url;
};

/**
 * Destino del CTA de cuenta. Desktop y móvil usan siempre la ruta estable de KingBelt.
 * En Shopify, `/cuenta/iniciar` redirige al portal alojado; si la URL falta o es inválida,
 * el CTA se desactiva y la ruta responde 503. No hay fallback silencioso al panel demo.
 */
export const resolveCustomerAccountHref = (input: {
  source: 'demo' | 'shopify';
  customerAccountUrl?: string | null;
}): string | null => {
  if (input.source !== 'shopify') return ACCOUNT_ACCESS_HREF;
  try {
    parseShopifyHostedUrl(input.customerAccountUrl);
    return ACCOUNT_ACCESS_HREF;
  } catch {
    return null;
  }
};

/**
 * Respuesta de `/cuenta/iniciar`. Demo renderiza el panel visual (null).
 * Shopify: 307 al portal alojado, o 503 fail-closed si la URL falta o es inválida.
 */
export const buildAccountAccessResponse = (
  source: 'demo' | 'shopify',
  customerAccountUrl?: string | null
): Response | null => {
  if (source !== 'shopify') return null;

  try {
    return Response.redirect(
      parseShopifyHostedUrl(customerAccountUrl).href,
      CUSTOMER_ACCOUNT_REDIRECT_STATUS
    );
  } catch (error) {
    if (error instanceof ShopifyHostedUrlError) {
      return new Response(CUSTOMER_ACCOUNT_UNAVAILABLE_MESSAGE, {
        status: CUSTOMER_ACCOUNT_UNAVAILABLE_STATUS,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    throw error;
  }
};
