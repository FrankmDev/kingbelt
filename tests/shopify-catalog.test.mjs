import { describe, expect, test } from 'bun:test';
import { createShopifyCatalogAdapter } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import {
  mapShopifyCatalog,
  ShopifyCatalogMappingError,
} from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import { fetchShopifyCatalog } from '../src/commerce/infrastructure/shopify/catalog-query.ts';

const pageInfo = { hasNextPage: false, endCursor: null };
const image = (position) => ({
  id: `gid://shopify/ProductImage/${position}`,
  url: `https://cdn.shopify.com/s/files/product-${position}.jpg`,
  altText: `Cinturón Atlas, vista ${position}`,
  width: 1200,
  height: 1500,
});

const metafield = (key, type, value) => ({
  namespace: 'kingbelt',
  key,
  type,
  value,
  references: null,
});

const validPayload = () => {
  const images = [image(1), image(2), image(3)];
  return {
    collections: [{
      id: 'gid://shopify/Collection/1',
      handle: 'sport',
      title: 'Sport',
      description: 'Cinturones de piel para uso diario.',
      image: null,
    }],
    products: [{
      id: 'gid://shopify/Product/1',
      handle: 'cinturon-atlas',
      title: 'Cinturón Atlas',
      description: 'Cinturón de piel confeccionado en España.',
      vendor: 'KingBelt',
      productType: 'Cinturón',
      publishedAt: '2026-08-18T00:00:00Z',
      category: { id: 'gid://shopify/TaxonomyCategory/aa-2-6', name: 'Cinturones' },
      seo: { title: 'Cinturón Atlas', description: 'Cinturón de piel Atlas.' },
      featuredImage: images[0],
      collections: {
        nodes: [{ id: 'gid://shopify/Collection/1', handle: 'sport', title: 'Sport' }],
        pageInfo,
      },
      options: [{
        id: 'gid://shopify/ProductOption/1',
        name: 'Color',
        optionValues: [{
          id: 'gid://shopify/ProductOptionValue/1',
          name: 'Negro',
          swatch: { color: '#111111' },
        }],
      }],
      images: { nodes: images, pageInfo },
      variants: {
        nodes: [{
          id: 'gid://shopify/ProductVariant/1',
          title: 'Negro',
          sku: 'KB-ATLAS-NE',
          availableForSale: true,
          currentlyNotInStock: false,
          selectedOptions: [{ name: 'Color', value: 'Negro' }],
          price: { amount: '59.90', currencyCode: 'EUR' },
          compareAtPrice: null,
          quantityRule: { minimum: 1, increment: 1, maximum: null },
          image: images[0],
          weight: 0,
          weightUnit: 'GRAMS',
        }],
        pageInfo,
      },
      metafields: [
        metafield('model_reference', 'single_line_text_field', 'ATLAS-35'),
        metafield('summary', 'multi_line_text_field', 'Piel y construcción artesanal.'),
        metafield('material', 'single_line_text_field', 'Piel'),
        metafield('width_mm', 'number_integer', '35'),
        metafield('buckle_finish', 'single_line_text_field', 'Níquel satinado'),
        null,
        {
          namespace: 'kingbelt',
          key: 'color_galleries',
          type: 'list.metaobject_reference',
          value: '["gid://shopify/Metaobject/1"]',
          references: {
            nodes: [{
              __typename: 'Metaobject',
              id: 'gid://shopify/Metaobject/1',
              type: 'kingbelt.color_gallery',
              fields: [
                {
                  key: 'color_value',
                  type: 'single_line_text_field',
                  value: 'Negro',
                  references: null,
                },
                {
                  key: 'images',
                  type: 'list.file_reference',
                  value: null,
                  references: {
                    nodes: images.map((item) => ({
                      __typename: 'MediaImage',
                      id: `gid://shopify/MediaImage/${item.id.at(-1)}`,
                      image: item,
                    })),
                    pageInfo,
                  },
                },
              ],
            }],
            pageInfo,
          },
        },
      ],
    }],
  };
};

