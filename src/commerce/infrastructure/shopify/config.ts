export const SHOPIFY_STOREFRONT_API_VERSION = '2026-07' as const;
export const MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH = 512;

export interface ShopifyStorefrontConfigInput {
  storeDomain?: string;
  apiVersion?: string;
  storefrontToken?: string;
}

export interface ShopifyStorefrontConfig {
  storeDomain: string;
  apiVersion: typeof SHOPIFY_STOREFRONT_API_VERSION;
  storefrontToken: string;
}

export class ShopifyConfigurationError extends Error {
  readonly name = 'ShopifyConfigurationError';

  constructor(message: string) {
    super(message);
  }
}

const SHOPIFY_STORE_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;
/** Secretos de app, no tokens de Storefront. `shpat_` sí puede ser el token privado Headless. */
const APP_SECRET_TOKEN_PATTERN = /^(?:shpca|shpss)_/;
const TOKEN_WHITESPACE_PATTERN = /\s/;
const TOKEN_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const HOSTNAME_FORBIDDEN_CHAR_PATTERN = /[/?#@:\\]/;
const SHOPIFY_STORE_DOMAIN_MESSAGE =
  'SHOPIFY_STORE_DOMAIN must be a hostname like shop-name.myshopify.com, without protocol, path, query, fragment, credentials, or port.';

export interface ShopifyStoreDomainInspection {
  name: 'SHOPIFY_STORE_DOMAIN';
  exists: boolean;
  length: number;
  hasProtocol: boolean;
  hasSlash: boolean;
  hasWhitespace: boolean;
  hasQuotes: boolean;
}

const invalidStoreDomain = (): never => {
  throw new ShopifyConfigurationError(SHOPIFY_STORE_DOMAIN_MESSAGE);
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

const hostnameFromUrl = (url: URL): string => {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') invalidStoreDomain();
  if (url.username || url.password || url.port || url.search || url.hash) invalidStoreDomain();
  if (url.pathname !== '/' && url.pathname !== '') invalidStoreDomain();
  return url.hostname;
};

/** Diagnóstico seguro: nunca incluye el valor ni secretos. */
export const inspectShopifyStoreDomain = (raw: unknown): ShopifyStoreDomainInspection => {
  const value = typeof raw === 'string' ? raw : '';
  return {
    name: 'SHOPIFY_STORE_DOMAIN',
    exists: value.length > 0,
    length: value.length,
    hasProtocol: /:\/\//.test(value),
    hasSlash: value.includes('/'),
    hasWhitespace: /\s/.test(value),
    hasQuotes: /['"]/.test(value),
  };
};

const hostnameFromRawDomain = (value: string): string => {
  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return hostnameFromUrl(new URL(value));
  }
  const withoutTrailingSlashes = value.replace(/\/+$/, '');
  if (!withoutTrailingSlashes || HOSTNAME_FORBIDDEN_CHAR_PATTERN.test(withoutTrailingSlashes)) {
    invalidStoreDomain();
  }
  return hostnameFromUrl(new URL(`https://${withoutTrailingSlashes}`));
};

/**
 * Acepta el hostname de Storefront. Normaliza recorte, comillas envolventes,
 * protocolo http(s) accidental y barra final. Rechaza el dominio público del
 * sitio, admin.shopify.com, rutas, query, fragmento, puerto y credenciales.
 */
export const normalizeShopifyStoreDomain = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ShopifyConfigurationError('Missing required Shopify configuration: SHOPIFY_STORE_DOMAIN');
  }

  const strippedQuotes = stripWrappingQuotes(raw.trim());
  if (!strippedQuotes) {
    throw new ShopifyConfigurationError('Missing required Shopify configuration: SHOPIFY_STORE_DOMAIN');
  }
  if (TOKEN_WHITESPACE_PATTERN.test(strippedQuotes) || TOKEN_CONTROL_PATTERN.test(strippedQuotes)) {
    invalidStoreDomain();
  }

  try {
    const storeDomain = hostnameFromRawDomain(strippedQuotes).toLowerCase();
    if (!SHOPIFY_STORE_DOMAIN_PATTERN.test(storeDomain)) invalidStoreDomain();
    return storeDomain;
  } catch (error) {
    if (error instanceof ShopifyConfigurationError) throw error;
    return invalidStoreDomain();
  }
};

export const reportShopifyConfigurationError = (
  error: ShopifyConfigurationError,
  input: { storeDomain?: string; hasStorefrontToken: boolean }
): void => {
  console.error(JSON.stringify({
    event: 'shopify_configuration_error',
    message: error.message,
    SHOPIFY_STORE_DOMAIN: inspectShopifyStoreDomain(input.storeDomain),
    SHOPIFY_STOREFRONT_PRIVATE_TOKEN: { exists: input.hasStorefrontToken },
  }));
};

/** Valida las credenciales solo cuando se inicializa explícitamente Storefront. */
export const getShopifyStorefrontConfig = (
  input: ShopifyStorefrontConfigInput
): ShopifyStorefrontConfig => {
  const storeDomain = normalizeShopifyStoreDomain(input.storeDomain);

  const apiVersion = input.apiVersion?.trim() || SHOPIFY_STOREFRONT_API_VERSION;
  if (apiVersion !== SHOPIFY_STOREFRONT_API_VERSION) {
    throw new ShopifyConfigurationError(
      `SHOPIFY_API_VERSION must be the pinned version ${SHOPIFY_STOREFRONT_API_VERSION}.`
    );
  }

  const storefrontToken = input.storefrontToken ?? '';
  if (!storefrontToken.trim()) {
    throw new ShopifyConfigurationError(
      'Missing required Shopify configuration: SHOPIFY_STOREFRONT_PRIVATE_TOKEN'
    );
  }
  if (
    TOKEN_WHITESPACE_PATTERN.test(storefrontToken) ||
    TOKEN_CONTROL_PATTERN.test(storefrontToken)
  ) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_STOREFRONT_PRIVATE_TOKEN must not contain whitespace or control characters.'
    );
  }
  if (storefrontToken.length > MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH) {
    throw new ShopifyConfigurationError(
      `SHOPIFY_STOREFRONT_PRIVATE_TOKEN must be at most ${MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH} characters.`
    );
  }
  if (APP_SECRET_TOKEN_PATTERN.test(storefrontToken)) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_STOREFRONT_PRIVATE_TOKEN must be the Headless private access token, not an app client secret.'
    );
  }

  return { storeDomain, apiVersion, storefrontToken };
};

export const buildShopifyStorefrontEndpoint = (
  config: Pick<ShopifyStorefrontConfig, 'storeDomain' | 'apiVersion'>
): string => `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;
