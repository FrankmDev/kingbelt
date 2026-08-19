import { describe, expect, test } from 'bun:test';
import { CatalogValidationError } from '../src/commerce/application/catalog-validation.ts';
import { createShopifyCatalogAdapter } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import { ShopifyConfigurationError } from '../src/commerce/infrastructure/shopify/config.ts';
import {
  mapShopifyCatalog,
  ShopifyCatalogMappingError,
} from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import { fetchShopifyCatalog } from '../src/commerce/infrastructure/shopify/catalog-query.ts';

const pageInfo = { hasNextPage: false, endCursor: null };
const HOSTS = ['cdn.shopify.com'];
const COLORS = [
  { id: '1', name: 'Cuero' },
  { id: '2', name: 'Marrón' },
  { id: '3', name: 'Negro' },
];
const SIZES = [
  { id: '10', name: '90' },
  { id: '11', name: '95' },
];

const image = (id) => ({
  id: `gid://shopify/ProductImage/${id}`,
  url: `https://cdn.shopify.com/s/files/${id}.jpg`,
  altText: `Cinturón Atlas, ${id}`,
  width: 1200,
  height: 1500,
});

const colorImages = (colorName) => {
  const slug = colorName.toLocaleLowerCase('es');
  return [image(`${slug}-1`), image(`${slug}-2`), image(`${slug}-3`)];
};

const metafield = (key, type, value) => ({
  namespace: 'kingbelt',
  key,
  type,
  value,
  references: null,
});

const mediaImage = (productImage) => ({
  __typename: 'MediaImage',
  id: `gid://shopify/MediaImage/${productImage.id}`,
  image: productImage,
});

const colorGallery = (color, images, type = 'color_gallery') => ({
  __typename: 'Metaobject',
  id: `gid://shopify/Metaobject/${color.id}`,
  type,
  fields: [
    {
      key: 'color_value',
      type: 'single_line_text_field',
      value: color.name,
      references: null,
    },
    {
      key: 'images',
      type: 'list.file_reference',
      value: null,
      references: {
        nodes: images.map(mediaImage),
        pageInfo,
      },
    },
  ],
});

const colorGalleriesMetafield = (references) => ({
  namespace: 'kingbelt',
  key: 'color_galleries',
  type: 'list.metaobject_reference',
  value: JSON.stringify(references.map((item) => item.id)),
  references: { nodes: references, pageInfo },
});

const kingbeltMetafields = (galleries) => [
  metafield('model_reference', 'single_line_text_field', 'ATLAS-35'),
  metafield('summary', 'multi_line_text_field', 'Piel y construcción artesanal.'),
  metafield('material', 'single_line_text_field', 'Piel'),
  metafield('width_mm', 'number_integer', '35'),
  metafield('buckle_finish', 'single_line_text_field', 'Níquel satinado'),
  null,
  colorGalleriesMetafield(galleries),
];

const variant = ({ id, color, size, sku, image: variantImage }) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: `${color} / ${size}`,
  sku,
  availableForSale: true,
  currentlyNotInStock: false,
  selectedOptions: [
    { name: 'Color', value: color },
    { name: 'Talla', value: size },
  ],
  price: { amount: '59.90', currencyCode: 'EUR' },
  compareAtPrice: null,
  quantityRule: { minimum: 1, increment: 1, maximum: null },
  image: variantImage,
  weight: 0,
  weightUnit: 'GRAMS',
});

