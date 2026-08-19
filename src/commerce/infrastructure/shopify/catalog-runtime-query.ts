import { publicSecurityConfig } from '@config/security';
import { CatalogValidationError } from '../../application/catalog-validation';
import type { ProductSummary } from '../../domain/catalog';
import type { ShopifyCatalogQueries } from './catalog-adapter';
import {
  mapShopifyCollections,
  mapShopifyProduct,
  mapShopifyProductSummary,
  ShopifyCatalogMappingError,
} from './catalog-mappers';
import {
  COLLECTION_FIELDS,
  COLLECTION_HANDLE_FIELDS,
  FULL_PRODUCT_FIELDS,
  PRODUCT_HANDLE_FIELDS,
  PRODUCT_SUMMARY_FIELDS,
  SHOPIFY_PAGE_SIZE,
  collectConnectionPages,
  collectLimitedConnectionPages,
  completeProductConnections,
  requireNextCursor,
  shopifyPageSize,
  type ShopifyCollectionNode,
  type ShopifyConnection,
  type ShopifyProductNode,
  type ShopifyProductSummaryNode,
} from './catalog-query';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS,
  withShopifyInContextVariables,
} from './config';
import type { ShopifyStorefrontGateway } from './storefront-gateway';

type GatewaySource = ShopifyStorefrontGateway | (() => ShopifyStorefrontGateway);

interface HandleNode {
  handle: string;
}

const PRODUCT_BY_HANDLE_QUERY = `
  query KingBeltProductByHandle($handle: String!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    product(handle: $handle) {
      ${FULL_PRODUCT_FIELDS}
    }
  }
`;

