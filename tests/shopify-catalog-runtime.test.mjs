import { describe, expect, test } from 'bun:test';
import { createShopifyCatalogAdapter } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import { mapShopifyCatalog } from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import { createShopifyCatalogQueries } from '../src/commerce/infrastructure/shopify/catalog-runtime-query.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  ShopifyConfigurationError,
} from '../src/commerce/infrastructure/shopify/config.ts';
import { ShopifyStorefrontRequestError } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';
import {
  pageInfo,
  productSummaryNode,
  SHOPIFY_CATALOG_TEST_HOSTS as HOSTS,
  validShopifyCatalogPayload as validPayload,
} from './fixtures/shopify-catalog-payload.mjs';

const queryName = (query) => query.match(/query\s+(\w+)/)?.[1] ?? 'unknown';

const createRecordingGateway = (handler) => {
  const calls = [];
  return {
    calls,
    async graphql(query, variables) {
      calls.push({ name: queryName(query), query, variables });
      return handler(query, variables);
    },
  };
};

const extraSummary = (payload, { id, handle, title }) => {
  const node = productSummaryNode(payload.products[0]);
  return {
    ...node,
    id,
    handle,
    title,
    metafields: node.metafields.map((item) =>
      item?.key === 'model_reference' ? { ...item, value: handle.toUpperCase() } : item
    ),
  };
};