const validPayload = ({ galleryOrder = COLORS } = {}) => {
  const imagesByColor = new Map(COLORS.map((color) => [color.name, colorImages(color.name)]));
  const allImages = COLORS.flatMap((color) => imagesByColor.get(color.name));
  const galleries = galleryOrder.map((color) => colorGallery(color, imagesByColor.get(color.name)));
  const variants = COLORS.flatMap((color, colorIndex) =>
    SIZES.map((size, sizeIndex) => variant({
      id: String(colorIndex * SIZES.length + sizeIndex + 1),
      color: color.name,
      size: size.name,
      sku: `KB-ATLAS-${color.name.slice(0, 2).toUpperCase()}-${size.name}`,
      image: imagesByColor.get(color.name)[0],
    }))
  );

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
      featuredImage: allImages[0],
      collections: {
        nodes: [{ id: 'gid://shopify/Collection/1', handle: 'sport', title: 'Sport' }],
        pageInfo,
      },
      options: [
        {
          id: 'gid://shopify/ProductOption/1',
          name: 'Color',
          optionValues: COLORS.map((color) => ({
            id: `gid://shopify/ProductOptionValue/${color.id}`,
            name: color.name,
            swatch: { color: '#111111' },
          })),
        },
        {
          id: 'gid://shopify/ProductOption/2',
          name: 'Talla',
          optionValues: SIZES.map((size) => ({
            id: `gid://shopify/ProductOptionValue/${size.id}`,
            name: size.name,
            swatch: null,
          })),
        },
      ],
      images: { nodes: allImages, pageInfo },
      variants: { nodes: variants, pageInfo },
      metafields: kingbeltMetafields(galleries),
    }],
  };
};

