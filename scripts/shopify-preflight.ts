import {
  assertValidCatalog,
  CatalogValidationError,
} from '../src/commerce/application/catalog-validation.ts';
import { parseShopifyHostedUrl, ShopifyHostedUrlError } from '../src/commerce/application/hosted-url.ts';
import { getRedirectedProductHandles } from '../src/commerce/application/product-redirects.ts';
import {
  resolveCatalogIndexHead,
  resolveCollectionPageHead,
  resolveProductPageHead,
} from '../src/commerce/application/seo.ts';
import type { Collection, Product } from '../src/commerce/domain/catalog.ts';
import { getCollectionFacets } from '../src/commerce/domain/catalog-filters.ts';
import {
  getColorGalleries,
  getInitialColorValueId,
} from '../src/commerce/domain/product-media.ts';
import {
  toCompactPublicBuyBoxPayload,
  toPublicBuyBoxVariant,
} from '../src/commerce/domain/product-mappers.ts';
import {
  calculatePriceRange,
  getFirstAvailableVariant,
  getVariantBySelectedOptions,
} from '../src/commerce/domain/variants.ts';
import { publicSecurityConfig } from '../src/config/security.ts';
import { site, siteUrl } from '../src/config/site.ts';
import { catalogPage } from '../src/content/catalog.ts';
import { serializeJsonForHtml } from '../src/shared/security/serialize-json-for-html.ts';
import { createShopifyCatalogAdapter, createShopifyCatalogSnapshotQueries } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import {
  getShopifyStorefrontConfig,
  ShopifyConfigurationError,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_STOREFRONT_API_VERSION,
  SHOPIFY_SUPPORTED_CURRENCIES,
  type ShopifyMarketContext,
} from '../src/commerce/infrastructure/shopify/config.ts';
import {
  mapShopifyCatalog,
  ShopifyCatalogMappingError,
  type ShopifyCatalog,
} from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import { fetchShopifyCatalog } from '../src/commerce/infrastructure/shopify/catalog-query.ts';
import {
  createShopifyStorefrontGateway,
  ShopifyStorefrontRequestError,
  type ShopifyStorefrontGateway,
} from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';

