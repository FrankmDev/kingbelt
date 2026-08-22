import { describe, expect, test } from 'bun:test';
import { assertValidCatalog, CatalogValidationError } from '../src/commerce/application/catalog-validation.ts';
import { CATALOG_INDEX_PATH, collectionPath } from '../src/commerce/application/paths.ts';
import { COLOR_GALLERY_IMAGE_COUNT } from '../src/commerce/domain/catalog.ts';
import { getVariantGallery } from '../src/commerce/domain/product-media.ts';
import { toCollectionReference, toProductSummary } from '../src/commerce/domain/product-mappers.ts';
import { demoCollections, demoProducts } from '../src/demo-catalog.ts';
import { createShopifyCatalogAdapter, createShopifyCatalogSnapshotQueries } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import {
  mapShopifyCatalog,
  mapShopifyCollections,
  mapShopifyProduct,
  mapShopifyProductSummary,
  ShopifyCatalogMappingError,
} from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import { isShopifyImageIdentifier } from '../src/commerce/infrastructure/shopify/shopify-image-identifier.ts';
import {
  FULL_PRODUCT_FIELDS,
  PRODUCT_SUMMARY_FIELDS,
  SHOPIFY_MAX_CONNECTION_PAGES,
  SHOPIFY_PAGE_SIZE,
  fetchShopifyCatalog,
} from '../src/commerce/infrastructure/shopify/catalog-query.ts';
import { createShopifyCatalogQueries } from '../src/commerce/infrastructure/shopify/catalog-runtime-query.ts';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER,
  ShopifyConfigurationError,
} from '../src/commerce/infrastructure/shopify/config.ts';
import { ShopifyStorefrontRequestError } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';
import {
  COLORS,
  SHOPIFY_COLOR_GALLERIES_METAFIELD,
  assignProductCollections,
  casualCollection,
  colorImages,
  cueroCollection,
  galleriesOf,
  galleryImagesOf,
  image,
  mediaImage,
  legacyPrimaryCollectionMetafield,
  novedadesCollection,
  pageInfo,
  primaryCollectionMetafield,
  primaryCollectionOf,
  productWithoutColorPayload,
  productSummaryNode,
  SHOPIFY_CATALOG_TEST_HOSTS as HOSTS,
  sportCollection,
  sportCollectionImage,
  validShopifyCatalogPayload as validPayload,
} from './fixtures/shopify-catalog-payload.mjs';

const RUNTIME_MAP_OPTIONS = { requireCommercialSku: false };

const expectMappingError = (payload, fragment) => {
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(fragment);
};

const expectRuntimeMappingError = (source, fragment) => {
  expect(() => mapShopifyProduct(source, HOSTS, RUNTIME_MAP_OPTIONS)).toThrow(ShopifyCatalogMappingError);
  expect(() => mapShopifyProduct(source, HOSTS, RUNTIME_MAP_OPTIONS)).toThrow(fragment);
};

const withoutPrimaryCollection = (payload) => {
  payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
    item?.key !== SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
  );
  return payload;
};