describe('consultas runtime Shopify por recurso', () => {
  test('getProductByHandle consulta un solo producto y no el catálogo completo', async () => {
    const payload = validPayload();
    const gateway = createRecordingGateway((query) => {
      expect(query).not.toContain('KingBeltCatalogPage');
      if (query.includes('KingBeltProductByHandle')) return { product: payload.products[0] };
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const product = await createShopifyCatalogQueries(gateway, HOSTS)
      .getProductByHandle('cinturon-atlas');
    expect(product?.handle).toBe('cinturon-atlas');
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0].name).toBe('KingBeltProductByHandle');
    expect(gateway.calls[0].query).toContain('product(handle:');
    expect(gateway.calls[0].query).toContain('variants(first:');
    expect(gateway.calls[0].query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(gateway.calls[0].variables.handle).toBe('cinturon-atlas');
    expect(gateway.calls[0].variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
    expect(gateway.calls[0].variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
  });

  test('getProductByHandle pagina variantes e imágenes del producto solicitado', async () => {
    const payload = validPayload();
    payload.products[0].options[1].optionValues.push({
      id: 'gid://shopify/ProductOptionValue/12',
      name: '100',
      swatch: null,
    });
    payload.products[0].variants.pageInfo = { hasNextPage: true, endCursor: 'variant-cursor' };
    payload.products[0].images.pageInfo = { hasNextPage: true, endCursor: 'image-cursor' };
    const extraVariant = {
      ...payload.products[0].variants.nodes[0],
      id: 'gid://shopify/ProductVariant/99',
      title: 'Cuero / 100',
      sku: 'KB-ATLAS-CU-100',
      selectedOptions: [
        { name: 'Color', value: 'Cuero' },
        { name: 'Talla', value: '100' },
      ],
    };
    const extraImage = {
      ...payload.products[0].images.nodes[0],
      id: 'gid://shopify/ProductImage/extra',
      url: 'https://cdn.shopify.com/s/files/extra.jpg',
      altText: 'Cinturón Atlas extra',
    };
    const gateway = createRecordingGateway((query) => {
      expect(query).not.toContain('KingBeltCatalogPage');
      if (query.includes('KingBeltProductByHandle')) return { product: payload.products[0] };
      if (query.includes('KingBeltProductVariantsPage')) {
        return { node: { variants: { nodes: [extraVariant], pageInfo } } };
      }
      if (query.includes('KingBeltProductImagesPage')) {
        return { node: { images: { nodes: [extraImage], pageInfo } } };
      }
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const product = await createShopifyCatalogQueries(gateway, HOSTS)
      .getProductByHandle('cinturon-atlas');
    expect(product?.variants.length).toBe(payload.products[0].variants.nodes.length + 1);
    expect(product?.images.length).toBe(payload.products[0].images.nodes.length + 1);
    expect(gateway.calls.map((call) => call.name).sort()).toEqual([
      'KingBeltProductByHandle',
      'KingBeltProductImagesPage',
      'KingBeltProductVariantsPage',
    ]);
  });

  test('un producto inexistente devuelve undefined', async () => {
    const gateway = createRecordingGateway((query) => {
      if (query.includes('KingBeltProductByHandle')) return { product: null };
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    await expect(createShopifyCatalogQueries(gateway, HOSTS).getProductByHandle('ausente'))
      .resolves.toBeUndefined();
  });

  test('un error de Storefront no se convierte en undefined ni catálogo vacío', async () => {
    const gateway = createRecordingGateway(() => {
      throw new ShopifyStorefrontRequestError('http', 'Shopify Storefront request failed with HTTP 500.', 500);
    });
    await expect(createShopifyCatalogQueries(gateway, HOSTS).getProductByHandle('cinturon-atlas'))
      .rejects.toBeInstanceOf(ShopifyStorefrontRequestError);
  });

  test('getCollectionByHandle no recupera variantes completas y pagina productos', async () => {
    const payload = validPayload();
    const first = productSummaryNode(payload.products[0]);
    const second = extraSummary(payload, {
      id: 'gid://shopify/Product/2',
      handle: 'cinturon-beta',
      title: 'Cinturón Beta',
    });
    const gateway = createRecordingGateway((query, variables) => {
      expect(query).not.toContain('variants(first:');
      expect(query).not.toContain('KingBeltCatalogPage');
      if (!query.includes('KingBeltCollectionByHandle')) {
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      }
      if (!variables.after) {
        return {
          collection: {
            ...payload.collections[0],
            products: {
              nodes: [first],
              pageInfo: { hasNextPage: true, endCursor: 'product-cursor' },
            },
          },
        };
      }
      expect(variables.after).toBe('product-cursor');
      return {
        collection: {
          ...payload.collections[0],
          products: { nodes: [second], pageInfo },
        },
      };
    });
    const page = await createShopifyCatalogAdapter(
      createShopifyCatalogQueries(gateway, HOSTS),
      { cacheTtlMs: 0 }
    ).getCollectionByHandle('sport');
    expect(page?.products.map((item) => item.handle)).toEqual(['cinturon-atlas', 'cinturon-beta']);
    expect(page?.facets.productTypes[0].value).toBe('Cinturón');
    expect(gateway.calls).toHaveLength(2);
  });

  test('una colección inexistente devuelve undefined', async () => {
    const gateway = createRecordingGateway((query) => {
      if (query.includes('KingBeltCollectionByHandle')) return { collection: null };
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    await expect(createShopifyCatalogQueries(gateway, HOSTS).getCollectionByHandle('missing'))
      .resolves.toBeUndefined();
  });

  test('los resúmenes omiten un producto sin primaria inequívoca y no tumban el listado', async () => {
    const payload = validPayload();
    const valid = productSummaryNode(payload.products[0]);
    const ambiguous = extraSummary(payload, {
      id: 'gid://shopify/Product/2',
      handle: 'cinturon-beta',
      title: 'Beta',
    });
    ambiguous.metafields = ambiguous.metafields.filter((item) => item?.key !== 'primary_collection');
    ambiguous.collections = {
      nodes: [
        { id: 'gid://shopify/Collection/1', handle: 'sport', title: 'Sport' },
        { id: 'gid://shopify/Collection/2', handle: 'casual', title: 'Casual' },
      ],
      pageInfo,
    };
    const uniqueWithoutMetafield = extraSummary(payload, {
      id: 'gid://shopify/Product/3',
      handle: 'cinturon-gamma',
      title: 'Gamma',
    });
    uniqueWithoutMetafield.metafields = uniqueWithoutMetafield.metafields.filter(
      (item) => item?.key !== 'primary_collection'
    );

    const gateway = createRecordingGateway((query) => {
      if (query.includes('KingBeltProductSummariesPage')) {
        return { products: { nodes: [valid, ambiguous, uniqueWithoutMetafield], pageInfo } };
      }
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const featured = await createShopifyCatalogQueries(gateway, HOSTS).getFeaturedProducts(4);
    expect(featured.map((item) => item.handle)).toEqual(['cinturon-atlas', 'cinturon-gamma']);
  });

  test('getProductSummaries no incluye la proyección de variantes completas', async () => {
    const payload = validPayload();
    const gateway = createRecordingGateway((query) => {
      expect(query).not.toContain('variants(first:');
      expect(query).not.toContain('weight weightUnit');
      expect(query).not.toContain('quantityRule');
      expect(query).not.toContain('color_galleries');
      expect(query).toContain('priceRange');
      if (query.includes('KingBeltProductSummariesPage')) {
        return { products: { nodes: [productSummaryNode(payload.products[0])], pageInfo } };
      }
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const summaries = await createShopifyCatalogQueries(gateway, HOSTS).getProductSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].reference).toBe('ATLAS-35');
    expect(summaries[0].primaryCollection.handle).toBe('sport');
  });

  test('getCollections no descarga productos asociados', async () => {
    const payload = validPayload();
    const gateway = createRecordingGateway((query) => {
      expect(query).not.toContain('products(');
      if (query.includes('KingBeltCollectionsPage')) {
        return { collections: { nodes: payload.collections, pageInfo } };
      }
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const collections = await createShopifyCatalogQueries(gateway, HOSTS).getCollections();
    expect(collections).toHaveLength(1);
    expect(collections[0].handle).toBe('sport');
  });

  test('getProductHandles y getCollectionHandles usan proyecciones ligeras', async () => {
    const gateway = createRecordingGateway((query) => {
      expect(query).not.toContain('variants(');
      expect(query).not.toContain('featuredImage');
      expect(query).not.toContain('metafields(');
      if (query.includes('KingBeltProductHandlesPage')) {
        return { products: { nodes: [{ handle: 'cinturon-atlas' }], pageInfo } };
      }
      if (query.includes('KingBeltCollectionHandlesPage')) {
        return { collections: { nodes: [{ handle: 'sport' }], pageInfo } };
      }
      throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
    });
    const runtime = createShopifyCatalogQueries(gateway, HOSTS);
    expect(await runtime.getProductHandles()).toEqual(['cinturon-atlas']);
    expect(await runtime.getCollectionHandles()).toEqual(['sport']);
    expect(gateway.calls.map((call) => call.name)).toEqual([
      'KingBeltProductHandlesPage',
      'KingBeltCollectionHandlesPage',
    ]);
  });

  test('getFeaturedProducts(0) no llama a Shopify y un límite pequeño no descarga el catálogo', async () => {
    let featuredCalls = 0;
    const adapter = createShopifyCatalogAdapter({
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductByHandle() { return undefined; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts(limit) {
        featuredCalls += 1;
        expect(limit).toBe(4);
        return [];
      },
      async getRelatedProducts() { return []; },
    });
    expect(await adapter.getFeaturedProducts(0)).toEqual([]);
    expect(featuredCalls).toBe(0);

    const payload = validPayload();
    const gateway = createRecordingGateway((query, variables) => {
      expect(query).not.toContain('KingBeltCatalogPage');
      expect(query).not.toContain('variants(first:');
      expect(variables.first).toBe(4);
      return { products: { nodes: [productSummaryNode(payload.products[0])], pageInfo } };
    });
    const featured = await createShopifyCatalogQueries(gateway, HOSTS).getFeaturedProducts(4);
    expect(featured).toHaveLength(1);
    expect(gateway.calls).toHaveLength(1);
  });

  test('getRelatedProducts excluye, deduplica, respeta el límite y no produce N+1', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const product = catalog.products[0];
    const payload = validPayload();
    const relatedA = extraSummary(payload, {
      id: 'gid://shopify/Product/2',
      handle: 'cinturon-beta',
      title: 'Beta',
    });
    const relatedB = extraSummary(payload, {
      id: 'gid://shopify/Product/3',
      handle: 'cinturon-gamma',
      title: 'Gamma',
    });
    const gateway = createRecordingGateway((query, variables) => {
      expect(query).toContain('KingBeltRelatedProducts');
      expect(query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
      expect(query).not.toContain('variants(first:');
      return {
        c0: {
          products: {
            nodes: [productSummaryNode(payload.products[0]), relatedA, relatedA, relatedB],
            pageInfo,
          },
        },
        c1: {
          products: {
            nodes: [relatedB],
            pageInfo,
          },
        },
      };
    });
    const runtime = createShopifyCatalogQueries(gateway, HOSTS);
    const related = await runtime.getRelatedProducts(
      { ...product, collectionIds: [...product.collectionIds, 'gid://shopify/Collection/2'] },
      2
    );
    expect(related.map((item) => item.handle)).toEqual(['cinturon-beta', 'cinturon-gamma']);
    expect(related).toHaveLength(2);
    expect(related.every((item) => item.handle !== product.handle)).toBe(true);
    expect(gateway.calls).toHaveLength(1);
  });
});

describe('caché granular del catálogo Shopify', () => {
  test('dos llamadas simultáneas al mismo recurso deduplican el request', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    let loads = 0;
    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    const adapter = createShopifyCatalogAdapter({
      async getProductByHandle() {
        loads += 1;
        await barrier;
        return catalog.products[0];
      },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    });
    const pending = Promise.all([
      adapter.getProductByHandle('cinturon-atlas'),
      adapter.getProductByHandle('cinturon-atlas'),
    ]);
    release();
    const [first, second] = await pending;
    expect(loads).toBe(1);
    expect(first?.handle).toBe('cinturon-atlas');
    expect(second?.handle).toBe('cinturon-atlas');
  });

  test('los caches de dos handles distintos son independientes', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const handles = [];
    const adapter = createShopifyCatalogAdapter({
      async getProductByHandle(handle) {
        handles.push(handle);
        return handle === 'cinturon-atlas' ? catalog.products[0] : undefined;
      },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    });
    await Promise.all([
      adapter.getProductByHandle('cinturon-atlas'),
      adapter.getProductByHandle('otro'),
    ]);
    expect(handles.sort()).toEqual(['cinturon-atlas', 'otro']);
  });

  test('expirado el TTL se vuelve a consultar', async () => {
    let loads = 0;
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() {
        loads += 1;
        return ['cinturon-atlas'];
      },
      async getProductByHandle() { return undefined; },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    }, { cacheTtlMs: 0 });
    await adapter.getProductHandles();
    await adapter.getProductHandles();
    expect(loads).toBe(2);
  });

  test('stale-if-error solo reutiliza el mismo recurso y no oculta configuración', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    let atlasLoads = 0;
    const adapter = createShopifyCatalogAdapter({
      async getProductByHandle(handle) {
        if (handle !== 'cinturon-atlas') {
          throw new Error('storefront_down');
        }
        atlasLoads += 1;
        if (atlasLoads > 1) throw new Error('storefront_down');
        return catalog.products[0];
      },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    }, { cacheTtlMs: 0 });
    await expect(adapter.getProductByHandle('cinturon-atlas')).resolves.toBeTruthy();
    await expect(adapter.getProductByHandle('cinturon-atlas')).resolves.toBeTruthy();
    await expect(adapter.getProductByHandle('otro')).rejects.toThrow('storefront_down');

    const configAdapter = createShopifyCatalogAdapter({
      async getProductByHandle() {
        throw new ShopifyConfigurationError('Missing required Shopify configuration: SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
      },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    });
    await expect(configAdapter.getProductByHandle('cinturon-atlas'))
      .rejects.toBeInstanceOf(ShopifyConfigurationError);
  });

  test('errores de configuración no se ocultan mediante stale cache', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter({
      async getProductByHandle() {
        loads += 1;
        if (loads > 1) {
          throw new ShopifyConfigurationError('Missing required Shopify configuration: SHOPIFY_STOREFRONT_PRIVATE_TOKEN');
        }
        return catalog.products[0];
      },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getCollectionByHandle() { return undefined; },
      async getProductHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    }, { cacheTtlMs: 0 });
    await adapter.getProductByHandle('cinturon-atlas');
    await expect(adapter.getProductByHandle('cinturon-atlas'))
      .rejects.toBeInstanceOf(ShopifyConfigurationError);
  });
});