export const PREFLIGHT_SHOP_QUERY = `
  query PreflightShop {
    shop {
      name
    }
  }
`;

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CART_GID_PATTERN = /gid:\/\/shopify\/Cart\/[^\s"'\\]+/gi;
const AUTH_HEADER_PATTERN = /(?:authorization|shopify-storefront-private-token)\s*[:=]\s*\S+/gi;
const MUTATION_PATTERN = /\bmutation\b/i;

export type ShopifyPreflightEnv = Record<string, string | undefined>;

export type ShopifyPreflightErrorKind =
  | 'configuration'
  | 'authentication'
  | 'network/timeout'
  | 'graphql'
  | 'catalog';

export class ShopifyPreflightError extends Error {
  readonly name = 'ShopifyPreflightError';

  constructor(
    readonly kind: ShopifyPreflightErrorKind,
    message: string
  ) {
    super(message);
  }
}

export interface ShopifyPreflightSummary {
  products: number;
  variants: number;
  collections: number;
  images: number;
  requiredProducts: 'OK' | 'skipped';
  market: ShopifyMarketContext;
}

export interface ShopifyPreflightIO {
  fetch?: typeof fetch;
  timeoutMs?: number;
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  allowedRemoteImageHosts?: readonly string[];
}

interface ShopQueryData {
  shop?: { name?: unknown };
}

const fail = (kind: ShopifyPreflightErrorKind, message: string): never => {
  throw new ShopifyPreflightError(kind, message);
};

const secretValues = (env: ShopifyPreflightEnv): string[] =>
  [
    env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    env.SHOPIFY_WEBHOOK_SECRET,
    env.SHOPIFY_CATALOG_WEBHOOK_SECRET,
    env.VERCEL_DEPLOY_HOOK_URL,
    env.UPSTASH_REDIS_REST_TOKEN,
  ].flatMap((value) => (value && value.trim() ? [value] : []));

export const sanitizePreflightText = (value: string, env: ShopifyPreflightEnv): string => {
  let sanitized = value;
  for (const secret of secretValues(env)) {
    sanitized = sanitized.split(secret).join('[redacted]');
  }
  return sanitized
    .replace(CART_GID_PATTERN, '[redacted-cart-id]')
    .replace(AUTH_HEADER_PATTERN, '[redacted-header]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 500);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown Shopify preflight error.';

export const parseRequiredProductHandles = (raw: string | undefined): string[] => {
  if (raw === undefined) return [];
  const handles = raw.split(',').map((handle) => handle.trim()).filter(Boolean);
  if (handles.some((handle) => !HANDLE_PATTERN.test(handle))) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES must be a comma-separated list of product handles.'
    );
  }
  const seen = new Set<string>();
  handles.forEach((handle) => {
    if (seen.has(handle)) {
      throw new ShopifyConfigurationError(
        'SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES contains a duplicate handle.'
      );
    }
    seen.add(handle);
  });
  return handles;
};

const createReadOnlyGateway = (
  gateway: ShopifyStorefrontGateway
): ShopifyStorefrontGateway => ({
  async graphql(query, variables) {
    if (MUTATION_PATTERN.test(query)) {
      fail('catalog', 'Shopify preflight must remain read-only and cannot send GraphQL mutations.');
    }
    return gateway.graphql(query, variables);
  },
});

const assertVariantResolution = (product: Product): void => {
  product.variants.forEach((variant, variantIndex) => {
    const resolved = getVariantBySelectedOptions(product, variant.optionValues);
    if (!resolved) {
      return fail(
        'catalog',
        `Option selection does not resolve to a variant at ${product.handle}.variants[${variantIndex}].`
      );
    }
    if (resolved.id !== variant.id) {
      return fail(
        'catalog',
        `Option selection resolved to a different variant at ${product.handle}.variants[${variantIndex}].`
      );
    }
  });
};

const assertProductPageSurface = (
  product: Product,
  collections: readonly Collection[]
): void => {
  if (!collections.some((collection) => collection.id === product.primaryCollectionId)) {
    return fail('catalog', `Colección principal no encontrada: ${product.primaryCollectionId}`);
  }
  const initialVariant = getFirstAvailableVariant(product) ?? product.variants[0];
  if (!initialVariant) {
    return fail('catalog', `Product ${product.handle} has no selectable variant.`);
  }
  const colorGalleries = getColorGalleries(product);
  getInitialColorValueId(initialVariant, colorGalleries);
  calculatePriceRange(product.variants);
  toPublicBuyBoxVariant(initialVariant);
  const pageHead = resolveProductPageHead(product, site, siteUrl);
  serializeJsonForHtml(toCompactPublicBuyBoxPayload(product));
  serializeJsonForHtml(pageHead.schema);
  assertVariantResolution(product);
};

const assertAstroCatalogSurface = async (
  catalog: ShopifyCatalog,
  requiredHandles: readonly string[]
): Promise<void> => {
  const provider = createShopifyCatalogAdapter(createShopifyCatalogSnapshotQueries(catalog));
  const [
    productHandles,
    collectionHandles,
    collections,
    summaries,
    featured,
  ] = await Promise.all([
    provider.getProductHandles(),
    provider.getCollectionHandles(),
    provider.getCollections(),
    provider.getProductSummaries(),
    provider.getFeaturedProducts(4),
  ]);

  if (productHandles.length !== catalog.products.length) {
    fail(
      'catalog',
      `Catalog adapter product handles (${productHandles.length}) do not match mapped products (${catalog.products.length}).`
    );
  }
  if (collectionHandles.length !== catalog.collections.length) {
    fail(
      'catalog',
      `Catalog adapter collection handles (${collectionHandles.length}) do not match mapped collections (${catalog.collections.length}).`
    );
  }
  if (summaries.length !== catalog.products.length) {
    fail(
      'catalog',
      `Catalog adapter produced ${summaries.length} summaries for ${catalog.products.length} products.`
    );
  }
  if (catalog.products.length > 0 && featured.length === 0) {
    fail('catalog', 'Home featured products resolved empty for a non-empty catalog.');
  }

  const redirectedHandles = getRedirectedProductHandles();
  productHandles.forEach((handle) => {
    if (redirectedHandles.has(handle)) {
      fail('catalog', `Published product handle is also registered as a product redirect: ${handle}.`);
    }
  });

  getCollectionFacets(summaries);
  const indexHead = resolveCatalogIndexHead(
    {
      title: catalogPage.seo.title,
      description: catalogPage.seo.description,
      products: summaries,
      collections,
    },
    site,
    siteUrl
  );
  serializeJsonForHtml(indexHead.schema);

  for (const handle of collectionHandles) {
    const collectionPage = await provider.getCollectionByHandle(handle);
    if (!collectionPage) {
      return fail('catalog', `Collection page did not resolve for handle ${handle}.`);
    }
    const collectionHead = resolveCollectionPageHead(collectionPage, site, siteUrl);
    serializeJsonForHtml(collectionHead.schema);
  }

  for (const handle of productHandles) {
    const product = await provider.getProductByHandle(handle);
    if (!product) {
      return fail('catalog', `Product page did not resolve for handle ${handle}.`);
    }
    await provider.getRelatedProducts(product, 4);
    assertProductPageSurface(product, collections);
  }

  for (const handle of requiredHandles) {
    const product = await provider.getProductByHandle(handle);
    if (!product) {
      return fail('catalog', `Required product handle was not found: ${handle}.`);
    }
    if (!product.variants.length) {
      return fail('catalog', `Required product ${handle} has no variants.`);
    }
  }
};

const catalogCounts = (products: readonly Product[], collections: readonly Collection[]) => ({
  products: products.length,
  variants: products.reduce((total, product) => total + product.variants.length, 0),
  collections: collections.length,
  images: products.reduce((total, product) => total + product.images.length, 0)
    + collections.reduce((total, collection) => total + (collection.image ? 1 : 0), 0),
});

const classifyPreflightError = (
  error: unknown,
  env: ShopifyPreflightEnv
): { kind: ShopifyPreflightErrorKind; message: string } => {
  const message = sanitizePreflightText(errorMessage(error), env);
  if (error instanceof ShopifyPreflightError) {
    return { kind: error.kind, message: sanitizePreflightText(error.message, env) };
  }
  if (error instanceof ShopifyConfigurationError || error instanceof ShopifyHostedUrlError) {
    return { kind: 'configuration', message };
  }
  if (error instanceof ShopifyStorefrontRequestError) {
    if (error.kind === 'timeout' || error.kind === 'network') {
      return { kind: 'network/timeout', message };
    }
    if (error.kind === 'graphql') {
      if (/ACCESS_DENIED|UNAUTHORIZED|UNAUTHENTICATED/i.test(error.message)) {
        return { kind: 'authentication', message };
      }
      return { kind: 'graphql', message };
    }
    if (error.status === 401 || error.status === 403) {
      return { kind: 'authentication', message };
    }
    return { kind: 'network/timeout', message };
  }
  if (error instanceof ShopifyCatalogMappingError) {
    return { kind: 'catalog', message };
  }
  if (error instanceof CatalogValidationError) {
    const issues = error.issues.slice(0, 5).map((issue) =>
      sanitizePreflightText(`${issue.code} at ${issue.path}: ${issue.message}`, env)
    );
    const omitted = error.issues.length - issues.length;
    const suffix = omitted > 0 ? ` (+${omitted} more)` : '';
    return { kind: 'catalog', message: `${issues.join(' | ')}${suffix}` };
  }
  return { kind: 'catalog', message };
};

export const formatPreflightSuccess = (summary: ShopifyPreflightSummary): string =>
  [
    'Shopify preflight passed',
    '',
    'Storefront API: OK',
    'Catalog mapping: OK',
    'Catalog validation: OK',
    `Market: ${summary.market.country}`,
    `Language: ${summary.market.language}`,
    `Currency: ${summary.market.currency}`,
    `Products: ${summary.products}`,
    `Variants: ${summary.variants}`,
    `Collections: ${summary.collections}`,
    `Images: ${summary.images}`,
    `Required products: ${summary.requiredProducts}`,
  ].join('\n');

const PREFLIGHT_ERROR_LABEL: Record<ShopifyPreflightErrorKind, string> = {
  configuration: 'configuration error',
  authentication: 'authentication error',
  'network/timeout': 'network/timeout error',
  graphql: 'GraphQL error',
  catalog: 'catalog error',
};

export const formatPreflightFailure = (error: unknown, env: ShopifyPreflightEnv): string => {
  const classified = classifyPreflightError(error, env);
  return `Shopify preflight failed\n${PREFLIGHT_ERROR_LABEL[classified.kind]}: ${classified.message}`;
};

const assertPreflightConfiguration = (env: ShopifyPreflightEnv) => {
  if (env.COMMERCE_SOURCE !== 'shopify') {
    throw new ShopifyConfigurationError(
      'Shopify preflight requires COMMERCE_SOURCE=shopify'
    );
  }
  if (env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN) {
    throw new ShopifyConfigurationError(
      'PUBLIC_SHOPIFY_STOREFRONT_TOKEN is not used. Use SHOPIFY_STOREFRONT_PRIVATE_TOKEN only.'
    );
  }
  const config = getShopifyStorefrontConfig({
    storeDomain: env.SHOPIFY_STORE_DOMAIN,
    apiVersion: env.SHOPIFY_API_VERSION || SHOPIFY_STOREFRONT_API_VERSION,
    storefrontToken: env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  });
  parseShopifyHostedUrl(env.SHOPIFY_CUSTOMER_ACCOUNT_URL);
  const requiredHandles = parseRequiredProductHandles(env.SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES);
  return { config, requiredHandles };
};

export const runShopifyPreflight = async (
  env: ShopifyPreflightEnv,
  io: ShopifyPreflightIO = {}
): Promise<ShopifyPreflightSummary> => {
  const { config, requiredHandles } = assertPreflightConfiguration(env);
  const gateway = createReadOnlyGateway(
    createShopifyStorefrontGateway(config, {
      fetch: io.fetch,
      timeoutMs: io.timeoutMs,
    })
  );

  const shop = await gateway.graphql<ShopQueryData>(PREFLIGHT_SHOP_QUERY);
  if (!shop || typeof shop !== 'object' || typeof shop.shop?.name !== 'string' || !shop.shop.name) {
    fail('catalog', 'Shopify Storefront connection succeeded but returned an unexpected shop payload.');
  }

  const payload = await fetchShopifyCatalog(gateway);

  const allowedHosts = io.allowedRemoteImageHosts ?? publicSecurityConfig.remoteImageHosts;
  const catalog = mapShopifyCatalog(payload, allowedHosts);
  assertValidCatalog(
    catalog.products,
    catalog.collections,
    SHOPIFY_SUPPORTED_CURRENCIES,
    allowedHosts
  );
  await assertAstroCatalogSurface(catalog, requiredHandles);

  return {
    ...catalogCounts(catalog.products, catalog.collections),
    requiredProducts: requiredHandles.length ? 'OK' : 'skipped',
    market: SHOPIFY_MARKET_CONTEXT,
  };
};

export const runShopifyPreflightCli = async (
  env: ShopifyPreflightEnv = process.env,
  io: ShopifyPreflightIO = {}
): Promise<number> => {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    const summary = await runShopifyPreflight(env, io);
    stdout.write(`${formatPreflightSuccess(summary)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${formatPreflightFailure(error, env)}\n`);
    return 1;
  }
};