const productWithoutColorPayload = () => {
  const images = [image('unica-1')];
  return {
    collections: [{
      id: 'gid://shopify/Collection/1',
      handle: 'sport',
      title: 'Sport',
      description: 'Cinturones de piel para uso diario.',
      image: null,
    }],
    products: [{
      id: 'gid://shopify/Product/2',
      handle: 'cinturon-unico',
      title: 'Cinturón Único',
      description: 'Cinturón de piel confeccionado en España.',
      vendor: 'KingBelt',
      productType: 'Cinturón',
      publishedAt: '2026-08-18T00:00:00Z',
      category: { id: 'gid://shopify/TaxonomyCategory/aa-2-6', name: 'Cinturones' },
      seo: { title: 'Cinturón Único', description: 'Cinturón de una sola talla.' },
      featuredImage: images[0],
      collections: {
        nodes: [{ id: 'gid://shopify/Collection/1', handle: 'sport', title: 'Sport' }],
        pageInfo,
      },
      options: [{
        id: 'gid://shopify/ProductOption/9',
        name: 'Talla',
        optionValues: [{
          id: 'gid://shopify/ProductOptionValue/90',
          name: '95',
          swatch: null,
        }],
      }],
      images: { nodes: images, pageInfo },
      variants: {
        nodes: [{
          id: 'gid://shopify/ProductVariant/90',
          title: '95',
          sku: 'KB-UNICO-95',
          availableForSale: true,
          currentlyNotInStock: false,
          selectedOptions: [{ name: 'Talla', value: '95' }],
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
        metafield('model_reference', 'single_line_text_field', 'UNICO-35'),
        metafield('summary', 'multi_line_text_field', 'Pieza de talla única.'),
      ],
    }],
  };
};

const galleriesOf = (payload) =>
  payload.products[0].metafields.find((item) => item?.key === 'color_galleries');

const expectMappingError = (payload, fragment) => {
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(fragment);
};

describe('catálogo Shopify', () => {
  test('normaliza un catálogo completo al dominio neutral', () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const product = catalog.products[0];
    expect(product.reference).toBe('ATLAS-35');
    expect(product.variants[0].price.amountMinor).toBe(5990);
    expect(product.options[0].purpose).toBe('color');
    expect(product.mediaGroups.map((group) => group.optionValueId)).toEqual(
      product.options[0].values.map((value) => value.id)
    );
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      colorImages('Cuero').map((item) => item.id),
      colorImages('Marrón').map((item) => item.id),
      colorImages('Negro').map((item) => item.id),
    ]);
    expect(product.primaryImageId).toBe(colorImages('Cuero')[0].id);
    product.variants.forEach((item) => {
      const colorId = item.optionValues.find((selection) =>
        selection.optionId === product.options[0].id
      )?.valueId;
      const cover = product.mediaGroups.find((group) => group.optionValueId === colorId)?.imageIds[0];
      expect(item.imageId).toBe(cover);
    });
  });

  test('conserva fallbacks nativos de copy y SKU sin inferir galerías', () => {
    const payload = validPayload();
    payload.collections[0].description = '';
    payload.products[0].metafields = [galleriesOf(payload)];
    payload.products[0].images.nodes.forEach((item) => {
      item.altText = null;
    });
    payload.products[0].variants.nodes.forEach((item) => {
      item.sku = null;
    });
    const catalog = mapShopifyCatalog(payload, HOSTS);
    expect(catalog.collections[0].description).toBe('Sport');
    expect(catalog.products[0].reference).toBe('cinturon-atlas');
    expect(catalog.products[0].summary).toBe(payload.products[0].description);
    expect(catalog.products[0].specifications).toEqual([]);
    expect(catalog.products[0].images[0].altText).toBe('Cinturón Atlas');
    expect(catalog.products[0].variants[0].sku).toBe('cinturon-atlas:gid://shopify/ProductVariant/1');
    expect(catalog.products[0].mediaGroups).toHaveLength(3);
    expect(catalog.products[0].mediaGroups[0].imageIds).toHaveLength(3);
  });

  test('un producto sin opción Color no exige color_galleries y conserva imagen principal', () => {
    const catalog = mapShopifyCatalog(productWithoutColorPayload(), HOSTS);
    const product = catalog.products[0];
    expect(product.options.some((option) => option.purpose === 'color')).toBe(false);
    expect(product.mediaGroups).toEqual([]);
    expect(product.primaryImageId).toBe(image('unica-1').id);
    expect(product.variants[0].imageId).toBe(image('unica-1').id);
  });

  test('ordena mediaGroups según la opción Color aunque las referencias vengan en otro orden', () => {
    const catalog = mapShopifyCatalog(validPayload({
      galleryOrder: [COLORS[2], COLORS[0], COLORS[1]],
    }), HOSTS);
    expect(catalog.products[0].mediaGroups.map((group) => group.optionValueId)).toEqual(
      catalog.products[0].options[0].values.map((value) => value.id)
    );
    expect(catalog.products[0].primaryImageId).toBe(colorImages('Cuero')[0].id);
  });

  test('usa la portada nativa y detalles cuyo archivo nombra el color si falta kingbelt.color_galleries', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== 'color_galleries'
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      colorImages('Cuero').map((item) => item.id),
      colorImages('Marrón').map((item) => item.id),
      colorImages('Negro').map((item) => item.id),
    ]);
    expect(product.primaryImageId).toBe(colorImages('Cuero')[0].id);
  });

  test('usa la portada nativa y detalles inequívocos si color_galleries está vacío', () => {
    const payload = validPayload();
    const metafieldNode = galleriesOf(payload);
    metafieldNode.value = '[]';
    metafieldNode.references = { nodes: [], pageInfo };
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      colorImages('Cuero').map((item) => item.id),
      colorImages('Marrón').map((item) => item.id),
      colorImages('Negro').map((item) => item.id),
    ]);
  });

  test('el fallback nativo ignora detalles sin token de color o con más de un color', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== 'color_galleries'
    );
    payload.products[0].images.nodes = [
      image('cuero-1'),
      image('detalle-comun'),
      image('cuero-marron-extra'),
      image('marron-1'),
      image('negro-1'),
    ];
    payload.products[0].featuredImage = image('cuero-1');
    const coverByColor = { Cuero: 'cuero-1', Marrón: 'marron-1', Negro: 'negro-1' };
    payload.products[0].variants.nodes.forEach((item) => {
      item.image = image(coverByColor[item.selectedOptions[0].value]);
    });
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      [image('cuero-1').id],
      [image('marron-1').id],
      [image('negro-1').id],
    ]);
  });

  test('el fallback nativo conserva el orden de Product.images y no mezcla portadas ajenas', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== 'color_galleries'
    );
    payload.products[0].images.nodes = [
      colorImages('Cuero')[0],
      colorImages('Marrón')[0],
      colorImages('Negro')[0],
      colorImages('Cuero')[2],
      colorImages('Cuero')[1],
      colorImages('Marrón')[1],
      colorImages('Negro')[2],
      colorImages('Marrón')[2],
      colorImages('Negro')[1],
    ];
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      [colorImages('Cuero')[0].id, colorImages('Cuero')[2].id, colorImages('Cuero')[1].id],
      [colorImages('Marrón')[0].id, colorImages('Marrón')[1].id, colorImages('Marrón')[2].id],
      [colorImages('Negro')[0].id, colorImages('Negro')[2].id, colorImages('Negro')[1].id],
    ]);
  });

  test('falla si falta la galería de un color', () => {
    const payload = validPayload();
    const metafieldNode = galleriesOf(payload);
    metafieldNode.references.nodes = metafieldNode.references.nodes.filter((item) =>
      item.fields.find((field) => field.key === 'color_value')?.value !== 'Marrón'
    );
    expectMappingError(payload, 'el color Marrón no tiene una galería asociada');
  });

  test('falla si existe un color extra en color_galleries', () => {
    const payload = validPayload();
    const extra = colorGallery({ id: '99', name: 'Verde' }, colorImages('Verde'));
    galleriesOf(payload).references.nodes.push(extra);
    payload.products[0].images.nodes.push(...colorImages('Verde'));
    expectMappingError(payload, 'el color Verde no existe en la opción Color');
  });

  test('falla si un color tiene dos metaobjects de galería', () => {
    const payload = validPayload();
    const duplicate = colorGallery({ id: '22', name: 'Marrón' }, colorImages('Marrón'));
    galleriesOf(payload).references.nodes.push(duplicate);
    expectMappingError(payload, 'el color Marrón tiene más de una galería');
  });

  test('falla si color_value está vacío', () => {
    const payload = validPayload();
    galleriesOf(payload).references.nodes[1].fields.find((field) => field.key === 'color_value').value = '   ';
    expectMappingError(payload, 'color_value.value');
  });

  test('falla si una galería tiene dos imágenes', () => {
    const payload = validPayload();
    const gallery = galleriesOf(payload).references.nodes[0];
    const imagesField = gallery.fields.find((field) => field.key === 'images');
    imagesField.references.nodes = imagesField.references.nodes.slice(0, 2);
    expectMappingError(payload, 'debe contener exactamente 3 imágenes');
  });

  test('falla si una galería tiene cuatro imágenes', () => {
    const payload = validPayload();
    const extra = image('cuero-4');
    payload.products[0].images.nodes.push(extra);
    const gallery = galleriesOf(payload).references.nodes[0];
    const imagesField = gallery.fields.find((field) => field.key === 'images');
    imagesField.references.nodes.push(mediaImage(extra));
    expectMappingError(payload, 'debe contener exactamente 3 imágenes');
  });

  test('falla si una galería repite una imagen', () => {
    const payload = validPayload();
    const gallery = galleriesOf(payload).references.nodes[0];
    const imagesField = gallery.fields.find((field) => field.key === 'images');
    imagesField.references.nodes[1] = imagesField.references.nodes[0];
    expectMappingError(payload, 'está repetida en la galería');
  });

  test('falla si una referencia de images no es MediaImage', () => {
    const payload = validPayload();
    const gallery = galleriesOf(payload).references.nodes[0];
    const imagesField = gallery.fields.find((field) => field.key === 'images');
    imagesField.references.nodes[0] = {
      __typename: 'GenericFile',
      id: 'gid://shopify/GenericFile/1',
      url: 'https://cdn.shopify.com/s/files/nota.pdf',
    };
    expectMappingError(payload, 'la referencia no es una MediaImage publicada');
  });

  test('acepta el identificador real del tipo de metaobject configurado en Shopify', () => {
    const payload = validPayload();
    galleriesOf(payload).references.nodes[0].type = 'kingbelt_color_gallery';
    expect(mapShopifyCatalog(payload, HOSTS).products[0].mediaGroups).toHaveLength(3);
  });

  test('el fallback falla si las variantes de un color no comparten imagen principal', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== 'color_galleries'
    );
    payload.products[0].variants.nodes[1].image = colorImages('Marrón')[0];
    expectMappingError(payload, 'no comparten una única imagen principal');
  });

  test('el fallback falla si la imagen nativa del color no pertenece al producto', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== 'color_galleries'
    );
    const foreign = image('ajena-nativa');
    payload.products[0].variants.nodes
      .filter((item) => item.selectedOptions[0].value === 'Cuero')
      .forEach((item) => { item.image = foreign; });
    expectMappingError(payload, 'no pertenece a las imágenes del producto');
  });

  test('el validador rechaza una imagen de galería que no pertenece al producto', () => {
    const payload = validPayload();
    const foreign = image('ajena-1');
    const gallery = galleriesOf(payload).references.nodes[0];
    const imagesField = gallery.fields.find((field) => field.key === 'images');
    imagesField.references.nodes[2] = mediaImage(foreign);
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('se esperaba un catálogo inválido');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues.map((issue) => issue.code)).toContain('media_group_unknown_image');
    }
  });

  test('falla si una variante con Color no tiene imagen', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = null;
    expectMappingError(payload, 'la variante debe tener asignada la imagen principal de su color');
  });

  test('falla si una variante apunta a la imagen de otro color', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = colorImages('Marrón')[0];
    expectMappingError(payload, 'no coincide con la portada de su galería de color');
  });

  test('falla si una variante usa la segunda o tercera imagen como portada', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = colorImages('Cuero')[1];
    expectMappingError(payload, 'no coincide con la portada de su galería de color');
  });

  test('falla con contexto cuando un metafield publicado tiene un tipo incorrecto', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.map((item) =>
      item?.key === 'model_reference' ? { ...item, type: 'number_integer' } : item
    );
    expectMappingError(payload, 'metafields.kingbelt.model_reference');
  });

  test('el adapter carga una sola vez y deriva listados sin tipos Shopify', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
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
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
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
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
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

  test('el adapter no tumba las páginas SSR por una configuración Shopify inválida', async () => {
    const adapter = createShopifyCatalogAdapter(async () => {
      throw new ShopifyConfigurationError(
        'SHOPIFY_STORE_DOMAIN must be a hostname like shop-name.myshopify.com, without protocol, path, query, fragment, credentials, or port.'
      );
    });
    await expect(adapter.getProductHandles()).resolves.toEqual([]);
    await expect(adapter.getCollections()).resolves.toEqual([]);
    await expect(adapter.getFeaturedProducts(4)).resolves.toEqual([]);
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

  test('completa variantes, imágenes y colecciones de un producto en paralelo', async () => {
    const payload = validPayload();
    payload.products[0].variants.pageInfo = { hasNextPage: true, endCursor: 'variant-cursor' };
    payload.products[0].images.pageInfo = { hasNextPage: true, endCursor: 'image-cursor' };
    payload.products[0].collections.pageInfo = { hasNextPage: true, endCursor: 'collection-cursor' };
    const extraVariant = payload.products[0].variants.nodes[0];
    const extraImage = payload.products[0].images.nodes[0];
    const extraCollection = payload.products[0].collections.nodes[0];
    const started = [];
    const gateway = {
      async graphql(query, variables) {
        started.push(query.includes('KingBeltCatalogPage') ? 'catalog' : variables.after);
        if (query.includes('KingBeltCatalogPage')) {
          return {
            products: { nodes: payload.products, pageInfo },
            collections: { nodes: payload.collections, pageInfo },
          };
        }
        await Promise.resolve();
        if (query.includes('KingBeltProductVariantsPage')) {
          return { node: { variants: { nodes: [extraVariant], pageInfo } } };
        }
        if (query.includes('KingBeltProductImagesPage')) {
          return { node: { images: { nodes: [extraImage], pageInfo } } };
        }
        if (query.includes('KingBeltProductCollectionsPage')) {
          return { node: { collections: { nodes: [extraCollection], pageInfo } } };
        }
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      },
    };
    const result = await fetchShopifyCatalog(gateway);
    expect(result.products[0].variants.nodes).toHaveLength(payload.products[0].variants.nodes.length + 1);
    expect(result.products[0].images.nodes).toHaveLength(payload.products[0].images.nodes.length + 1);
    expect(result.products[0].collections.nodes).toHaveLength(payload.products[0].collections.nodes.length + 1);
    expect(started.slice(1).sort()).toEqual(['collection-cursor', 'image-cursor', 'variant-cursor']);
  });
});
