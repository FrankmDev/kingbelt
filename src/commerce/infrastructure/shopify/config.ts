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

/** Valida las credenciales solo cuando se inicializa explícitamente Storefront. */
export const getShopifyStorefrontConfig = (
  input: ShopifyStorefrontConfigInput
): ShopifyStorefrontConfig => {
  const storeDomain = input.storeDomain?.trim().toLowerCase() ?? '';
  if (!storeDomain) {
    throw new ShopifyConfigurationError('SHOPIFY_STORE_DOMAIN is required to use Shopify Storefront.');
  }
  if (!SHOPIFY_STORE_DOMAIN_PATTERN.test(storeDomain)) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_STORE_DOMAIN must be a hostname like shop-name.myshopify.com, without protocol, path, query, fragment, credentials, or port.'
    );
  }

  const apiVersion = input.apiVersion?.trim() || SHOPIFY_STOREFRONT_API_VERSION;
  if (apiVersion !== SHOPIFY_STOREFRONT_API_VERSION) {
    throw new ShopifyConfigurationError(
      `SHOPIFY_API_VERSION must be the pinned version ${SHOPIFY_STOREFRONT_API_VERSION}.`
    );
  }

  const storefrontToken = input.storefrontToken ?? '';
  if (!storefrontToken.trim()) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_STOREFRONT_PRIVATE_TOKEN is required to use Shopify Storefront.'
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
