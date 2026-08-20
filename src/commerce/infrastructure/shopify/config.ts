export const SHOPIFY_STOREFRONT_API_VERSION = '2026-07' as const;
export const MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH = 512;

/** Mercado operativo actual de KingBelt. Decisión de producto versionada en servidor. */
export const SHOPIFY_MARKET_COUNTRY = 'ES' as const;
export const SHOPIFY_MARKET_LANGUAGE = 'ES' as const;
export const SHOPIFY_MARKET_CURRENCY = 'EUR' as const;

export interface ShopifyMarketContext {
  country: typeof SHOPIFY_MARKET_COUNTRY;
  language: typeof SHOPIFY_MARKET_LANGUAGE;
  currency: typeof SHOPIFY_MARKET_CURRENCY;
}

export const SHOPIFY_MARKET_CONTEXT: ShopifyMarketContext = {
  country: SHOPIFY_MARKET_COUNTRY,
  language: SHOPIFY_MARKET_LANGUAGE,
  currency: SHOPIFY_MARKET_CURRENCY,
};

export const SHOPIFY_SUPPORTED_CURRENCIES: readonly [typeof SHOPIFY_MARKET_CURRENCY] = [
  SHOPIFY_MARKET_CURRENCY,
];

/** Colección principal: contrato fijo de Storefront, no configurable por entorno. */
export const SHOPIFY_PRIMARY_COLLECTION_METAFIELD = {
  namespace: 'custom',
  key: 'kingbelt_primary_collection',
  type: 'collection_reference',
} as const;

export const SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER =
  `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}.${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}` as const;

/** Galerías por color: contrato fijo de Storefront, no configurable por entorno. */
export const SHOPIFY_COLOR_GALLERIES_METAFIELD = {
  namespace: 'custom',
  key: 'kingbelt_color_galleries',
  type: 'list.metaobject_reference',
} as const;

export const SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER =
  `${SHOPIFY_COLOR_GALLERIES_METAFIELD.namespace}.${SHOPIFY_COLOR_GALLERIES_METAFIELD.key}` as const;

/** Tipo real del metaobject referenciado por la definición publicada. */
export const SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE = 'galerias_por_color' as const;

/** Catálogo: país e idioma del mercado. El país del Cart no usa este helper. */
export const SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS =
  '$country: CountryCode!, $language: LanguageCode!' as const;
export const SHOPIFY_IN_CONTEXT_DIRECTIVE =
  '@inContext(country: $country, language: $language)' as const;

export const shopifyInContextVariables = (): {
  country: ShopifyMarketContext['country'];
  language: ShopifyMarketContext['language'];
} => ({
  country: SHOPIFY_MARKET_CONTEXT.country,
  language: SHOPIFY_MARKET_CONTEXT.language,
});

export const withShopifyInContextVariables = <T extends object>(variables: T) => ({
  ...variables,
  ...shopifyInContextVariables(),
});

/**
 * Cart: solo idioma para títulos y opciones traducibles.
 * El país y el pricing internacional salen de `buyerIdentity.countryCode`.
 */
export const SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS =
  '$language: LanguageCode!' as const;
export const SHOPIFY_CART_IN_CONTEXT_DIRECTIVE =
  '@inContext(language: $language)' as const;

export const withShopifyCartInContextVariables = <T extends object>(variables: T) => ({
  ...variables,
  language: SHOPIFY_MARKET_CONTEXT.language,
});

export const shopifyCartBuyerIdentity = (): {
  countryCode: ShopifyMarketContext['country'];
} => ({
  countryCode: SHOPIFY_MARKET_CONTEXT.country,
});

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

/**
 * Acepta exclusivamente el hostname myshopify. No corrige formatos ambiguos:
 * una URL, una barra o espacios indican una configuración inválida.
 */
export const normalizeShopifyStoreDomain = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw) {
    throw new ShopifyConfigurationError('Missing required Shopify configuration: SHOPIFY_STORE_DOMAIN');
  }
  if (
    raw !== raw.trim()
    || TOKEN_WHITESPACE_PATTERN.test(raw)
    || TOKEN_CONTROL_PATTERN.test(raw)
    || /[/?#@:\\'"]/.test(raw)
  ) {
    invalidStoreDomain();
  }
  const storeDomain = raw.toLowerCase();
  if (!SHOPIFY_STORE_DOMAIN_PATTERN.test(storeDomain)) invalidStoreDomain();
  return storeDomain;
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
