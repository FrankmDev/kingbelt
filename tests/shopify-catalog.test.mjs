import { describe, expect, test } from 'bun:test';
import { assertValidCatalog, CatalogValidationError } from '../src/commerce/application/catalog-validation.ts';
import { CATALOG_INDEX_PATH, collectionPath } from '../src/commerce/application/paths.ts';
import { COLOR_GALLERY_IMAGE_COUNT } from '../src/commerce/domain/catalog.ts';
import { toCollectionReference, toProductSummary } from '../src/commerce/domain/product-mappers.ts';
import { demoCollections, demoProducts } from '../src/demo-catalog.ts';
import { createShopifyCatalogAdapter, createShopifyCatalogSnapshotQueries } from '../src/commerce/infrastructure/shopify/catalog-adapter.ts';
import {
  mapShopifyCatalog,
  mapShopifyProduct,
  mapShopifyProductSummary,
  ShopifyCatalogMappingError,
} from '../src/commerce/infrastructure/shopify/catalog-mappers.ts';
import {
  FULL_PRODUCT_FIELDS,
  PRODUCT_SUMMARY_FIELDS,
  SHOPIFY_MAX_CONNECTION_PAGES,
  fetchShopifyCatalog,
} from '../src/commerce/infrastructure/shopify/catalog-query.ts';
import { createShopifyCatalogQueries } from '../src/commerce/infrastructure/shopify/catalog-runtime-query.ts';
import {
  SHOPIFY_COLOR_GALLERIES_METAFIELD,
  SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER,
  SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE,
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER,
  ShopifyConfigurationError,
} from '../src/commerce/infrastructure/shopify/config.ts';
import { ShopifyStorefrontRequestError } from '../src/commerce/infrastructure/shopify/storefront-gateway.ts';
import {
  COLORS,
  assignProductCollections,
  casualCollection,
  colorGallery,
  colorImages,
  cueroCollection,
  galleriesOf,
  galleryField,
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
  validShopifyCatalogPayload as validPayload,
} from './fixtures/shopify-catalog-payload.mjs';

