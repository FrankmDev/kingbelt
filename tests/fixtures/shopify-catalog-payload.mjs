import {
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
} from '../../src/commerce/infrastructure/shopify/config.ts';

// Datos legacy deliberadamente presentes para comprobar que el mapper los ignora.
export const SHOPIFY_COLOR_GALLERIES_METAFIELD = {
  namespace: 'custom',
  key: 'kingbelt_color_galleries',
  type: 'list.metaobject_reference',
};
export const SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER =
  'custom.kingbelt_color_galleries';
export const SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE = 'galerias_por_color';

export const pageInfo = { hasNextPage: false, endCursor: null };
export const SHOPIFY_CATALOG_TEST_HOSTS = ['cdn.shopify.com'];
export const COLORS = [
  { id: '1', name: 'Cuero' },
  { id: '2', name: 'Marrón' },
  { id: '3', name: 'Negro' },
];
export const SIZES = [
  { id: '10', name: '90' },
  { id: '11', name: '95' },
];

export const image = (id, filename = `${id}.jpg`) => ({
  id: `gid://shopify/ProductImage/${id}`,
  url: `https://cdn.shopify.com/s/files/${filename}`,
  altText: `Cinturón Atlas, ${id}`,
  width: 1200,
  height: 1500,
});

export const colorImages = (colorName) => {
  const slug = colorName.toLocaleLowerCase('es');
  const colorToken = colorName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es')
    .replace(/[^A-Z0-9]+/g, '_');
  return [1, 2, 3].map((sequence) =>
    image(`${slug}-${sequence}`, `5365-35_${colorToken}_${String(sequence).padStart(2, '0')}.jpg`)
  );
};

export const metafield = (key, type, value) => ({
  namespace: 'kingbelt',
  key,
  type,
  value,
  reference: null,
  references: null,
});

export const mediaImage = (productImage) => ({
  __typename: 'MediaImage',
  id: `gid://shopify/MediaImage/${productImage.id.split('/').at(-1)}`,
  image: productImage,
});

export const colorGallery = (color, images, type = SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE) => ({
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

export const colorGalleriesMetafield = (references) => ({
  namespace: SHOPIFY_COLOR_GALLERIES_METAFIELD.namespace,
  key: SHOPIFY_COLOR_GALLERIES_METAFIELD.key,
  type: SHOPIFY_COLOR_GALLERIES_METAFIELD.type,
  value: JSON.stringify(references.map((item) => item.id)),
  reference: null,
  references: { nodes: references, pageInfo },
});

export const sportCollectionImage = {
  id: 'gid://shopify/CollectionImage/123456789',
  url: 'https://cdn.shopify.com/s/files/sport-collection.jpg',
  altText: 'Sport',
  width: 1200,
  height: 1500,
};

export const sportCollection = {
  id: 'gid://shopify/Collection/1',
  handle: 'sport',
  title: 'Sport',
  description: 'Cinturones de piel para uso diario.',
  image: sportCollectionImage,
};

export const casualCollection = {
  id: 'gid://shopify/Collection/2',
  handle: 'casual',
  title: 'Casual',
  description: 'Cinturones de uso diario.',
  image: null,
};

export const novedadesCollection = {
  id: 'gid://shopify/Collection/3',
  handle: 'novedades',
  title: 'Novedades',
  description: 'Últimas piezas.',
  image: null,
};

export const cueroCollection = {
  id: 'gid://shopify/Collection/4',
  handle: 'cuero',
  title: 'Cuero',
  description: 'Piezas de cuero.',
  image: null,
};

export const primaryCollectionMetafield = (collection) => ({
  namespace: SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace,
  key: SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key,
  type: SHOPIFY_PRIMARY_COLLECTION_METAFIELD.type,
  value: collection.id,
  reference: {
    __typename: 'Collection',
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
  },
  references: null,
});

export const legacyPrimaryCollectionMetafield = (collection) => ({
  namespace: 'kingbelt',
  key: 'primary_collection',
  type: 'collection_reference',
  value: collection.id,
  reference: {
    __typename: 'Collection',
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
  },
  references: null,
});

export const kingbeltMetafields = (galleries, primaryCollection = sportCollection) => [
  metafield('model_reference', 'single_line_text_field', 'ATLAS-35'),
  metafield('summary', 'multi_line_text_field', 'Piel y construcción artesanal.'),
  metafield('material', 'single_line_text_field', 'Piel'),
  metafield('width_mm', 'number_integer', '35'),
  metafield('buckle_finish', 'single_line_text_field', 'Níquel satinado'),
  primaryCollectionMetafield(primaryCollection),
  null,
  colorGalleriesMetafield(galleries),
];

export const variant = ({ id, color, size, sku, image: variantImage }) => ({
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

export const validShopifyCatalogPayload = ({ galleryOrder = COLORS } = {}) => {
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
    collections: [{ ...sportCollection }],
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
        nodes: [{ id: sportCollection.id, handle: sportCollection.handle, title: sportCollection.title }],
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
      metafields: kingbeltMetafields(galleries, sportCollection),
    }],
  };
};

export const productWithoutColorPayload = () => {
  const images = [image('unica-1')];
  return {
    collections: [{ ...sportCollection }],
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
        nodes: [{ id: sportCollection.id, handle: sportCollection.handle, title: sportCollection.title }],
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
          id: `gid://shopify/ProductVariant/90`,
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
        primaryCollectionMetafield(sportCollection),
      ],
    }],
  };
};

export const galleriesOf = (payload) =>
  payload.products[0].metafields.find((item) =>
    item?.namespace === SHOPIFY_COLOR_GALLERIES_METAFIELD.namespace
    && item?.key === SHOPIFY_COLOR_GALLERIES_METAFIELD.key
  );

export const galleryField = (gallery, key) =>
  gallery.fields.find((field) => field.key === key);

export const galleryImagesOf = (payload, index = 0) =>
  galleryField(galleriesOf(payload).references.nodes[index], 'images');

export const primaryCollectionOf = (payload) =>
  payload.products[0].metafields.find((item) =>
    item?.namespace === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace
    && item.key === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
  );

export const assignProductCollections = (payload, collections, primaryCollection) => {
  payload.collections = collections.map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    description: collection.description ?? collection.title,
    image: collection.image ?? null,
  }));
  payload.products[0].collections = {
    nodes: collections.map(({ id, handle, title }) => ({ id, handle, title })),
    pageInfo,
  };
  const metafields = payload.products[0].metafields.filter((item) =>
    item?.key !== SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
  );
  const galleriesIndex = metafields.findIndex((item) =>
    item?.key === SHOPIFY_COLOR_GALLERIES_METAFIELD.key
  );
  metafields.splice(
    galleriesIndex >= 0 ? galleriesIndex : metafields.length,
    0,
    primaryCollectionMetafield(primaryCollection)
  );
  payload.products[0].metafields = metafields;
  return payload;
};

export const productSummaryNode = (product, { availableForSale = true } = {}) => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  description: product.description,
  productType: product.productType,
  availableForSale,
  featuredImage: product.featuredImage,
  collections: product.collections,
  options: product.options,
  priceRange: {
    minVariantPrice: product.variants.nodes[0].price,
    maxVariantPrice: product.variants.nodes.at(-1).price,
  },
  metafields: (product.metafields ?? []).filter((item) =>
    item && ['model_reference', 'summary', 'badge', SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key].includes(item.key)
  ),
});