describe('catálogo Shopify', () => {
  test('normaliza un catálogo completo al dominio neutral', () => {
    const catalog = mapShopifyCatalog(validPayload(), ['cdn.shopify.com']);
    expect(catalog.products[0].reference).toBe('ATLAS-35');
    expect(catalog.products[0].variants[0].price.amountMinor).toBe(5990);
    expect(catalog.products[0].mediaGroups[0].imageIds).toHaveLength(3);
    expect(catalog.products[0].options[0].purpose).toBe('color');
  });

  test('normaliza un catálogo nativo sin metafields KingBelt', () => {
    const payload = validPayload();
    payload.collections[0].description = '';
    payload.products[0].metafields = [];
    payload.products[0].images.nodes.forEach((image) => {
      image.altText = null;
    });
    payload.products[0].variants.nodes[0].sku = null;
    const catalog = mapShopifyCatalog(payload, ['cdn.shopify.com']);
    expect(catalog.collections[0].description).toBe('Sport');
    expect(catalog.products[0].reference).toBe('cinturon-atlas');
    expect(catalog.products[0].summary).toBe(payload.products[0].description);
    expect(catalog.products[0].specifications).toEqual([]);
    expect(catalog.products[0].images[0].altText).toBe('Cinturón Atlas');
    expect(catalog.products[0].variants[0].sku).toBe('cinturon-atlas:gid://shopify/ProductVariant/1');
    expect(catalog.products[0].mediaGroups[0].imageIds.length).toBeGreaterThanOrEqual(1);
  });

  test('falla con contexto cuando un metafield publicado tiene un tipo incorrecto', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.map((item) =>
      item?.key === 'model_reference' ? { ...item, type: 'number_integer' } : item
    );
    expect(() => mapShopifyCatalog(payload, ['cdn.shopify.com']))
      .toThrow(ShopifyCatalogMappingError);
    expect(() => mapShopifyCatalog(payload, ['cdn.shopify.com']))
      .toThrow('metafields.kingbelt.model_reference');
  });

  test('el adapter carga una sola vez y deriva listados sin tipos Shopify', async () => {
    const catalog = mapShopifyCatalog(validPayload(), ['cdn.shopify.com']);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter(async () => {
      loads += 1;
      return catalog;
    });
    const [handles, product, collection] = await Promise.all([
      adapter.getProductHandles(),
      adapter.getProductByHandle('cinturon-atlas'),
      adapter.getCollectionByHandle('sport'),
    ]);
    expect(loads).toBe(1);
    expect(handles).toEqual(['cinturon-atlas']);
    expect(product?.vendor).toBe('KingBelt');
    expect(collection?.products[0].reference).toBe('ATLAS-35');
  });

  test('el adapter vuelve a cargar el catálogo cuando expira la caché de desarrollo', async () => {
    const catalog = mapShopifyCatalog(validPayload(), ['cdn.shopify.com']);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter(async () => {
      loads += 1;
      return catalog;
    }, { cacheTtlMs: 0 });
    await adapter.getProductHandles();
    await adapter.getProductByHandle('cinturon-atlas');
    expect(loads).toBe(2);
  });

  test('el adapter sirve el último catálogo válido si Shopify falla (stale-if-error)', async () => {
    const catalog = mapShopifyCatalog(validPayload(), ['cdn.shopify.com']);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter(async () => {
      loads += 1;
      if (loads > 1) throw new Error('storefront_down');
      return catalog;
    }, { cacheTtlMs: 0 });
    await adapter.getProductHandles();
    await expect(adapter.getProductByHandle('cinturon-atlas')).resolves.toBeTruthy();
    await expect(adapter.getCollections()).resolves.toHaveLength(1);
    expect(loads).toBe(3);
  });

  test('el adapter falla cerrado sin catálogo previo', async () => {
    const adapter = createShopifyCatalogAdapter(async () => {
      throw new Error('storefront_down');
    }, { cacheTtlMs: 0 });
    await expect(adapter.getProductHandles()).rejects.toThrow('storefront_down');
  });

  test('pagina productos y colecciones con cursores internos', async () => {
    const payload = validPayload();
    const calls = [];
    const gateway = {
      async graphql(query, variables) {
        calls.push({ query, variables });
        const second = variables.productsAfter === 'product-cursor';
        return {
          products: {
            nodes: second ? [] : payload.products,
            pageInfo: second
              ? { hasNextPage: false, endCursor: null }
              : { hasNextPage: true, endCursor: 'product-cursor' },
          },
          collections: {
            nodes: second ? [] : payload.collections,
            pageInfo: second
              ? { hasNextPage: false, endCursor: null }
              : { hasNextPage: true, endCursor: 'collection-cursor' },
          },
        };
      },
    };
    const result = await fetchShopifyCatalog(gateway);
    expect(result.products).toHaveLength(1);
    expect(result.collections).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].variables).toEqual({
      first: 250,
      productsAfter: null,
      collectionsAfter: null,
    });
    expect(calls[1].variables).toEqual({
      first: 250,
      productsAfter: 'product-cursor',
      collectionsAfter: 'collection-cursor',
    });
    expect(calls[0].query).toContain('metafields(identifiers:');
  });
});