const expectMappingError = (payload, fragment) => {
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(ShopifyCatalogMappingError);
  expect(() => mapShopifyCatalog(payload, HOSTS)).toThrow(fragment);
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
const colorGalleriesQueryNamespace = `namespace: "${SHOPIFY_COLOR_GALLERIES_METAFIELD.namespace}"`;

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

  test('ordena mediaGroups según la opción Color aunque las referencias vengan en otro orden', () => {
    const catalog = mapShopifyCatalog(validPayload({
      galleryOrder: [COLORS[2], COLORS[0], COLORS[1]],
    }), HOSTS);
    expect(catalog.products[0].mediaGroups.map((group) => group.optionValueId)).toEqual(
      catalog.products[0].options[0].values.map((value) => value.id)
    );
    expect(catalog.products[0].primaryImageId).toBe(colorImages('Cuero')[0].id);
  });

  test('un producto con Color exige color_galleries y falla si el metafield está ausente', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== SHOPIFY_COLOR_GALLERIES_METAFIELD.key
    );
    expectMappingError(payload, `metafields.${SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER}`);
    expectMappingError(payload, 'Storefront access = Read');
  });

  test('el runtime usa las tres imágenes de custom.kingbelt_color_galleries cuando llegan', () => {
    const product = mapShopifyProduct(validPayload().products[0], HOSTS);
    expect(product.mediaGroups.every((group) => group.imageIds.length === COLOR_GALLERY_IMAGE_COUNT)).toBe(true);
    expect(product.mediaGroups[0].imageIds).toEqual(colorImages('Cuero').map((image) => image.id));
  });

  test('el runtime falla si la imagen de la variante no es la portada de su galería', () => {
    const payload = validPayload();
    payload.products[0].variants.nodes[0].image = colorImages('Cuero')[1];
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow('la imagen de la variante no coincide con la portada de su galería de color');
  });

  test('el runtime falla si un color no tiene images en el metaobject', () => {
    const payload = validPayload();
    const negroGallery = galleriesOf(payload).references.nodes.find((item) =>
      galleryField(item, 'color_value').value === 'Negro'
    );
    negroGallery.fields = negroGallery.fields.filter((field) => field.key !== 'images');
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow('falta el campo list.file_reference');
  });

  test('el runtime no infiere galerías por filename si las referencias no coinciden con la portada', () => {
    const payload = validPayload();
    payload.products[0].images.nodes.forEach((item) => {
      const stem = item.id.replace('gid://shopify/ProductImage/', '');
      const [slug, sequence] = stem.split('-');
      item.url = `https://cdn.shopify.com/s/files/${slug}_${String(sequence).padStart(2, '0')}.jpg`;
    });
    galleriesOf(payload).references.nodes.forEach((gallery, galleryIndex) => {
      galleryField(gallery, 'images').references.nodes = [1, 2, 3].map((sequence) =>
        mediaImage(image(`ajena-${galleryIndex}-${sequence}`, `ajeno-${galleryIndex}-${sequence}.jpg`))
      );
    });
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow('la imagen de la variante no coincide con la portada de su galería de color');
  });

  test('el runtime también falla si un producto con Color no tiene color_galleries', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.filter((item) =>
      item?.key !== SHOPIFY_COLOR_GALLERIES_METAFIELD.key
    );
    expectMappingError(payload, `metafields.${SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER}`);
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow(`metafields.${SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER}`);
  });

  test('el runtime también falla si color_galleries llega con tipo incorrecto', () => {
    const payload = validPayload();
    payload.products[0].metafields = payload.products[0].metafields.map((item) =>
      item?.key === SHOPIFY_COLOR_GALLERIES_METAFIELD.key ? { ...item, type: 'single_line_text_field' } : item
    );
    expect(() => mapShopifyProduct(payload.products[0], HOSTS))
      .toThrow('se esperaba list.metaobject_reference');
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

  test('rechaza IDs de Image que no sean GID Shopify', () => {
    const payload = validPayload();
    payload.products[0].images.nodes[0].id = 'image-local-1';
    expectMappingError(payload, 'se esperaba un GID Shopify de imagen');
  });

  test('acepta ImageSource, el recurso real de Image en referencias MediaImage', () => {
    const payload = validPayload();
    const referencedImage = galleryImagesOf(payload).references.nodes[0].image;
    const previousId = referencedImage.id;
    const imageSourceId = 'gid://shopify/ImageSource/real-storefront-image-1';
    galleryImagesOf(payload).references.nodes[0].image = { ...referencedImage, id: imageSourceId };
    const product = mapShopifyCatalog(payload, HOSTS).products[0];

    expect(product.mediaGroups[0].imageIds[0]).toBe(previousId);
    expect(product.images.filter((image) => image.url === referencedImage.url)).toHaveLength(1);
    expect(product.images.some((image) => image.id === imageSourceId)).toBe(false);
  });

  test('un width_mm presente pero inválido falla en vez de omitir la especificación', () => {
    const payload = validPayload();
    payload.products[0].metafields.find((item) => item?.key === 'width_mm').value = '35.5';
    expectMappingError(payload, 'width_mm.value');
    expectMappingError(payload, 'entero positivo');
  });

  test('un metafield color_galleries vacío falla', () => {
    const payload = validPayload();
    const metafieldNode = galleriesOf(payload);
    metafieldNode.value = '[]';
    metafieldNode.references = { nodes: [], pageInfo };
    expectMappingError(payload, 'debe contener exactamente una galería por cada valor de Color');
  });

  test('referencias de galería no resueltas por Storefront fallan de forma explícita', () => {
    const payload = validPayload();
    galleriesOf(payload).references = null;
    expectMappingError(payload, 'las referencias de galería no llegan por Storefront');
  });

  test('un color_galleries con tipo incorrecto falla', () => {
    const payload = validPayload();
    galleriesOf(payload).type = 'json';
    expectMappingError(payload, 'se esperaba list.metaobject_reference');
  });

  test('una referencia que no es Metaobject falla', () => {
    const payload = validPayload();
    galleriesOf(payload).references.nodes[0] = {
      __typename: 'MediaImage',
      id: 'gid://shopify/MediaImage/1',
      image: image('cuero-1'),
    };
    expectMappingError(payload, 'la referencia no es un metaobject de galería publicado');
  });

  test('un metaobject de otro type falla aunque sus fields coincidan', () => {
    const payload = validPayload();
    galleriesOf(payload).references.nodes[0].type = 'otra_definicion';
    expectMappingError(payload, `se esperaba ${SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE}`);
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
    galleryField(galleriesOf(payload).references.nodes[1], 'color_value').value = '   ';
    expectMappingError(payload, 'color_value.value');
  });

  test('falta color_value falla', () => {
    const payload = validPayload();
    const gallery = galleriesOf(payload).references.nodes[0];
    gallery.fields = gallery.fields.filter((field) => field.key !== 'color_value');
    expectMappingError(payload, 'color_value');
  });

  test('color_value con tipo incorrecto falla', () => {
    const payload = validPayload();
    galleryField(galleriesOf(payload).references.nodes[0], 'color_value').type = 'number_integer';
    expectMappingError(payload, 'se esperaba single_line_text_field');
  });

  test('normaliza color_value solo para compararlo con el valor de la opción', () => {
    const payload = validPayload();
    galleryField(galleriesOf(payload).references.nodes[2], 'color_value').value = ' negro ';
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    const negro = product.options.find((option) => option.purpose === 'color')
      ?.values.find((value) => value.label === 'Negro');
    expect(product.mediaGroups.find((group) => group.optionValueId === negro.id)?.imageIds)
      .toEqual(colorImages('Negro').map((item) => item.id));
  });

  test('falta images falla', () => {
    const payload = validPayload();
    const gallery = galleriesOf(payload).references.nodes[0];
    gallery.fields = gallery.fields.filter((field) => field.key !== 'images');
    expectMappingError(payload, '.images');
  });

  test('images con tipo incorrecto falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).type = 'list.metaobject_reference';
    expectMappingError(payload, 'se esperaba list.file_reference');
  });

  test('falla si una galería tiene dos imágenes', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes = galleryImagesOf(payload).references.nodes.slice(0, 2);
    expectMappingError(payload, `debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes`);
  });

  test('falla si una galería tiene cuatro imágenes', () => {
    const payload = validPayload();
    const extra = image('cuero-4');
    payload.products[0].images.nodes.push(extra);
    galleryImagesOf(payload).references.nodes.push(mediaImage(extra));
    expectMappingError(payload, `debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes`);
  });

  test('una galería con exactamente COLOR_GALLERY_IMAGE_COUNT MediaImage válidas pasa', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    expect(product.mediaGroups.every((group) => group.imageIds.length === COLOR_GALLERY_IMAGE_COUNT)).toBe(true);
  });

  test('falla si una galería repite una imagen', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[1] = galleryImagesOf(payload).references.nodes[0];
    expectMappingError(payload, 'está repetida en la galería');
  });

  test('falla si una referencia de images no es MediaImage', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[0] = {
      __typename: 'GenericFile',
      id: 'gid://shopify/GenericFile/1',
      url: 'https://cdn.shopify.com/s/files/nota.pdf',
    };
    expectMappingError(payload, 'la referencia no es una MediaImage publicada');
  });

  test('Video u otro tipo de media en images falla', () => {
    const payload = validPayload();
    galleryImagesOf(payload).references.nodes[1] = {
      __typename: 'Video',
      id: 'gid://shopify/Video/1',
    };
    expectMappingError(payload, 'la referencia no es una MediaImage publicada');
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

  test('el orden del metaobject se conserva y la primera imagen es la portada', () => {
    const payload = validPayload();
    const cuero = [...colorImages('Cuero')].reverse();
    galleryImagesOf(payload, 0).references.nodes = cuero.map(mediaImage);
    payload.products[0].variants.nodes.forEach((item) => {
      if (item.selectedOptions.some((selection) => selection.value === 'Cuero')) {
        item.image = cuero[0];
      }
    });
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.mediaGroups[0].imageIds).toEqual(cuero.map((item) => item.id));
    expect(product.primaryImageId).toBe(cuero[0].id);
    product.variants
      .filter((item) => item.optionValues.some((selection) =>
        selection.valueId === product.mediaGroups[0].optionValueId
      ))
      .forEach((item) => expect(item.imageId).toBe(cuero[0].id));
  });

  test('acepta el identificador real del tipo de metaobject configurado en Shopify', () => {
    const payload = validPayload();
    galleriesOf(payload).references.nodes[0].type = SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE;
    expect(mapShopifyCatalog(payload, HOSTS).products[0].mediaGroups).toHaveLength(3);
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

  test('mediaGroup.id procede del metaobject y todos los imageIds existen en Product.images', () => {
    const product = mapShopifyCatalog(validPayload(), HOSTS).products[0];
    expect(product.mediaGroups.map((group) => group.id)).toEqual(
      COLORS.map((color) => `gid://shopify/Metaobject/${color.id}`)
    );
    expect(
      product.mediaGroups
        .flatMap((group) => group.imageIds)
        .every((id) => product.images.some((item) => item.id === id))
    ).toBe(true);
    const ids = product.images.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('incorpora en Product.images las MediaImage referenciadas y no duplica por ID', () => {
    const payload = validPayload();
    const foreign = image('ajena-1');
    galleryImagesOf(payload).references.nodes[2] = mediaImage(foreign);
    const missingFromProduct = colorImages('Cuero')[2];
    payload.products[0].images.nodes = payload.products[0].images.nodes.filter(
      (item) => item.id !== missingFromProduct.id
    );
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    expect(product.images.filter((item) => item.id === foreign.id)).toHaveLength(1);
    expect(product.mediaGroups[0].imageIds[2]).toBe(foreign.id);
    expect(product.images.filter((item) => item.id === missingFromProduct.id)).toHaveLength(0);
    const ids = product.images.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
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

  test('el metaobject es la autoridad aunque los filenames nombren otros colores', () => {
    const negroImages = [
      image('negro-portada', 'marron-producto-01.jpg'),
      image('negro-detalle', 'random-8472.jpg'),
      image('negro-contexto', 'azul-final.jpg'),
    ];
    const payload = validPayload();
    const negroGallery = galleriesOf(payload).references.nodes.find((item) =>
      galleryField(item, 'color_value').value === 'Negro'
    );
    galleryField(negroGallery, 'images').references.nodes = negroImages.map(mediaImage);
    payload.products[0].images.nodes = payload.products[0].images.nodes
      .filter((item) => !colorImages('Negro').some((imageItem) => imageItem.id === item.id))
      .concat(negroImages);
    payload.products[0].variants.nodes.forEach((item) => {
      if (item.selectedOptions.some((selection) => selection.value === 'Negro')) {
        item.image = negroImages[0];
      }
    });
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    const negro = product.options.find((option) => option.purpose === 'color')
      ?.values.find((value) => value.label === 'Negro');
    expect(product.mediaGroups.find((group) => group.optionValueId === negro.id)?.imageIds)
      .toEqual(negroImages.map((item) => item.id));
  });

  test('una imagen cuyo filename nombra un color no entra en esa galería si el metaobject no la referencia', () => {
    const payload = validPayload();
    const stray = image('negro-ajeno', 'negro-detalle.jpg');
    payload.products[0].images.nodes.push(stray);
    const product = mapShopifyCatalog(payload, HOSTS).products[0];
    const negro = product.options.find((option) => option.purpose === 'color')
      ?.values.find((value) => value.label === 'Negro');
    const negroGroup = product.mediaGroups.find((group) => group.optionValueId === negro.id);
    expect(negroGroup.imageIds).toEqual(colorImages('Negro').map((item) => item.id));
    expect(negroGroup.imageIds).not.toContain(stray.id);
  });

  test('getProductByHandle carga color_galleries y los summaries no descargan las galerías', () => {
    expect(FULL_PRODUCT_FIELDS).toContain(colorGalleriesQueryKey);
    expect(FULL_PRODUCT_FIELDS).toContain('... on MediaImage');
    expect(PRODUCT_SUMMARY_FIELDS).not.toContain('color_galleries');
    expect(PRODUCT_SUMMARY_FIELDS).not.toContain('... on MediaImage');
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
    expect(calls[0].query).toContain(colorGalleriesQueryNamespace);
    expect(calls[0].query).toContain(colorGalleriesQueryKey);
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
    expect(FULL_PRODUCT_FIELDS).toContain(colorGalleriesQueryNamespace);
    expect(FULL_PRODUCT_FIELDS).toContain(colorGalleriesQueryKey);
    expect(FULL_PRODUCT_FIELDS).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"color_galleries"/);
    expect(PRODUCT_SUMMARY_FIELDS).toContain(primaryCollectionQueryNamespace);
    expect(PRODUCT_SUMMARY_FIELDS).toContain(primaryCollectionQueryKey);
    expect(PRODUCT_SUMMARY_FIELDS).not.toMatch(/namespace:\s*"kingbelt",\s*key:\s*"primary_collection"/);
    expect(PRODUCT_SUMMARY_FIELDS).toContain('namespace: "kingbelt", key: "model_reference"');
    expect(PRODUCT_SUMMARY_FIELDS).toContain('reference');
    expect(PRODUCT_SUMMARY_FIELDS).toContain('... on Collection { id handle title }');
    expect(PRODUCT_SUMMARY_FIELDS).not.toMatch(/collections\s*\(/);
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
