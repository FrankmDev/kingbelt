import type { ShopifyStorefrontGateway } from './storefront-gateway';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  withShopifyInContextVariables,
} from './config';
import {
  SHOPIFY_PAGE_SIZE,
  SHOPIFY_MAX_CONNECTION_PAGES,
  collectConnectionPages,
  completedConnection,
  requireNextCursor,
  type ShopifyConnection,
  type ShopifyPageInfo,
} from './catalog-pagination';

export {
  SHOPIFY_PAGE_SIZE,
  collectConnectionPages,
  collectLimitedConnectionPages,
  completedConnection,
  requireNextCursor,
  shopifyPageSize,
  SHOPIFY_MAX_CONNECTION_PAGES,
} from './catalog-pagination';
export type { ShopifyConnection, ShopifyPageInfo };

/** Alias conservados para el contrato de paginación ya usado por mappers y tests. */
export type PageInfo = ShopifyPageInfo;
export type Connection<T> = ShopifyConnection<T>;

export interface ShopifyImageNode {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ShopifyCollectionNode {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: ShopifyImageNode | null;
}

export interface ShopifyOptionValueNode {
  id: string;
  name: string;
  swatch: { color: string | null } | null;
}

export interface ShopifyOptionNode {
  id: string;
  name: string;
  optionValues: ShopifyOptionValueNode[];
}

export interface ShopifyVariantNode {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  currentlyNotInStock: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  quantityRule: { minimum: number; increment: number; maximum: number | null };
  image: ShopifyImageNode | null;
  weight: number;
  weightUnit: string;
}

export interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface ShopifyCollectionReferenceNode {
  __typename: 'Collection';
  id: string;
  handle?: string;
  title?: string;
}

export interface ShopifyMetafieldReferenceNode {
  __typename: string;
  id?: string;
  handle?: string;
  title?: string;
}

export interface ShopifyMetafieldNode {
  namespace: string;
  key: string;
  type: string;
  value: string | null;
  reference: ShopifyMetafieldReferenceNode | null;
}

export interface ShopifyProductNode {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  publishedAt: string | null;
  category: { id: string; name: string } | null;
  seo: { title: string | null; description: string | null };
  featuredImage: ShopifyImageNode | null;
  collections: Connection<Pick<ShopifyCollectionNode, 'id' | 'handle' | 'title'>>;
  options: ShopifyOptionNode[];
  images: Connection<ShopifyImageNode>;
  variants: Connection<ShopifyVariantNode>;
  metafields: Array<ShopifyMetafieldNode | null>;
}

export interface ShopifyProductSummaryNode {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  availableForSale: boolean;
  featuredImage: ShopifyImageNode | null;
  collections: Connection<Pick<ShopifyCollectionNode, 'id' | 'handle' | 'title'>>;
  options: ShopifyOptionNode[];
  priceRange: {
    minVariantPrice: ShopifyMoneyV2;
    maxVariantPrice: ShopifyMoneyV2;
  };
  metafields: Array<ShopifyMetafieldNode | null>;
}

export interface ShopifyCatalogPayload {
  products: ShopifyProductNode[];
  collections: ShopifyCollectionNode[];
}

export const IMAGE_FIELDS = `id url altText width height`;

export const VARIANT_FIELDS = `
  id title sku availableForSale currentlyNotInStock
  selectedOptions { name value }
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  quantityRule { minimum increment maximum }
  image { ${IMAGE_FIELDS} }
  weight weightUnit
`;

const COLLECTION_REFERENCE_SELECTION = `
  reference {
    __typename
    ... on Collection { id handle title }
  }
`;

const FULL_PRODUCT_METAFIELDS = `
  metafields(identifiers: [
    { namespace: "kingbelt", key: "model_reference" }
    { namespace: "kingbelt", key: "summary" }
    { namespace: "kingbelt", key: "material" }
    { namespace: "kingbelt", key: "width_mm" }
    { namespace: "kingbelt", key: "buckle_finish" }
    { namespace: "kingbelt", key: "badge" }
    { namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}", key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}" }
  ]) {
    namespace key type value
    ${COLLECTION_REFERENCE_SELECTION}
  }
`;

export const FULL_PRODUCT_FIELDS = `
  id handle title description vendor productType publishedAt
  category { id name }
  seo { title description }
  featuredImage { ${IMAGE_FIELDS} }
  collections(first: ${SHOPIFY_PAGE_SIZE}) {
    nodes { id handle title }
    pageInfo { hasNextPage endCursor }
  }
  options(first: 3) {
    id name
    optionValues { id name swatch { color } }
  }
  images(first: ${SHOPIFY_PAGE_SIZE}) {
    nodes { ${IMAGE_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
  variants(first: ${SHOPIFY_PAGE_SIZE}) {
    nodes { ${VARIANT_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
  ${FULL_PRODUCT_METAFIELDS}
`;

export const PRODUCT_SUMMARY_FIELDS = `
  id handle title description productType availableForSale
  featuredImage { ${IMAGE_FIELDS} }
  collections(first: ${SHOPIFY_PAGE_SIZE}) {
    nodes { id handle title }
    pageInfo { hasNextPage endCursor }
  }
  options(first: 3) {
    id name
    optionValues { id name swatch { color } }
  }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  metafields(identifiers: [
    { namespace: "kingbelt", key: "model_reference" }
    { namespace: "kingbelt", key: "summary" }
    { namespace: "kingbelt", key: "badge" }
    { namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}", key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}" }
  ]) {
    namespace key type value
    ${COLLECTION_REFERENCE_SELECTION}
  }
`;

export const COLLECTION_FIELDS = `
  id handle title description
  image { ${IMAGE_FIELDS} }
`;

export const PRODUCT_HANDLE_FIELDS = `handle`;
export const COLLECTION_HANDLE_FIELDS = `handle`;

const CATALOG_PAGE_QUERY = `
  query KingBeltCatalogPage($first: Int!, $productsAfter: String, $collectionsAfter: String, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    products(first: $first, after: $productsAfter, sortKey: TITLE) {
      nodes { ${FULL_PRODUCT_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
    collections(first: $first, after: $collectionsAfter, sortKey: TITLE) {
      nodes { ${COLLECTION_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCT_VARIANTS_PAGE_QUERY = `
  query KingBeltProductVariantsPage($id: ID!, $first: Int!, $after: String!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    node(id: $id) { ... on Product {
      variants(first: $first, after: $after) {
        nodes { ${VARIANT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const PRODUCT_IMAGES_PAGE_QUERY = `
  query KingBeltProductImagesPage($id: ID!, $first: Int!, $after: String!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    node(id: $id) { ... on Product {
      images(first: $first, after: $after) {
        nodes { ${IMAGE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const PRODUCT_COLLECTIONS_PAGE_QUERY = `
  query KingBeltProductCollectionsPage($id: ID!, $first: Int!, $after: String!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    node(id: $id) { ... on Product {
      collections(first: $first, after: $after) {
        nodes { id handle title }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const variablesForProductPage = (id: string, after: string) => ({
  id,
  first: SHOPIFY_PAGE_SIZE,
  after,
});

const loadProductConnectionPage = async <T>(
  gateway: ShopifyStorefrontGateway,
  query: string,
  product: Pick<ShopifyProductNode, 'id' | 'handle'>,
  after: string,
  read: (node: Record<string, Connection<T>>) => Connection<T>
): Promise<Connection<T>> => {
  const data = await gateway.graphql<
    { node: Record<string, Connection<T>> | null },
    ReturnType<typeof variablesForProductPage>
  >(query, withShopifyInContextVariables(variablesForProductPage(product.id, after)));
  if (!data.node) {
    throw new Error(`Shopify dejó de devolver el producto ${product.handle} durante la paginación.`);
  }
  return read(data.node);
};

export const completeProductConnections = async (
  gateway: ShopifyStorefrontGateway,
  product: ShopifyProductNode
): Promise<ShopifyProductNode> => {
  const needsVariants = product.variants.pageInfo.hasNextPage;
  const needsImages = product.images.pageInfo.hasNextPage;
  const needsCollections = product.collections.pageInfo.hasNextPage;
  if (!needsVariants && !needsImages && !needsCollections) return product;

  const [variants, images, collections] = await Promise.all([
    needsVariants
      ? collectConnectionPages(
          product.variants,
          `variantes de ${product.handle}`,
          (after) => loadProductConnectionPage(
            gateway,
            PRODUCT_VARIANTS_PAGE_QUERY,
            product,
            after,
            (node) => node.variants
          )
        )
      : Promise.resolve(product.variants.nodes),
    needsImages
      ? collectConnectionPages(
          product.images,
          `imágenes de ${product.handle}`,
          (after) => loadProductConnectionPage(
            gateway,
            PRODUCT_IMAGES_PAGE_QUERY,
            product,
            after,
            (node) => node.images
          )
        )
      : Promise.resolve(product.images.nodes),
    needsCollections
      ? collectConnectionPages(
          product.collections,
          `colecciones de ${product.handle}`,
          (after) => loadProductConnectionPage(
            gateway,
            PRODUCT_COLLECTIONS_PAGE_QUERY,
            product,
            after,
            (node) => node.collections
          )
        )
      : Promise.resolve(product.collections.nodes),
  ]);

  return {
    ...product,
    variants: completedConnection(variants),
    images: completedConnection(images),
    collections: completedConnection(collections),
  };
};

/** Obtiene el catálogo publicado completo. Solo preflight y validación offline. */
export const fetchShopifyCatalog = async (
  gateway: ShopifyStorefrontGateway
): Promise<ShopifyCatalogPayload> => {
  const products: ShopifyProductNode[] = [];
  const collections: ShopifyCollectionNode[] = [];
  let productsAfter: string | null = null;
  let collectionsAfter: string | null = null;
  let productsDone = false;
  let collectionsDone = false;
  const seenProductCursors = new Set<string>();
  const seenCollectionCursors = new Set<string>();
  let pages = 0;

  while (!productsDone || !collectionsDone) {
    if (pages >= SHOPIFY_MAX_CONNECTION_PAGES) {
      throw new Error('Shopify superó el límite de páginas del catálogo completo.');
    }
    pages += 1;
    const data = await gateway.graphql<{
      products: Connection<ShopifyProductNode>;
      collections: Connection<ShopifyCollectionNode>;
    }, { first: number; productsAfter: string | null; collectionsAfter: string | null }>(
      CATALOG_PAGE_QUERY,
      withShopifyInContextVariables({ first: SHOPIFY_PAGE_SIZE, productsAfter, collectionsAfter })
    );
    if (!productsDone) products.push(...data.products.nodes);
    if (!collectionsDone) collections.push(...data.collections.nodes);
    productsDone = productsDone || !data.products.pageInfo.hasNextPage;
    collectionsDone = collectionsDone || !data.collections.pageInfo.hasNextPage;
    if (!productsDone) {
      const cursor = requireNextCursor(data.products.pageInfo, 'productos');
      if (seenProductCursors.has(cursor) || cursor === productsAfter) {
        throw new Error('Shopify devolvió un cursor repetido de productos: la paginación no avanza.');
      }
      seenProductCursors.add(cursor);
      productsAfter = cursor;
    }
    if (!collectionsDone) {
      const cursor = requireNextCursor(data.collections.pageInfo, 'colecciones');
      if (seenCollectionCursors.has(cursor) || cursor === collectionsAfter) {
        throw new Error('Shopify devolvió un cursor repetido de colecciones: la paginación no avanza.');
      }
      seenCollectionCursors.add(cursor);
      collectionsAfter = cursor;
    }
  }

  return {
    products: await Promise.all(products.map((product) => completeProductConnections(gateway, product))),
    collections,
  };
};