const missingPrimaryCollection = `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is missing`;
const primaryCollectionQueryKey = `key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}"`;
const primaryCollectionQueryNamespace = `namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}"`;
const colorGalleriesQueryKey = `key: "${SHOPIFY_COLOR_GALLERIES_METAFIELD.key}"`;

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
    expect(catalog.collections[0].image).toEqual(sportCollectionImage);
    expect(product.variants[0].id).toBe('gid://shopify/ProductVariant/1');
    expect(product.variants[0].sku).toBe('KB-ATLAS-CU-90');
    expect(product.variants[0].id).not.toBe(product.variants[0].sku);
    expect(new Set(product.variants.map((item) => item.sku)).size).toBe(product.variants.length);
    product.variants.forEach((item) => {
      const colorId = item.optionValues.find((selection) =>
        selection.optionId === product.options[0].id
      )?.valueId;
      const cover = product.mediaGroups.find((group) => group.optionValueId === colorId)?.imageIds[0];
      expect(item.imageId).toBe(cover);
    });
  });

  test('conserva fallbacks nativos de copy sin fabricar un SKU', () => {
    const payload = validPayload();
    payload.collections[0].description = '';
    payload.products[0].metafields = [
      primaryCollectionMetafield(payload.collections[0]),
      galleriesOf(payload),
    ];
    payload.products[0].images.nodes.forEach((item) => {
      item.altText = null;
    });
    const catalog = mapShopifyCatalog(payload, HOSTS);
    expect(catalog.collections[0].description).toBe('Sport');
    expect(catalog.products[0].reference).toBe('cinturon-atlas');
    expect(catalog.products[0].summary).toBe(payload.products[0].description);
    expect(catalog.products[0].specifications).toEqual([]);
    expect(catalog.products[0].images[0].altText).toBe('Cinturón Atlas');
    expect(catalog.products[0].variants[0].sku).toBe('KB-ATLAS-CU-90');
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

  test('las galerías salen exclusivamente de Product.images y se ordenan 01, 02, 03', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.reverse();
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups[0].imageIds).toEqual(colorImages('Cuero').map((item) => item.id));
    expect(product.mediaGroups[1].imageIds).toEqual(colorImages('Marrón').map((item) => item.id));
    expect(product.mediaGroups[2].imageIds).toEqual(colorImages('Negro').map((item) => item.id));
  });

  test('los metaobjects heredados no pueden introducir imágenes de otro producto', () => {
    const payload = validPayload();
    const foreign = image('foreign-1', 'otro-modelo_CUERO_01.jpg');
    galleryImagesOf(payload).references.nodes[0] = mediaImage(foreign);
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.images.some((item) => item.id === foreign.id)).toBe(false);
    expect(product.mediaGroups[0].imageIds).toEqual(colorImages('Cuero').map((item) => item.id));
  });

  test('ProductVariant.image de un color coincide con la portada y se conserva', () => {
    const payload = validPayload();
    const cover = colorImages('Cuero')[0];
    expect(payload.products[0].variants.nodes[0].image.id).toBe(cover.id);
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.variants[0].imageId).toBe(cover.id);
    expect(product.variants[0].imageId).toBe(product.mediaGroups[0].imageIds[0]);
  });

  test('una ProductVariant.image de otro color no se sustituye por la portada', () => {
    const payload = validPayload();
    const expected = colorImages('Cuero')[0];
    const actual = colorImages('Negro')[0];
    payload.products[0].variants.nodes[0].image = actual;
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('expected ShopifyCatalogMappingError');
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyCatalogMappingError);
      expect(error.message).toContain('cinturon-atlas.variants[0].image');
      expect(error.message).toContain('Color: Cuero');
      expect(error.message).toContain('Talla: 90');
      expect(error.message).toContain(expected.id);
      expect(error.message).toContain(actual.id);
    }
  });

  test('una ProductVariant.image ajena al producto no se sustituye por la portada', () => {
    const payload = validPayload();
    const foreign = image('foreign-variant', 'otro-modelo_01.jpg');
    payload.products[0].variants.nodes[0].image = foreign;
    expect(payload.products[0].images.nodes.some((item) => item.id === foreign.id)).toBe(false);
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('expected ShopifyCatalogMappingError');
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyCatalogMappingError);
      expect(error.message).toContain('cinturon-atlas.variants[0].image');
    expect(error.message).toContain(colorImages('Cuero')[0].id);
    expect(error.message).toContain(foreign.id);
    expect(error.message).toContain('Color: Cuero');
    }
  });

  test('una variante con Color y ProductVariant.image null no fabrica la portada', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = null;
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow('cinturon-atlas.variants[0].image');
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow('falta ProductVariant.image');
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow('Color: Cuero');
  });

  test('todas las tallas de un mismo color resuelven la misma portada', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    const marron = product.options[0].values.find((value) => value.label === 'Marrón');
    const cover = product.mediaGroups.find((group) => group.optionValueId === marron.id)?.imageIds[0];
    const sizes = product.variants.filter((item) =>
      item.optionValues.some((selection) => selection.valueId === marron.id)
    );
    expect(cover).toBe(colorImages('Marrón')[0].id);
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes.map((item) => item.imageId)).toEqual(sizes.map(() => cover));
  });

  test('cada color conserva su propia portada', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    const coverByColor = new Map(product.options[0].values.map((value) => {
      const cover = product.mediaGroups.find((group) => group.optionValueId === value.id)?.imageIds[0];
      return [value.label, cover];
    }));
    expect(coverByColor.get('Cuero')).toBe(colorImages('Cuero')[0].id);
    expect(coverByColor.get('Marrón')).toBe(colorImages('Marrón')[0].id);
    expect(coverByColor.get('Negro')).toBe(colorImages('Negro')[0].id);
    expect(new Set(coverByColor.values()).size).toBe(3);
    product.variants.forEach((item) => {
      const colorId = item.optionValues.find((selection) =>
        selection.optionId === product.options[0].id
      )?.valueId;
      const label = product.options[0].values.find((value) => value.id === colorId)?.label;
      expect(item.imageId).toBe(coverByColor.get(label));
    });
  });

  test('la galería de ficha de una variante empieza por su portada de color', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    const marron = product.options[0].values.find((value) => value.label === 'Marrón');
    const variant = product.variants.find((item) =>
      item.optionValues.some((selection) => selection.valueId === marron.id)
    );
    expect(getVariantGallery(product, variant).map((item) => item.id)).toEqual(
      colorImages('Marrón').map((item) => item.id)
    );
  });

  test('el contrato estricto exige una familia nativa completa y numerada 01, 02, 03', () => {
    const missing = validPayload();
    missing.products[0].images.nodes = missing.products[0].images.nodes.filter((item) =>
      !item.id.endsWith('/cuero-3')
    );
    expectMappingError(missing, 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');

    const wrongSequence = validPayload();
    wrongSequence.products[0].images.nodes.find((item) => item.id.endsWith('/cuero-3')).url =
      'https://cdn.shopify.com/s/files/cuero-4.jpg';
    expectMappingError(wrongSequence, 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
  });

  test('el contrato estricto detecta familias ambiguas para un mismo color', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.push(
      image('atlas-cuero-1', 'atlas_CUERO_01.jpg'),
      image('atlas-cuero-2', 'atlas_CUERO_02.jpg'),
      image('atlas-cuero-3', 'atlas_CUERO_03.jpg')
    );
    expectMappingError(payload, 'hay 2 familias cuyos nombres terminan en Cuero');
  });

  test('la coincidencia de color exige sufijo completo y no confunde Cuero con Cuero oscuro', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.push(
      image('oscuro-1', 'atlas_CUERO_OSCURO_01.jpg'),
      image('oscuro-2', 'atlas_CUERO_OSCURO_02.jpg'),
      image('oscuro-3', 'atlas_CUERO_OSCURO_03.jpg')
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups[0].imageIds).toEqual(colorImages('Cuero').map((item) => item.id));
  });

  test('el runtime rechaza una familia nativa parcial', () => {
    const payload = validPayload();
    payload.products[0].images.nodes = payload.products[0].images.nodes.filter((item) =>
      !item.id.endsWith('/cuero-3')
    );
    expectRuntimeMappingError(payload.products[0], 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
    expectRuntimeMappingError(payload.products[0], 'cinturon-atlas.images.Cuero');
  });

  test('una familia de cuatro imágenes no se recorta a tres', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.push(image('cuero-4', 'cuero-4.jpg'));
    expectMappingError(payload, 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
    expectRuntimeMappingError(payload.products[0], 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
  });

  test('una secuencia 01, 02, 04 falla en preflight y runtime', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.find((item) => item.id.endsWith('/cuero-3')).url =
      'https://cdn.shopify.com/s/files/cuero-4.jpg';
    expectMappingError(payload, 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
    expectRuntimeMappingError(payload.products[0], 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
  });

  test('una familia con IDs duplicados falla y no se deduplica en preflight', () => {
    const payload = validPayload();
    const second = payload.products[0].images.nodes.find((item) => item.id.endsWith('/cuero-2'));
    const third = payload.products[0].images.nodes.find((item) => item.id.endsWith('/cuero-3'));
    third.id = second.id;
    expectMappingError(payload, 'exactamente 3 imágenes únicas numeradas 01, 02 y 03');
  });

  test('un Color incompleto invalida el producto completo en preflight y runtime', () => {
    const payload = validPayload();
    payload.products[0].images.nodes = payload.products[0].images.nodes.filter((item) =>
      !item.id.endsWith('/negro-3')
    );
    expectMappingError(payload, 'cinturon-atlas.images.Negro');
    expectRuntimeMappingError(payload.products[0], 'cinturon-atlas.images.Negro');
  });

  test('no usa ProductVariant.image como galería si falta la familia nativa', () => {
    const payload = validPayload();
    const marronIds = new Set(colorImages('Marrón').map((item) => item.id));
    payload.products[0].images.nodes = payload.products[0].images.nodes.filter((item) =>
      !marronIds.has(item.id)
    );
    expect(payload.products[0].variants.nodes.some((variant) =>
      variant.selectedOptions.some((selection) => selection.value === 'Marrón')
      && variant.image?.id === colorImages('Marrón')[0].id
    )).toBe(true);
    expectMappingError(payload, 'cinturon-atlas.images.Marrón');
    expectRuntimeMappingError(payload.products[0], 'cinturon-atlas.images.Marrón');
    expectRuntimeMappingError(payload.products[0], 'no existe una familia cuyo nombre termine en Marrón');
  });

  test('el error de imagen de variante nombra el archivo de portada esperado', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = colorImages('Negro')[0];
    expectRuntimeMappingError(payload.products[0], 'cuero-1');
    expectRuntimeMappingError(payload.products[0], 'negro-1');
    expectRuntimeMappingError(payload.products[0], 'todas las tallas de este color');
  });

  test('el runtime no sustituye una ProductVariant.image de otro color', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = colorImages('Negro')[0];
    expectRuntimeMappingError(payload.products[0], 'cinturon-atlas.variants[0].image');
  });

  test('el runtime acepta una familia nativa completa de tres imágenes', () => {
    const product = mapShopifyProduct(validPayload().products[0], HOSTS, RUNTIME_MAP_OPTIONS);
    expect(product.mediaGroups[0].imageIds).toEqual(colorImages('Cuero').map((item) => item.id));
    expect(product.mediaGroups.every((group) => group.imageIds.length === COLOR_GALLERY_IMAGE_COUNT)).toBe(true);
  });

  test('un precio en moneda distinta de EUR falla la validación del catálogo', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes.forEach((item) => {
      item.price.currencyCode = 'USD';
    });
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('expected CatalogValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues.some((issue) => issue.code === 'unsupported_currency')).toBe(true);
    }
  });

  test('una variante Shopify a 0.00 EUR no se certifica como producto comercial', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].price = { amount: '0.00', currencyCode: 'EUR' };
    expect(payload.products[0].handle).toBe('cinturon-atlas');
    expect(payload.products[0].variants.nodes[0].availableForSale).toBe(true);
    try {
      mapShopifyProduct(payload.products[0], HOSTS);
      throw new Error('expected CatalogValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'non_positive_variant_price',
          path: 'products[0].variants[0].price',
        }),
      ]));
    }
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(CatalogValidationError);
  });

  test('un compareAtPrice presente no se omite si contradice el precio o la moneda', () => {
    const notHigher = validPayload();
    notHigher.products[0].variants.nodes[0].compareAtPrice = {
      amount: '59.90',
      currencyCode: 'EUR',
    };
    expectMappingError(notHigher, 'compareAtPrice.amount');

    const wrongCurrency = validPayload();
    wrongCurrency.products[0].variants.nodes[0].compareAtPrice = {
      amount: '69.90',
      currencyCode: 'USD',
    };
    expectMappingError(wrongCurrency, 'compareAtPrice.currencyCode');
  });

  test('conserva Collection.image con GID CollectionImage de Storefront', () => {
    const image = {
      id: 'gid://shopify/CollectionImage/123456789',
      url: 'https://cdn.shopify.com/s/files/sport-collection.jpg',
      altText: 'Sport',
      width: 1200,
      height: 1500,
    };
    const collections = mapShopifyCollections([
      { ...sportCollection, image: null },
      { ...casualCollection, image },
    ], HOSTS);
    expect(collections[1].image).toEqual(image);
    expect(collections[1].image?.id).toBe('gid://shopify/CollectionImage/123456789');
  });

  test('acepta ProductImage, el recurso real de Image en Product.images', () => {
    const payload = validPayload();
    const productImageId = payload.products[0].images.nodes[0].id;
    expect(productImageId).toMatch(/^gid:\/\/shopify\/ProductImage\//);
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.images[0].id).toBe(productImageId);
  });

  test('rechaza IDs de Image que no sean GID Shopify', () => {
    const payload = validPayload();
    payload.products[0].images.nodes[0].id = 'image-local-1';
    expectMappingError(payload, 'se esperaba un GID Shopify de imagen');
  });

  test('rechaza GIDs de Image estructuralmente inválidos o de otro namespace', () => {
    const invalidIds = [
      '',
      'abc',
      '123',
      'gid://other/ProductImage/123',
      'gid://shopify/',
      'gid://shopify//123',
      'gid://shopify/ProductImage/12\u00003',
      ' gid://shopify/ProductImage/123',
      'gid://shopify/ProductImage/123 ',
      `gid://shopify/ProductImage/${'a'.repeat(300)}`,
    ];
    for (const id of invalidIds) {
      expect(isShopifyImageIdentifier(id)).toBe(false);
      const payload = validPayload();
      payload.products[0].images.nodes[0].id = id;
      expectMappingError(payload, 'se esperaba un GID Shopify de imagen');
    }
  });

  test('un Product.id CollectionImage sigue siendo inválido', () => {
    const payload = validPayload();
    payload.products[0].id = 'gid://shopify/CollectionImage/123456789';
    expectMappingError(payload, 'se esperaba un GID Shopify de Product');
  });

  test('acepta ImageSource en Product.featuredImage', () => {
    const payload = validPayload();
    const imageSourceId = 'gid://shopify/ImageSource/real-storefront-image-1';
    payload.products[0].featuredImage = {
      ...payload.products[0].featuredImage,
      id: imageSourceId,
    };
    const summary = mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS);
    expect(summary.primaryImage?.id).toBe(imageSourceId);
  });

  test('un ProductSummary con precio mínimo 0.00 EUR falla cerrado', () => {
    const node = productSummaryNode(validPayload().products[0]);
    node.priceRange.minVariantPrice = { amount: '0.00', currencyCode: 'EUR' };
    try {
      mapShopifyProductSummary(node, HOSTS);
      throw new Error('expected CatalogValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'non_positive_variant_price' }),
      ]));
    }
  });

  test('un width_mm presente pero inválido falla en vez de omitir la especificación', () => {
    const payload = validPayload();
    payload.products[0].metafields.find((item) => item?.key === 'width_mm').value = '35.5';
    expectMappingError(payload, 'width_mm.value');
    expectMappingError(payload, 'entero positivo');
  });

  test('imagen sin ID falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[0].image.id = '';
    expectMappingError(payload, '.id');
  });

  test('imagen sin URL falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[0].image.url = '';
    expectMappingError(payload, '.url');
  });

  test('imagen sin width falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[0].image.width = null;
    expectMappingError(payload, '.width');
  });

  test('imagen sin height falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[0].image.height = null;
    expectMappingError(payload, '.height');
  });

  test('todas las tallas de un mismo color pueden compartir la misma portada', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    const colorOption = product.options.find((option) => option.purpose === 'color');
    colorOption.values.forEach((value) => {
      const cover = product.mediaGroups.find((group) => group.optionValueId === value.id)?.imageIds[0];
      const variantImages = product.variants
        .filter((item) => item.optionValues.some((selection) => selection.valueId === value.id))
        .map((item) => item.imageId);
      expect(variantImages.length).toBeGreaterThan(1);
      expect(new Set(variantImages)).toEqual(new Set([cover]));
    });
  });

  test('identifica la opción Color por purpose aunque Talla vaya primero', () => {
    const payload = validPayload();
    payload.products[0].options = [...payload.products[0].options].reverse();
    payload.products[0].variants.nodes.forEach((item) => {
      item.selectedOptions = [...item.selectedOptions].reverse();
    });
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    const colorOption = product.options.find((option) => option.purpose === 'color');
    expect(product.options[0].purpose).toBe('size');
    expect(colorOption?.purpose).toBe('color');
    expect(product.mediaGroups.map((group) => group.optionValueId)).toEqual(
      colorOption.values.map((value) => value.id)
    );
    expect(product.primaryImageId).toBe(colorImages('Cuero')[0].id);
  });

  test('cambiar el orden de variantes no cambia la galería', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes = [...payload.products[0].variants.nodes].reverse();
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      colorImages('Cuero').map((item) => item.id),
      colorImages('Marrón').map((item) => item.id),
      colorImages('Negro').map((item) => item.id),
    ]);
  });

  test('cambiar el orden de product.images no cambia la galería', () => {
    const payload = validPayload();
    payload.products[0].images.nodes = [...payload.products[0].images.nodes].reverse();
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.imageIds)).toEqual([
      colorImages('Cuero').map((item) => item.id),
      colorImages('Marrón').map((item) => item.id),
      colorImages('Negro').map((item) => item.id),
    ]);
  });

  test('falla con contexto cuando un metafield publicado tiene un tipo incorrecto', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.map((item) =>
      item?.key === 'model_reference' ? { ...item, type: 'number_integer' } : item
    );
    expectMappingError(payload, 'metafields.kingbelt.model_reference');
  });

  test('el adapter no comparte una única carga de catálogo entre recursos distintos', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const calls = [];
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() {
        calls.push('handles');
        return catalog.products.map((product) => product.handle);
      },
      async getProductByHandle(handle) {
        calls.push(`product:${handle}`);
        return catalog.products.find((product) => product.handle === handle);
      },
      async getCollectionByHandle(handle) {
        calls.push(`collection:${handle}`);
        const collection = catalog.collections.find((item) => item.handle === handle);
        if (!collection) return undefined;
        return { collection, products: [] };
      },
      async getCollections() { return catalog.collections; },
      async getCollectionHandles() { return catalog.collections.map((item) => item.handle); },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    });
    const [handles, product, collection] = await Promise.all([
      adapter.getProductHandles(),
      adapter.getProductByHandle('cinturon-atlas'),
      adapter.getCollectionByHandle('sport'),
    ]);
    expect(calls.sort()).toEqual(['collection:sport', 'handles', 'product:cinturon-atlas']);
    expect(handles).toEqual(['cinturon-atlas']);
    expect(product?.vendor).toBe('KingBelt');
    expect(collection?.collection.handle).toBe('sport');
  });

  test('el adapter vuelve a consultar el mismo recurso cuando expira la caché de desarrollo', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() {
        loads += 1;
        return catalog.products.map((product) => product.handle);
      },
      async getProductByHandle() { return catalog.products[0]; },
      async getCollectionByHandle() { return undefined; },
      async getCollections() { return catalog.collections; },
      async getCollectionHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    }, { cacheTtlMs: 0 });
    await adapter.getProductHandles();
    await adapter.getProductHandles();
    expect(loads).toBe(2);
  });

  test('el adapter sirve el último recurso válido si Shopify falla (stale-if-error)', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    let loads = 0;
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() {
        loads += 1;
        if (loads > 1) throw new ShopifyStorefrontRequestError('network', 'storefront_down');
        return catalog.products.map((product) => product.handle);
      },
      async getProductByHandle() { return catalog.products[0]; },
      async getCollectionByHandle() { return undefined; },
      async getCollections() { return catalog.collections; },
      async getCollectionHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() { return []; },
      async getRelatedProducts() { return []; },
    }, { cacheTtlMs: 0 });
    await adapter.getProductHandles();
    await expect(adapter.getProductHandles()).resolves.toEqual(['cinturon-atlas']);
    expect(loads).toBe(2);
  });

  test('el adapter falla cerrado sin recurso previo', async () => {
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() { throw new Error('storefront_down'); },
      async getProductByHandle() { throw new Error('storefront_down'); },
      async getCollectionByHandle() { throw new Error('storefront_down'); },
      async getCollections() { throw new Error('storefront_down'); },
      async getCollectionHandles() { throw new Error('storefront_down'); },
      async getProductSummaries() { throw new Error('storefront_down'); },
      async getFeaturedProducts() { throw new Error('storefront_down'); },
      async getRelatedProducts() { throw new Error('storefront_down'); },
    }, { cacheTtlMs: 0 });
    await expect(adapter.getProductHandles()).rejects.toThrow('storefront_down');
  });

  test('el adapter no oculta una configuración Shopify inválida con catálogo vacío', async () => {
    const adapter = createShopifyCatalogAdapter({
      async getProductHandles() {
        throw new ShopifyConfigurationError(
          'SHOPIFY_STORE_DOMAIN must be a hostname like shop-name.myshopify.com, without protocol, path, query, fragment, credentials, or port.'
        );
      },
      async getProductByHandle() { return undefined; },
      async getCollectionByHandle() { return undefined; },
      async getCollections() { return []; },
      async getCollectionHandles() { return []; },
      async getProductSummaries() { return []; },
      async getFeaturedProducts() {
        throw new ShopifyConfigurationError(
          'SHOPIFY_STORE_DOMAIN must be a hostname like shop-name.myshopify.com, without protocol, path, query, fragment, credentials, or port.'
        );
      },
      async getRelatedProducts() { return []; },
    });
    await expect(adapter.getProductHandles()).rejects.toBeInstanceOf(ShopifyConfigurationError);
    await expect(adapter.getFeaturedProducts(4)).rejects.toBeInstanceOf(ShopifyConfigurationError);
    await expect(adapter.getFeaturedProducts(0)).resolves.toEqual([]);
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
      country: SHOPIFY_MARKET_CONTEXT.country,
      language: SHOPIFY_MARKET_CONTEXT.language,
    });
    expect(calls[1].variables).toEqual({
      first: 250,
      productsAfter: 'product-cursor',
      collectionsAfter: 'collection-cursor',
      country: SHOPIFY_MARKET_CONTEXT.country,
      language: SHOPIFY_MARKET_CONTEXT.language,
    });
    expect(calls[0].query).toContain('metafields(identifiers:');
    expect(calls[0].query).toContain(primaryCollectionQueryNamespace);
    expect(calls[0].query).toContain(primaryCollectionQueryKey);
    expect(calls[0].query).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
    expect(calls[0].query).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(calls[0].query).not.toContain(colorGalleriesQueryKey);
    expect(calls[0].query).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"color_galleries"/);
    expect(calls[0].query).toContain('... on Collection { id handle title }');
    expect(calls[0].query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
    expect(calls[1].query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
  });

  test('el catálogo completo falla cerrado al superar el máximo explícito de páginas', async () => {
    let calls = 0;
    const gateway = {
      async graphql() {
        calls += 1;
        return {
          products: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: `product-${calls}` },
          },
          collections: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: `collection-${calls}` },
          },
        };
      },
    };
    await expect(fetchShopifyCatalog(gateway)).rejects.toThrow(
      'límite de páginas del catálogo completo'
    );
    expect(calls).toBe(SHOPIFY_MAX_CONNECTION_PAGES);
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

  test('producto, colección y summaries runtime usan el contexto ES', async () => {
    const payload = validPayload();
    const queries = [];
    const gateway = {
      async graphql(query, variables) {
        queries.push({ query, variables });
        if (query.includes('KingBeltProductByHandle')) {
          return { product: payload.products[0] };
        }
        if (query.includes('KingBeltCollectionByHandle')) {
          return {
            collection: {
              ...payload.collections[0],
              products: { nodes: [productSummaryNode(payload.products[0])], pageInfo },
            },
          };
        }
        if (query.includes('KingBeltProductSummariesPage')) {
          return {
            products: { nodes: [productSummaryNode(payload.products[0])], pageInfo },
          };
        }
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      },
    };
    const runtime = createShopifyCatalogQueries(gateway, HOSTS);
    const [product, collection, summaries] = await Promise.all([
      runtime.getProductByHandle('cinturon-atlas'),
      runtime.getCollectionByHandle('sport'),
      runtime.getProductSummaries(),
    ]);

    expect(product?.handle).toBe('cinturon-atlas');
    expect(collection?.collection.handle).toBe('sport');
    expect(summaries).toHaveLength(1);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    queries.forEach(({ query, variables }) => {
      expect(query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    });
    expect(product?.variants[0].price.currency).toBe(SHOPIFY_MARKET_CONTEXT.currency);
  });

  test('un producto no publicado en ES no se recupera sin contexto', async () => {
    const queries = [];
    const gateway = {
      async graphql(query, variables) {
        queries.push({ query, variables });
        if (query.includes('KingBeltProductByHandle')) return { product: null };
        if (query.includes('KingBeltCollectionByHandle')) return { collection: null };
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      },
    };
    const runtime = createShopifyCatalogQueries(gateway, HOSTS);
    await expect(runtime.getProductByHandle('cinturon-atlas')).resolves.toBeUndefined();
    await expect(runtime.getCollectionByHandle('missing-es')).resolves.toBeUndefined();
    expect(queries).toHaveLength(2);
    queries.forEach(({ query, variables }) => {
      expect(query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    });
    expect(queries).toHaveLength(2);
    expect(queries.some((item) => !item.query.includes('@inContext'))).toBe(false);
  });

  test('la carga completa del catálogo no hace fallback a una query sin @inContext', async () => {
    const payload = validPayload();
    payload.products[0].variants.pageInfo = { hasNextPage: true, endCursor: 'variant-cursor' };
    const queries = [];
    const gateway = {
      async graphql(query, variables) {
        queries.push({ query, variables });
        if (query.includes('KingBeltCatalogPage')) {
          return {
            products: { nodes: payload.products, pageInfo },
            collections: { nodes: payload.collections, pageInfo },
          };
        }
        if (query.includes('KingBeltProductVariantsPage')) {
          return { node: { variants: { nodes: [], pageInfo } } };
        }
        throw new Error(`consulta inesperada: ${query.slice(0, 80)}`);
      },
    };
    await fetchShopifyCatalog(gateway);
    expect(queries.length).toBeGreaterThan(1);
    queries.forEach(({ query, variables }) => {
      expect(query).toContain(SHOPIFY_IN_CONTEXT_DIRECTIVE);
      expect(query).toContain('$country: CountryCode!');
      expect(query).toContain('$language: LanguageCode!');
      expect(variables.country).toBe(SHOPIFY_MARKET_CONTEXT.country);
      expect(variables.language).toBe(SHOPIFY_MARKET_CONTEXT.language);
    });
  });
});