const PRODUCT_SUMMARIES_PAGE_QUERY = `
  query KingBeltProductSummariesPage($first: Int!, $after: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    products(first: $first, after: $after, sortKey: TITLE) {
      nodes { ${PRODUCT_SUMMARY_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCT_HANDLES_PAGE_QUERY = `
  query KingBeltProductHandlesPage($first: Int!, $after: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    products(first: $first, after: $after, sortKey: TITLE) {
      nodes { ${PRODUCT_HANDLE_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTIONS_PAGE_QUERY = `
  query KingBeltCollectionsPage($first: Int!, $after: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    collections(first: $first, after: $after, sortKey: TITLE) {
      nodes { ${COLLECTION_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTION_HANDLES_PAGE_QUERY = `
  query KingBeltCollectionHandlesPage($first: Int!, $after: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    collections(first: $first, after: $after, sortKey: TITLE) {
      nodes { ${COLLECTION_HANDLE_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTION_BY_HANDLE_QUERY = `
  query KingBeltCollectionByHandle($handle: String!, $first: Int!, $after: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    collection(handle: $handle) {
      ${COLLECTION_FIELDS}
      products(first: $first, after: $after, sortKey: TITLE) {
        nodes { ${PRODUCT_SUMMARY_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const createGatewayAccessor = (gateway: GatewaySource): (() => ShopifyStorefrontGateway) => {
  if (typeof gateway !== 'function') return () => gateway;
  let cached: ShopifyStorefrontGateway | undefined;
  return () => {
    cached ??= gateway();
    return cached;
  };
};

const paginateRootConnection = async <T>(
  gateway: ShopifyStorefrontGateway,
  query: string,
  label: string,
  extract: (payload: unknown) => ShopifyConnection<T>,
  limit?: number
): Promise<T[]> => {
  const first = shopifyPageSize(limit ?? SHOPIFY_PAGE_SIZE);
  const initialPayload = await gateway.graphql<unknown, { first: number; after: string | null }>(
    query,
    withShopifyInContextVariables({ first, after: null })
  );
  const initial = extract(initialPayload);
  if (limit !== undefined) {
    return collectLimitedConnectionPages(
      initial,
      label,
      async (after, pageFirst) => extract(
        await gateway.graphql<unknown, { first: number; after: string }>(query, withShopifyInContextVariables({
          first: pageFirst,
          after,
        }))
      ),
      limit
    );
  }
  return collectConnectionPages(
    initial,
    label,
    async (after) => extract(
      await gateway.graphql<unknown, { first: number; after: string }>(query, withShopifyInContextVariables({
        first: SHOPIFY_PAGE_SIZE,
        after,
      }))
    )
  );
};

const readProductsConnection = (
  payload: { products: ShopifyConnection<ShopifyProductSummaryNode> }
): ShopifyConnection<ShopifyProductSummaryNode> => payload.products;

const relatedCollectionsQuery = (count: number): string => {
  const idVariables = Array.from({ length: count }, (_, index) => `$id${index}: ID!`).join(', ');
  const afterVariables = Array.from({ length: count }, (_, index) => `$after${index}: String`).join(', ');
  const fields = Array.from({ length: count }, (_, index) => `
    c${index}: collection(id: $id${index}) {
      products(first: $first, after: $after${index}, sortKey: TITLE) {
        nodes { ${PRODUCT_SUMMARY_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `).join('\n');
  return `
    query KingBeltRelatedProducts(${idVariables}, ${afterVariables}, $first: Int!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
      ${fields}
    }
  `;
};

const sortSummariesByTitle = (products: ProductSummary[]): ProductSummary[] =>
  [...products].sort((left, right) => left.title.localeCompare(right.title, 'es'));

export const createShopifyCatalogQueries = (
  gateway: GatewaySource,
  allowedRemoteImageHosts: readonly string[] = publicSecurityConfig.remoteImageHosts
): ShopifyCatalogQueries => {
  const getGateway = createGatewayAccessor(gateway);

  const tryMapSummary = (node: ShopifyProductSummaryNode): ProductSummary | undefined => {
    try {
      return mapShopifyProductSummary(node, allowedRemoteImageHosts);
    } catch (error) {
      if (error instanceof ShopifyCatalogMappingError || error instanceof CatalogValidationError) {
        return undefined;
      }
      throw error;
    }
  };

  const mapSummaries = (nodes: readonly ShopifyProductSummaryNode[]): ProductSummary[] =>
    nodes.flatMap((node) => {
      const summary = tryMapSummary(node);
      return summary ? [summary] : [];
    });

  const loadProductSummaries = async (limit?: number): Promise<ProductSummary[]> => {
    if (limit === 0) return [];
    if (limit === undefined) {
      const nodes = await paginateRootConnection(
        getGateway(),
        PRODUCT_SUMMARIES_PAGE_QUERY,
        'resúmenes de producto',
        (payload) => readProductsConnection(payload as { products: ShopifyConnection<ShopifyProductSummaryNode> })
      );
      return mapSummaries(nodes);
    }

    const gatewayImpl = getGateway();
    const summaries: ProductSummary[] = [];
    let after: string | null = null;
    let hasNextPage = true;
    let pages = 0;
    const seenCursors = new Set<string>();

    while (summaries.length < limit && hasNextPage) {
      if (pages >= 40) {
        throw new Error('Shopify superó el límite de páginas de resúmenes de producto.');
      }
      const payload = await gatewayImpl.graphql<
        { products: ShopifyConnection<ShopifyProductSummaryNode> },
        { first: number; after: string | null }
      >(
        PRODUCT_SUMMARIES_PAGE_QUERY,
        withShopifyInContextVariables({
          first: shopifyPageSize(limit - summaries.length),
          after,
        })
      );
      const connection = readProductsConnection(payload);
      summaries.push(...mapSummaries(connection.nodes));
      hasNextPage = connection.pageInfo.hasNextPage;
      pages += 1;
      if (summaries.length >= limit || !hasNextPage) break;
      const cursor = requireNextCursor(connection.pageInfo, 'resúmenes de producto');
      if (seenCursors.has(cursor) || cursor === after) {
        throw new Error(
          after === cursor
            ? 'Shopify devolvió un cursor que no avanza de resúmenes de producto.'
            : 'Shopify devolvió un cursor repetido de resúmenes de producto: la paginación no avanza.'
        );
      }
      seenCursors.add(cursor);
      after = cursor;
    }

    return summaries.slice(0, limit);
  };

  return {
    async getCollections() {
      const nodes = await paginateRootConnection(
        getGateway(),
        COLLECTIONS_PAGE_QUERY,
        'colecciones',
        (payload) => (payload as { collections: ShopifyConnection<ShopifyCollectionNode> }).collections
      );
      return mapShopifyCollections(nodes, allowedRemoteImageHosts);
    },

    async getCollectionHandles() {
      const nodes = await paginateRootConnection(
        getGateway(),
        COLLECTION_HANDLES_PAGE_QUERY,
        'handles de colección',
        (payload) => (payload as { collections: ShopifyConnection<HandleNode> }).collections
      );
      return nodes.map((node) => node.handle);
    },

    async getCollectionByHandle(handle) {
      const gatewayImpl = getGateway();
      const initial = await gatewayImpl.graphql<{
        collection: (ShopifyCollectionNode & {
          products: ShopifyConnection<ShopifyProductSummaryNode>;
        }) | null;
      }, { handle: string; first: number; after: string | null }>(
        COLLECTION_BY_HANDLE_QUERY,
        withShopifyInContextVariables({ handle, first: SHOPIFY_PAGE_SIZE, after: null })
      );
      if (!initial.collection) return undefined;

      const productNodes = await collectConnectionPages(
        initial.collection.products,
        `productos de ${handle}`,
        async (after) => {
          const page = await gatewayImpl.graphql<{
            collection: { products: ShopifyConnection<ShopifyProductSummaryNode> } | null;
          }, { handle: string; first: number; after: string }>(
            COLLECTION_BY_HANDLE_QUERY,
            withShopifyInContextVariables({ handle, first: SHOPIFY_PAGE_SIZE, after })
          );
          if (!page.collection) {
            throw new Error(`Shopify dejó de devolver la colección ${handle} durante la paginación.`);
          }
          return page.collection.products;
        }
      );

      const [collection] = mapShopifyCollections([initial.collection], allowedRemoteImageHosts);
      return {
        collection,
        products: mapSummaries(productNodes),
      };
    },

    async getProductHandles() {
      const nodes = await paginateRootConnection(
        getGateway(),
        PRODUCT_HANDLES_PAGE_QUERY,
        'handles de producto',
        (payload) => (payload as { products: ShopifyConnection<HandleNode> }).products
      );
      return nodes.map((node) => node.handle);
    },

    async getProductByHandle(handle) {
      const gatewayImpl = getGateway();
      const data = await gatewayImpl.graphql<
        { product: ShopifyProductNode | null },
        { handle: string }
      >(PRODUCT_BY_HANDLE_QUERY, withShopifyInContextVariables({ handle }));
      if (!data.product) return undefined;
      const complete = await completeProductConnections(gatewayImpl, data.product);
      return mapShopifyProduct(complete, allowedRemoteImageHosts);
    },

    async getProductSummaries() {
      return loadProductSummaries();
    },

    async getFeaturedProducts(limit) {
      return loadProductSummaries(limit);
    },

    async getRelatedProducts(product, limit) {
      const collectionIds = [...new Set(product.collectionIds)];
      if (!collectionIds.length) return [];

      const gatewayImpl = getGateway();
      const pageSize = shopifyPageSize(Math.min(Math.max(limit + 1, 1), SHOPIFY_PAGE_SIZE));
      const collected = new Map<string, ProductSummary>();
      let pending = collectionIds.map((id) => ({ id, after: null as string | null }));

      while (collected.size < limit && pending.length) {
        const query = relatedCollectionsQuery(pending.length);
        const variables: Record<string, string | number | null> = { first: pageSize };
        pending.forEach((item, index) => {
          variables[`id${index}`] = item.id;
          variables[`after${index}`] = item.after;
        });
        const data = await gatewayImpl.graphql<
          Record<string, { products: ShopifyConnection<ShopifyProductSummaryNode> } | null>,
          Record<string, string | number | null>
        >(query, withShopifyInContextVariables(variables));

        const nextPending: typeof pending = [];
        pending.forEach((item, index) => {
          const collection = data[`c${index}`];
          if (!collection) return;
          mapSummaries(collection.products.nodes).forEach((candidate) => {
            if (candidate.handle === product.handle || candidate.id === product.id) return;
            if (!collected.has(candidate.id)) collected.set(candidate.id, candidate);
          });
          if (collection.products.pageInfo.hasNextPage) {
            const after = collection.products.pageInfo.endCursor;
            if (!after || after === item.after) {
              throw new Error(
                `Shopify devolvió un cursor que no avanza de productos relacionados de ${item.id}.`
              );
            }
            nextPending.push({ ...item, after });
          }
        });
        pending = nextPending;
      }

      return sortSummariesByTitle([...collected.values()]).slice(0, limit);
    },
  };
};
