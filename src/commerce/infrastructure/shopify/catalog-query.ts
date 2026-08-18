import type { ShopifyStorefrontGateway } from './storefront-gateway';

const PAGE_SIZE = 250;

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

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

export interface ShopifyMetaobjectFieldNode {
  key: string;
  type: string;
  value: string | null;
  references: Connection<ShopifyMetafieldReferenceNode> | null;
}

export interface ShopifyMetafieldReferenceNode {
  __typename: string;
  id?: string;
  type?: string;
  fields?: ShopifyMetaobjectFieldNode[];
  image?: ShopifyImageNode | null;
  url?: string;
}

export interface ShopifyMetafieldNode {
  namespace: string;
  key: string;
  type: string;
  value: string | null;
  references: Connection<ShopifyMetafieldReferenceNode> | null;
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

export interface ShopifyCatalogPayload {
  products: ShopifyProductNode[];
  collections: ShopifyCollectionNode[];
}

const IMAGE_FIELDS = `id url altText width height`;
const VARIANT_FIELDS = `
  id title sku availableForSale currentlyNotInStock
  selectedOptions { name value }
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  quantityRule { minimum increment maximum }
  image { ${IMAGE_FIELDS} }
  weight weightUnit
`;

const PRODUCT_FIELDS = `
  id handle title description vendor productType publishedAt
  category { id name }
  seo { title description }
  featuredImage { ${IMAGE_FIELDS} }
  collections(first: ${PAGE_SIZE}) {
    nodes { id handle title }
    pageInfo { hasNextPage endCursor }
  }
  options(first: 3) {
    id name
    optionValues { id name swatch { color } }
  }
  images(first: ${PAGE_SIZE}) {
    nodes { ${IMAGE_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
  variants(first: ${PAGE_SIZE}) {
    nodes { ${VARIANT_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
  metafields(identifiers: [
    { namespace: "kingbelt", key: "model_reference" }
    { namespace: "kingbelt", key: "summary" }
    { namespace: "kingbelt", key: "material" }
    { namespace: "kingbelt", key: "width_mm" }
    { namespace: "kingbelt", key: "buckle_finish" }
    { namespace: "kingbelt", key: "badge" }
    { namespace: "kingbelt", key: "color_galleries" }
  ]) {
    namespace key type value
    references(first: ${PAGE_SIZE}) {
      nodes {
        __typename
        ... on Metaobject {
          id type
          fields {
            key type value
            references(first: ${PAGE_SIZE}) {
              nodes {
                __typename
                ... on MediaImage { id image { ${IMAGE_FIELDS} } }
                ... on GenericFile { id url }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const CATALOG_PAGE_QUERY = `
  query KingBeltCatalogPage($first: Int!, $productsAfter: String, $collectionsAfter: String) {
    products(first: $first, after: $productsAfter, sortKey: TITLE) {
      nodes { ${PRODUCT_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
    collections(first: $first, after: $collectionsAfter, sortKey: TITLE) {
      nodes { id handle title description image { ${IMAGE_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCT_VARIANTS_PAGE_QUERY = `
  query KingBeltProductVariantsPage($id: ID!, $first: Int!, $after: String!) {
    node(id: $id) { ... on Product {
      variants(first: $first, after: $after) {
        nodes { ${VARIANT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const PRODUCT_IMAGES_PAGE_QUERY = `
  query KingBeltProductImagesPage($id: ID!, $first: Int!, $after: String!) {
    node(id: $id) { ... on Product {
      images(first: $first, after: $after) {
        nodes { ${IMAGE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const PRODUCT_COLLECTIONS_PAGE_QUERY = `
  query KingBeltProductCollectionsPage($id: ID!, $first: Int!, $after: String!) {
    node(id: $id) { ... on Product {
      collections(first: $first, after: $after) {
        nodes { id handle title }
        pageInfo { hasNextPage endCursor }
      }
    } }
  }
`;

const nextCursor = (pageInfo: PageInfo, label: string): string => {
  if (!pageInfo.endCursor) {
    throw new Error(`Shopify devolvió una página incompleta de ${label}: falta endCursor.`);
  }
  return pageInfo.endCursor;
};

const appendRemainingConnection = async <T>(
  initial: Connection<T>,
  label: string,
  loadPage: (after: string) => Promise<Connection<T>>
): Promise<T[]> => {
  const nodes = [...initial.nodes];
  let pageInfo = initial.pageInfo;
  while (pageInfo.hasNextPage) {
    const page = await loadPage(nextCursor(pageInfo, label));
    nodes.push(...page.nodes);
    pageInfo = page.pageInfo;
  }
  return nodes;
};

const completeProductConnections = async (
  gateway: ShopifyStorefrontGateway,
  product: ShopifyProductNode
): Promise<ShopifyProductNode> => {
  const needsVariants = product.variants.pageInfo.hasNextPage;
  const needsImages = product.images.pageInfo.hasNextPage;
  const needsCollections = product.collections.pageInfo.hasNextPage;
  if (!needsVariants && !needsImages && !needsCollections) return product;

  const variablesFor = (after: string) => ({ id: product.id, first: PAGE_SIZE, after });
  const [variants, images, collections] = await Promise.all([
    needsVariants
      ? appendRemainingConnection(
          product.variants,
          `variantes de ${product.handle}`,
          async (after) => {
            const data = await gateway.graphql<
              { node: { variants: Connection<ShopifyVariantNode> } | null },
              ReturnType<typeof variablesFor>
            >(PRODUCT_VARIANTS_PAGE_QUERY, variablesFor(after));
            if (!data.node) throw new Error(`Shopify dejó de devolver el producto ${product.handle} durante la paginación.`);
            return data.node.variants;
          }
        )
      : Promise.resolve(product.variants.nodes),
    needsImages
      ? appendRemainingConnection(
          product.images,
          `imágenes de ${product.handle}`,
          async (after) => {
            const data = await gateway.graphql<
              { node: { images: Connection<ShopifyImageNode> } | null },
              ReturnType<typeof variablesFor>
            >(PRODUCT_IMAGES_PAGE_QUERY, variablesFor(after));
            if (!data.node) throw new Error(`Shopify dejó de devolver el producto ${product.handle} durante la paginación.`);
            return data.node.images;
          }
        )
      : Promise.resolve(product.images.nodes),
    needsCollections
      ? appendRemainingConnection(
          product.collections,
          `colecciones de ${product.handle}`,
          async (after) => {
            const data = await gateway.graphql<{
              node: { collections: Connection<Pick<ShopifyCollectionNode, 'id' | 'handle' | 'title'>> } | null;
            }, ReturnType<typeof variablesFor>>(PRODUCT_COLLECTIONS_PAGE_QUERY, variablesFor(after));
            if (!data.node) throw new Error(`Shopify dejó de devolver el producto ${product.handle} durante la paginación.`);
            return data.node.collections;
          }
        )
      : Promise.resolve(product.collections.nodes),
  ]);
  const complete: PageInfo = { hasNextPage: false, endCursor: null };
  return {
    ...product,
    variants: { nodes: variants, pageInfo: complete },
    images: { nodes: images, pageInfo: complete },
    collections: { nodes: collections, pageInfo: complete },
  };
};

/** Obtiene el catálogo publicado completo; ningún cursor queda expuesto al dominio. */
export const fetchShopifyCatalog = async (
  gateway: ShopifyStorefrontGateway
): Promise<ShopifyCatalogPayload> => {
  const products: ShopifyProductNode[] = [];
  const collections: ShopifyCollectionNode[] = [];
  let productsAfter: string | null = null;
  let collectionsAfter: string | null = null;
  let productsDone = false;
  let collectionsDone = false;

  while (!productsDone || !collectionsDone) {
    const data = await gateway.graphql<{
      products: Connection<ShopifyProductNode>;
      collections: Connection<ShopifyCollectionNode>;
    }, { first: number; productsAfter: string | null; collectionsAfter: string | null }>(
      CATALOG_PAGE_QUERY,
      { first: PAGE_SIZE, productsAfter, collectionsAfter }
    );
    if (!productsDone) products.push(...data.products.nodes);
    if (!collectionsDone) collections.push(...data.collections.nodes);
    productsDone = productsDone || !data.products.pageInfo.hasNextPage;
    collectionsDone = collectionsDone || !data.collections.pageInfo.hasNextPage;
    if (!productsDone) productsAfter = nextCursor(data.products.pageInfo, 'productos');
    if (!collectionsDone) collectionsAfter = nextCursor(data.collections.pageInfo, 'colecciones');
  }

  return {
    products: await Promise.all(products.map((product) => completeProductConnections(gateway, product))),
    collections,
  };
};