describe('colección principal Shopify', () => {
  const breadcrumbsFor = (product, collections) => {
    const category = collections.find((collection) => collection.id === product.primaryCollectionId);
    return [
      { label: 'Productos', href: CATALOG_INDEX_PATH },
      { label: category.title, href: collectionPath(category.handle) },
      { label: product.title },
    ];
  };

  test('el metafield válido determina primaryCollectionId aunque no sea la primera colección', () => {
    const payload = assignProductCollections(
      validPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.primaryCollectionId).toBe(casualCollection.id);
    expect(product.collectionIds).toEqual([novedadesCollection.id, casualCollection.id]);
    expect(product.collectionIds[0]).not.toBe(product.primaryCollectionId);
    expect(mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS).primaryCollection)
      .toEqual({
        id: casualCollection.id,
        handle: casualCollection.handle,
        title: casualCollection.title,
      });
  });

  test('cambiar el orden de product.collections no cambia primaryCollectionId', () => {
    const payloadA = assignProductCollections(
      validPayload(),
      [casualCollection, novedadesCollection],
      casualCollection
    );
    const payloadB = assignProductCollections(
      validPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    );
    const productA = mapShopifyCatalog(payloadA, HOSTS).products[0];
    const productB = mapShopifyCatalog(payloadB, HOSTS).products[0];
    expect(productA.primaryCollectionId).toBe(casualCollection.id);
    expect(productB.primaryCollectionId).toBe(casualCollection.id);
    expect(productA.primaryCollectionId).toBe(productB.primaryCollectionId);
    expect(mapShopifyProductSummary(productSummaryNode(payloadA.products[0]), HOSTS).primaryCollection.id)
      .toBe(casualCollection.id);
    expect(mapShopifyProductSummary(productSummaryNode(payloadB.products[0]), HOSTS).primaryCollection.id)
      .toBe(casualCollection.id);
  });

  test('un producto con varias colecciones conserva todas las pertenencias', () => {
    const payload = assignProductCollections(
      validPayload(),
      [casualCollection, novedadesCollection, cueroCollection],
      casualCollection
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.collectionIds).toEqual([
      casualCollection.id,
      novedadesCollection.id,
      cueroCollection.id,
    ]);
    expect(product.primaryCollectionId).toBe(casualCollection.id);
  });

  test('un producto con una sola colección también exige custom.kingbelt_primary_collection', () => {
    const payload = assignProductCollections(
      validPayload(),
      [casualCollection],
      casualCollection
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.primaryCollectionId).toBe(casualCollection.id);
    expect(product.collectionIds).toEqual([casualCollection.id]);
    expect(mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS).primaryCollection)
      .toEqual({
        id: casualCollection.id,
        handle: casualCollection.handle,
        title: casualCollection.title,
      });

    withoutPrimaryCollection(payload);
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(missingPrimaryCollection);
    expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
      .toThrow(missingPrimaryCollection);
  });

  test('el runtime también exige custom.kingbelt_primary_collection con una sola colección asignada', () => {
    const payload = withoutPrimaryCollection(assignProductCollections(
      validPayload(),
      [casualCollection],
      casualCollection
    ));
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(missingPrimaryCollection);
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow(missingPrimaryCollection);
    expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
      .toThrow(missingPrimaryCollection);
  });

  test('el runtime no elige una colección si faltan el metafield y hay varias asignadas', () => {
    const payload = withoutPrimaryCollection(assignProductCollections(
      validPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    ));
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow(missingPrimaryCollection);
    expect(() => mapShopifyProductSummary(
      productSummaryNode(payload.products[0]),
      HOSTS
    )).toThrow(missingPrimaryCollection);
  });

  test('el metafield ausente falla sin caer a collections[0]', () => {
    const payload = withoutPrimaryCollection(assignProductCollections(
      validPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    ));
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(missingPrimaryCollection);
    expect(() => mapShopifyCatalog(payload, HOSTS)).not.toThrow(novedadesCollection.id);
    expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
      .toThrow(missingPrimaryCollection);
  });

  test('el campo legado kingbelt.primary_collection no actúa como fallback', () => {
    const payload = assignProductCollections(
      validPayload(),
      [casualCollection],
      casualCollection
    );
    withoutPrimaryCollection(payload);
    payload.products[0].metafields = [
      ...payload.products[0].metafields,
      legacyPrimaryCollectionMetafield(casualCollection),
    ];
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(missingPrimaryCollection);
    expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
      .toThrow(missingPrimaryCollection);
  });

  test('el metafield vacío falla', () => {
    const payload = validPayload();
    const metafieldNode = primaryCollectionOf(payload);
    metafieldNode.value = '';
    metafieldNode.reference = null;
    expectMappingError(payload, `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is empty`);
    expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
      .toThrow(`${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is empty`);
  });

  test('un tipo incorrecto falla', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.map((item) =>
      item?.key === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
        ? { ...item, type: 'single_line_text_field' }
        : item
    );
    expectMappingError(
      payload,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} has type single_line_text_field; expected collection_reference`
    );
  });

  test('una referencia que no es Collection falla', () => {
    const payload = validPayload();
    const metafieldNode = primaryCollectionOf(payload);
    metafieldNode.reference = {
      __typename: 'Product',
      id: 'gid://shopify/Product/99',
    };
    expectMappingError(
      payload,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} does not reference a Collection`
    );
  });

  test('una referencia rota con valor falla de forma accionable', () => {
    const payload = validPayload();
    const metafieldNode = primaryCollectionOf(payload);
    metafieldNode.value = 'gid://shopify/Collection/999';
    metafieldNode.reference = null;
    expectMappingError(
      payload,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} has a value but the Collection reference is not available in Storefront`
    );
    expectMappingError(payload, 'Storefront access');
  });

  test('id, handle y title de la Collection referenciada son obligatorios', () => {
    for (const field of ['id', 'handle', 'title']) {
      const payload = validPayload();
      const metafieldNode = primaryCollectionOf(payload);
      metafieldNode.reference[field] = '';
      expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
      expect(() => mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS))
        .toThrow(ShopifyCatalogMappingError);
    }
  });

  test('una colección principal no asignada al producto falla', () => {
    const payload = assignProductCollections(
      validPayload(),
      [novedadesCollection, cueroCollection],
      casualCollection
    );
    expectMappingError(
      payload,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} references collection "casual" but that collection is not assigned to this product`
    );
  });

  test('summaries conservan la colección principal explícita, no la colección visitada', async () => {
    const payload = assignProductCollections(
      validPayload(),
      [casualCollection, novedadesCollection],
      casualCollection
    );
    const summary = mapShopifyProductSummary(productSummaryNode(payload.products[0]), HOSTS);
    expect(summary.primaryCollection).toEqual({
      id: casualCollection.id,
      handle: 'casual',
      title: 'Casual',
    });

    const catalog = mapShopifyCatalog(payload, HOSTS);
    const adapter = createShopifyCatalogAdapter(createShopifyCatalogSnapshotQueries(catalog));
    const page = await adapter.getCollectionByHandle('novedades');
    expect(page?.products[0].primaryCollection.handle).toBe('casual');
    expect(page?.products[0].primaryCollection.handle).not.toBe('novedades');
  });

  test('los breadcrumbs de producto usan la colección principal, no el orden Shopify', () => {
    const payloadA = assignProductCollections(
      validPayload(),
      [casualCollection, novedadesCollection],
      casualCollection
    );
    const payloadB = assignProductCollections(
      validPayload(),
      [novedadesCollection, casualCollection],
      casualCollection
    );
    const catalogA = mapShopifyCatalog(payloadA, HOSTS);
    const catalogB = mapShopifyCatalog(payloadB, HOSTS);
    expect(breadcrumbsFor(catalogA.products[0], catalogA.collections)).toEqual([
      { label: 'Productos', href: CATALOG_INDEX_PATH },
      { label: 'Casual', href: collectionPath('casual') },
      { label: 'Cinturón Atlas' },
    ]);
    expect(breadcrumbsFor(catalogB.products[0], catalogB.collections)).toEqual(
      breadcrumbsFor(catalogA.products[0], catalogA.collections)
    );
  });

  test('el catálogo demo sigue declarando primaryCollectionId sin metafields Shopify', () => {
    expect(() => assertValidCatalog(demoProducts, demoCollections)).not.toThrow();
    demoProducts.forEach((product) => {
      expect(product.collectionIds).toContain(product.primaryCollectionId);
      expect(demoCollections.some((collection) => collection.id === product.primaryCollectionId)).toBe(true);
    });
  });

  test('getRelatedProducts solo busca en la colección principal, no en las secundarias', async () => {
    const sport = demoCollections.find((collection) => collection.handle === 'sport');
    const casual = demoCollections.find((collection) => collection.handle === 'casual');
    const sportProducts = demoProducts.filter((product) => product.collectionIds.includes(sport.id));
    const casualOnly = demoProducts.find(
      (product) =>
        product.primaryCollectionId === casual.id && !product.collectionIds.includes(sport.id)
    );
    const productA = {
      ...sportProducts[0],
      collectionIds: [...sportProducts[0].collectionIds, casual.id],
    };
    const queries = createShopifyCatalogSnapshotQueries({
      products: [productA, casualOnly, sportProducts[1]],
      collections: demoCollections,
    });
    const related = await queries.getRelatedProducts(productA, 8);
    expect(related.map((item) => item.handle)).toContain(sportProducts[1].handle);
    expect(related.map((item) => item.handle)).not.toContain(casualOnly.handle);
    expect(related.every((item) => item.primaryCollection.handle === 'sport')).toBe(true);
  });

  test('las queries snapshot no omiten un Product sin su colección principal', async () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const orphan = {
      ...catalog.products[0],
      id: 'gid://shopify/Product/orphan',
      handle: 'cinturon-huerfano',
      primaryCollectionId: 'gid://shopify/Collection/missing',
    };
    const broken = {
      products: [catalog.products[0], orphan],
      collections: catalog.collections,
    };
    const queries = createShopifyCatalogSnapshotQueries(broken);
    const expected = 'Primary collection gid://shopify/Collection/missing not found for product cinturon-huerfano.';
    await expect(queries.getProductSummaries()).rejects.toThrow(expected);
    await expect(queries.getFeaturedProducts(4)).rejects.toThrow(expected);
    await expect(queries.getCollectionByHandle('sport')).rejects.toThrow(expected);
    await expect(queries.getRelatedProducts(catalog.products[0], 1)).rejects.toThrow(expected);
  });

  test('getProductByHandle y getProductSummaries piden custom.kingbelt_primary_collection', () => {
    expect(FULL_PRODUCT_FIELDS).toContain(primaryCollectionQueryNamespace);
    expect(FULL_PRODUCT_FIELDS).toContain(primaryCollectionQueryKey);
    expect(FULL_PRODUCT_FIELDS).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
    expect(FULL_PRODUCT_FIELDS).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(FULL_PRODUCT_FIELDS).not.toContain(colorGalleriesQueryKey);
    expect(FULL_PRODUCT_FIELDS).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"color_galleries"/);
    expect(FULL_PRODUCT_FIELDS).toContain('images(first:');
    expect(FULL_PRODUCT_FIELDS).toMatch(/variants\(first:[\s\S]*?image \{ id url altText width height \}/);
    expect(PRODUCT_SUMMARY_FIELDS).toContain(primaryCollectionQueryNamespace);
    expect(PRODUCT_SUMMARY_FIELDS).toContain(primaryCollectionQueryKey);
    expect(PRODUCT_SUMMARY_FIELDS).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
    expect(PRODUCT_SUMMARY_FIELDS).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(PRODUCT_SUMMARY_FIELDS).toContain('reference');
    expect(PRODUCT_SUMMARY_FIELDS).toContain('... on Collection { id handle title }');
    expect(PRODUCT_SUMMARY_FIELDS).toContain(`collections(first: ${SHOPIFY_PAGE_SIZE})`);
    expect(PRODUCT_SUMMARY_FIELDS).toContain('nodes { id handle title }');
  });
});

