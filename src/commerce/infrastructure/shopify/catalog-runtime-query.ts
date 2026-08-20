import { publicSecurityConfig } from '@config/security';
import type { ProductSummary } from '../../domain/catalog';
import type { ShopifyCatalogQueries } from './catalog-adapter';
import {
  mapShopifyCollections,
  mapShopifyProduct,
  mapShopifyProductSummary,
} from './catalog-mappers';
import {
  COLLECTION_FIELDS,
  COLLECTION_HANDLE_FIELDS,
  FULL_PRODUCT_FIELDS,
  PRODUCT_HANDLE_FIELDS,
  PRODUCT_SUMMARY_FIELDS,
  SHOPIFY_PAGE_SIZE,
  SHOPIFY_MAX_CONNECTION_PAGES,
  collectConnectionPages,
  collectLimitedConnectionPages,
  completeProductConnections,
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
  if (limit === 0) return [];

  const loadPage = async (after: string | null, pageFirst: number) =>
    extract(
      await gateway.graphql<unknown, { first: number; after: string | null }>(
        query,
        withShopifyInContextVariables({ first: pageFirst, after })
      )
    );

  const initial = await loadPage(null, shopifyPageSize(limit ?? SHOPIFY_PAGE_SIZE));
  return limit === undefined
    ? collectConnectionPages(initial, label, (after) => loadPage(after, SHOPIFY_PAGE_SIZE))
    : collectLimitedConnectionPages(initial, label, loadPage, limit);
};

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

  const mapSummaries = (nodes: readonly ShopifyProductSummaryNode[]): ProductSummary[] =>
    nodes.map((node) => mapShopifyProductSummary(node, allowedRemoteImageHosts));

  const loadProductSummaries = async (limit?: number): Promise<ProductSummary[]> =>
    mapSummaries(
      await paginateRootConnection(
        getGateway(),
        PRODUCT_SUMMARIES_PAGE_QUERY,
        'resúmenes de producto',
        (payload) => (payload as { products: ShopifyConnection<ShopifyProductSummaryNode> }).products,
        limit
      )
    );

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
      const collectionId = product.primaryCollectionId;
      if (!collectionId) return [];
      const collectionIds = [collectionId];

      const gatewayImpl = getGateway();
      const pageSize = shopifyPageSize(Math.min(Math.max(limit + 1, 1), SHOPIFY_PAGE_SIZE));
      const collected = new Map<string, ProductSummary>();
      let pending = collectionIds.map((id) => ({ id, after: null as string | null }));
      let pages = 0;

      while (collected.size < limit && pending.length) {
        if (pages >= SHOPIFY_MAX_CONNECTION_PAGES) {
          throw new Error('Shopify superó el límite de páginas de productos relacionados.');
        }
        pages += 1;
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
