import { isIP } from 'node:net';
import {
  buildShopifyStorefrontEndpoint,
  getShopifyStorefrontConfig,
  ShopifyConfigurationError,
  type ShopifyStorefrontConfigInput,
} from './config';

export const DEFAULT_STOREFRONT_TIMEOUT_MS = 15_000;
export const MAX_SHOPIFY_BUYER_IP_LENGTH = 45;

export type ShopifyStorefrontErrorKind =
  | 'http'
  | 'invalid_json'
  | 'invalid_response'
  | 'graphql'
  | 'network'
  | 'timeout';

export class ShopifyStorefrontRequestError extends Error {
  readonly name = 'ShopifyStorefrontRequestError';

  constructor(
    readonly kind: ShopifyStorefrontErrorKind,
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

export interface ShopifyStorefrontGateway {
  graphql<TData, TVariables extends object = Record<string, never>>(
    query: string,
    variables?: TVariables
  ): Promise<TData>;
}

export interface ShopifyStorefrontGatewayOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** IP del comprador. Obligatoria en tráfico real; se omite en build y smoke. */
  buyerIp?: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const redact = (value: string, storefrontToken: string): string => {
  const withoutToken = value.split(storefrontToken).join('[redacted]');
  return withoutToken.replace(/[\r\n\t]+/g, ' ').slice(0, 300);
};

const describeGraphQLError = (error: unknown, storefrontToken: string): string => {
  if (!isRecord(error)) return 'Unspecified GraphQL error';

  const message = typeof error.message === 'string'
    ? redact(error.message, storefrontToken)
    : 'Unspecified GraphQL error';
  const extensions = isRecord(error.extensions) ? error.extensions : undefined;
  const code = typeof extensions?.code === 'string'
    ? ` [${redact(extensions.code, storefrontToken)}]`
    : '';

  return `${message}${code}`;
};

const validateTimeout = (timeoutMs: number): number => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ShopifyConfigurationError('Storefront timeout must be a positive finite number.');
  }
  return timeoutMs;
};

const validateBuyerIp = (buyerIp: string): string => {
  if (
    !buyerIp ||
    buyerIp.trim() !== buyerIp ||
    buyerIp.length > MAX_SHOPIFY_BUYER_IP_LENGTH ||
    isIP(buyerIp) === 0
  ) {
    throw new ShopifyConfigurationError(
      'Shopify-Storefront-Buyer-IP must be an IPv4 or IPv6 address.'
    );
  }

  return buyerIp;
};

/** Gateway GraphQL genérico, exclusivamente server-side y sin conocimiento del dominio. */
export const createShopifyStorefrontGateway = (
  configInput: ShopifyStorefrontConfigInput,
  options: ShopifyStorefrontGatewayOptions = {}
): ShopifyStorefrontGateway => {
  const config = getShopifyStorefrontConfig(configInput);
  const endpoint = buildShopifyStorefrontEndpoint(config);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = validateTimeout(options.timeoutMs ?? DEFAULT_STOREFRONT_TIMEOUT_MS);
  const buyerIp = options.buyerIp === undefined ? undefined : validateBuyerIp(options.buyerIp);

  return {
    async graphql<TData, TVariables extends object = Record<string, never>>(
      query: string,
      variables?: TVariables
    ): Promise<TData> {
      if (!query.trim()) {
        throw new ShopifyConfigurationError('Storefront GraphQL query must not be empty.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': config.storefrontToken,
      };
      if (buyerIp) headers['Shopify-Storefront-Buyer-IP'] = buyerIp;

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables: variables ?? {} }),
          cache: 'no-store',
          redirect: 'manual',
          signal: controller.signal,
        });

        if (!response.ok || response.type === 'opaqueredirect') {
          throw new ShopifyStorefrontRequestError(
            'http',
            `Shopify Storefront request failed with HTTP ${response.status}.`,
            response.status
          );
        }

        let payload: unknown;
        try {
          payload = JSON.parse(await response.text());
        } catch {
          throw new ShopifyStorefrontRequestError(
            'invalid_json',
            'Shopify Storefront returned an invalid JSON response.'
          );
        }

        if (!isRecord(payload)) {
          throw new ShopifyStorefrontRequestError(
            'invalid_response',
            'Shopify Storefront returned an invalid GraphQL response envelope.'
          );
        }

        if ('errors' in payload && !Array.isArray(payload.errors)) {
          throw new ShopifyStorefrontRequestError(
            'invalid_response',
            'Shopify Storefront returned an invalid GraphQL errors field.'
          );
        }

        if (Array.isArray(payload.errors) && payload.errors.length > 0) {
          const summaries = payload.errors
            .slice(0, 3)
            .map((error) => describeGraphQLError(error, config.storefrontToken));
          const omitted = Math.max(0, payload.errors.length - summaries.length);
          const suffix = omitted ? ` (+${omitted} more)` : '';
          throw new ShopifyStorefrontRequestError(
            'graphql',
            `Shopify Storefront returned ${payload.errors.length} GraphQL error(s): ${summaries.join(' | ')}${suffix}`
          );
        }

        if (!Object.hasOwn(payload, 'data') || payload.data == null) {
          throw new ShopifyStorefrontRequestError(
            'invalid_response',
            'Shopify Storefront returned a GraphQL response without data.'
          );
        }

        return payload.data as TData;
      } catch (error) {
        if (error instanceof ShopifyStorefrontRequestError || error instanceof ShopifyConfigurationError) {
          throw error;
        }
        if (controller.signal.aborted) {
          throw new ShopifyStorefrontRequestError(
            'timeout',
            `Shopify Storefront request timed out after ${timeoutMs} ms.`
          );
        }
        throw new ShopifyStorefrontRequestError(
          'network',
          'Shopify Storefront request failed before a response was received.'
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
};