describe('autoridad del SKU Shopify', () => {
  const expectMissingSku = (payload, fragment) => {
    expectMappingError(payload, fragment);
    expectMappingError(payload, 'falta un texto obligatorio');
  };

  test('conserva el SKU comercial y solo recorta espacios exteriores', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].sku = '  0001008-100-CU-NA  ';
    const variant = mapShopifyCatalog(payload, HOSTS).products[0].variants[0];
    expect(variant.sku).toBe('0001008-100-CU-NA');
    expect(variant.id).toBe('gid://shopify/ProductVariant/1');
    expect(variant.id).not.toBe(variant.sku);
  });

  test('sku null, vacío o solo espacios hace fallar el mapping', () => {
    for (const sku of [null, '', '   ']) {
      const payload = validPayload();
      payload.products[0].variants.nodes[0].sku = sku;
      expectMissingSku(payload, 'cinturon-atlas.variants[0].sku');
    }
  });

  test('el runtime usa un identificador técnico estable si Shopify no tiene SKU comercial', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].sku = null;
    payload.products[0].variants.nodes[1].sku = '   ';
    const product = mapShopifyProduct(payload.products[0], HOSTS, RUNTIME_MAP_OPTIONS);
    expect(product.variants[0].sku).toBe('shopify-variant-1');
    expect(product.variants[1].sku).toBe('shopify-variant-2');
    expect(new Set(product.variants.map((variant) => variant.sku)).size)
      .toBe(product.variants.length);
  });

  test('el prefijo de SKU técnico está reservado y no puede usarse como SKU comercial', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].sku = 'shopify-variant-manual';
    expectMappingError(payload, 'prefijo reservado');
  });

  test('un SKU ausente no se sustituye por handle, variant.id ni model_reference', () => {
    const payload = validPayload();
    const handle = payload.products[0].handle;
    const variantGid = payload.products[0].variants.nodes[0].id;
    payload.products[0].variants.nodes[0].sku = null;
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('se esperaba un catálogo inválido');
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyCatalogMappingError);
      expect(error.message).toContain(`${handle}.variants[0].sku`);
      expect(error.message).toContain('Color: Cuero');
      expect(error.message).toContain('Talla: 90');
      expect(error.message).not.toContain(`${handle}:${variantGid}`);
    }
  });

  test('un producto con una sola variante sin SKU falla completo', () => {
    const payload = productWithoutColorPayload();
    payload.products[0].variants.nodes[0].sku = null;
    expectMissingSku(payload, 'cinturon-unico.variants[0].sku');
  });

  test('varias variantes con una sola sin SKU no publican el resto', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[3].sku = '';
    expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
    expectMissingSku(payload, 'cinturon-atlas.variants[3].sku');
    expect(() => mapShopifyProduct(payload.products[0], HOSTS)).toThrow(ShopifyCatalogMappingError);
  });

  test('SKU duplicados dentro del mismo producto fallan', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[1].sku = payload.products[0].variants.nodes[0].sku;
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('se esperaba un catálogo inválido');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues.map((issue) => issue.code)).toContain('duplicate_sku');
    }
  });

  test('SKU duplicados entre productos distintos fallan tras recortar espacios', () => {
    const payload = validPayload();
    const extra = productWithoutColorPayload();
    extra.products[0].variants.nodes[0].sku = `  ${payload.products[0].variants.nodes[0].sku}  `;
    payload.products.push(extra.products[0]);
    try {
      mapShopifyCatalog(payload, HOSTS);
      throw new Error('se esperaba un catálogo inválido');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect(error.issues.map((issue) => issue.code)).toContain('duplicate_sku');
    }
  });

  test('variantes con SKU distintos pasan y ProductSummary no incorpora SKU', () => {
    const catalog = mapShopifyCatalog(validPayload(), HOSTS);
    const product = catalog.products[0];
    const skus = product.variants.map((item) => item.sku);
    expect(skus.every(Boolean)).toBe(true);
    expect(new Set(skus).size).toBe(skus.length);
    const summary = toProductSummary(product, toCollectionReference(catalog.collections[0]));
    expect(Object.hasOwn(summary, 'sku')).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('"sku"');
  });

  test('el catálogo demo sigue siendo válido sin depender de Shopify', () => {
    expect(() => assertValidCatalog(demoProducts, demoCollections)).not.toThrow();
    demoProducts.forEach((product) => {
      product.variants.forEach((variant) => {
        expect(variant.sku.length).toBeGreaterThan(0);
        expect(variant.sku).not.toBe(`${product.handle}:${variant.id}`);
        expect(variant.id).not.toBe(variant.sku);
      });
    });
  });
});
