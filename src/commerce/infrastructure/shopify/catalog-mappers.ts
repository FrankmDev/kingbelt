import { resolveColorSwatch } from '../../domain/color-swatch';
import {
  assertValidCatalog,
  assertValidCollections,
  assertValidProductSummary,
} from '../../application/catalog-validation';
import {
  COLOR_GALLERY_IMAGE_COUNT,
  type Collection,
  type Product,
  type ProductImage,
  type ProductOption,
  type ProductSummary,
  type ProductVariant,
  type ProductWeight,
} from '../../domain/catalog';
import { productId, sku, variantId } from '../../domain/identifiers';
import { moneyFromDecimal } from '../../domain/money';
import type {
  ShopifyCatalogPayload,
  ShopifyCollectionNode,
  ShopifyCollectionReferenceNode,
  ShopifyConnection,
  ShopifyImageNode,
  ShopifyMetafieldNode,
  ShopifyMetafieldReferenceNode,
  ShopifyProductNode,
  ShopifyProductSummaryNode,
} from './catalog-query';
import { SHOPIFY_SUPPORTED_CURRENCIES } from './config';

export interface ShopifyCatalog {
  products: Product[];
  collections: Collection[];
}

export class ShopifyCatalogMappingError extends Error {
  readonly name = 'ShopifyCatalogMappingError';
}

const fail = (path: string, message: string): never => {
  throw new ShopifyCatalogMappingError(`Catálogo Shopify inválido en ${path}: ${message}`);
};

const required = <T>(
  value: T | null | undefined,
  path: string,
  message: string
): T => value ?? fail(path, message);

const requiredText = (value: string | null | undefined, path: string): string => {
  const normalized = value?.trim() ?? '';
  if (!normalized) fail(path, 'falta un texto obligatorio.');
  return normalized;
};

const optionalText = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim() ?? '';
  return normalized || undefined;
};

const mapImage = (
  image: ShopifyImageNode,
  path: string,
  fallbackAlt: string
): ProductImage => ({
  id: requiredText(image.id, `${path}.id`),
  url: requiredText(image.url, `${path}.url`),
  altText: optionalText(image.altText) ?? requiredText(fallbackAlt, `${path}.altText`),
  width: image.width ?? fail(`${path}.width`, 'falta la anchura.'),
  height: image.height ?? fail(`${path}.height`, 'falta la altura.'),
});

type ShopifyMetafieldSource = Pick<ShopifyProductNode, 'handle' | 'metafields'>;
type ShopifyOptionSource = Pick<ShopifyProductNode, 'handle' | 'options'>;

function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField: true
): ShopifyMetafieldNode;
function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField?: boolean
): ShopifyMetafieldNode | undefined;
function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField = true
): ShopifyMetafieldNode | undefined {
  const metafield = product.metafields.find((candidate) =>
    candidate?.namespace === 'kingbelt' && candidate.key === key
  ) ?? undefined;
  if (!metafield) {
    if (requiredField) {
      fail(
        `${product.handle}.metafields.kingbelt.${key}`,
        'no llega por Storefront. Publica la definición con Storefront access = Read, rellena el valor en el producto y mantén el scope unauthenticated_read_metaobjects.'
      );
    }
    return undefined;
  }
  if (metafield.type !== expectedType) {
    fail(`${product.handle}.metafields.kingbelt.${key}`, `tipo ${metafield.type}; se esperaba ${expectedType}.`);
  }
  return metafield;
}

const metafieldText = (
  product: ShopifyMetafieldSource,
  key: string,
  type: string,
  requiredField = true
): string | undefined => {
  const metafield = metafieldByKey(product, key, type, requiredField);
  return metafield
    ? requiredText(metafield.value, `${product.handle}.metafields.kingbelt.${key}.value`)
    : undefined;
};

const PRIMARY_COLLECTION_KEY = 'primary_collection';
const PRIMARY_COLLECTION_TYPE = 'collection_reference';

type ShopifyPrimaryCollectionSource = ShopifyMetafieldSource & {
  collections: ShopifyConnection<{ id: string; handle?: string; title?: string }>;
};

const isShopifyCollectionReference = (
  node: ShopifyMetafieldReferenceNode | null | undefined
): node is ShopifyCollectionReferenceNode =>
  Boolean(
    node
    && node.__typename === 'Collection'
    && typeof node.id === 'string'
    && node.id.trim()
  );

const failPrimaryCollection = (handle: string, detail: string): never => {
  throw new ShopifyCatalogMappingError(`Product "${handle}":\n${detail}`);
};

/**
 * `Product.primaryCollectionId` sale de `kingbelt.primary_collection`.
 * El orden de `product.collections` no es autoridad: si el metafield falta,
 * solo una colección publicada es inequívoca.
 */
const mapPrimaryCollectionReference = (
  source: ShopifyPrimaryCollectionSource
): { id: string; handle: string; title: string } => {
  const handle = requiredText(source.handle, `${source.handle || 'product'}.handle`);
  const metafield = source.metafields.find((candidate) =>
    candidate?.namespace === 'kingbelt' && candidate.key === PRIMARY_COLLECTION_KEY
  );

  if (!metafield) {
    const assigned = source.collections.nodes.filter((collection) => collection.id?.trim());
    const only = assigned.length === 1 ? assigned.at(0) : undefined;
    if (only) {
      return {
        id: requiredText(only.id, `${handle}.collections.id`),
        handle: requiredText(only.handle, `${handle}.collections.handle`),
        title: requiredText(only.title, `${handle}.collections.title`),
      };
    }
    return failPrimaryCollection(
      handle,
      assigned.length > 1
        ? 'kingbelt.primary_collection is missing and the product belongs to multiple collections'
        : 'kingbelt.primary_collection is missing'
    );
  }

  if (metafield.type !== PRIMARY_COLLECTION_TYPE) {
    failPrimaryCollection(
      handle,
      `kingbelt.primary_collection has type ${metafield.type}; expected ${PRIMARY_COLLECTION_TYPE}`
    );
  }

  const value = metafield.value?.trim() ?? '';
  const referenced = metafield.reference;
  const reference = isShopifyCollectionReference(referenced)
    ? referenced
    : failPrimaryCollection(
        handle,
        !referenced && !value
          ? 'kingbelt.primary_collection is empty'
          : !referenced
            ? `primary collection "${value}" does not exist`
            : 'kingbelt.primary_collection does not reference a Collection'
      );

  const id = requiredText(
    reference.id,
    `${handle}.metafields.kingbelt.${PRIMARY_COLLECTION_KEY}.id`
  );
  const collectionHandle = requiredText(
    reference.handle,
    `${handle}.metafields.kingbelt.${PRIMARY_COLLECTION_KEY}.handle`
  );
  const title = requiredText(
    reference.title,
    `${handle}.metafields.kingbelt.${PRIMARY_COLLECTION_KEY}.title`
  );
  const assigned = source.collections.nodes.some((collection) => collection.id === id);
  if (!assigned) {
    failPrimaryCollection(
      handle,
      `primary collection "${collectionHandle}" is not assigned to this product`
    );
  }

  return { id, handle: collectionHandle, title };
};

const normalizeOptionName = (value: string): string =>
  value.trim().toLocaleLowerCase('es');

const optionPurpose = (name: string): ProductOption['purpose'] => {
  const normalized = normalizeOptionName(name);
  if (normalized === 'color') return 'color';
  if (normalized === 'talla' || normalized === 'tamaño' || normalized === 'tamano') return 'size';
  return undefined;
};

const mapOptions = (product: ShopifyOptionSource): ProductOption[] =>
  product.options.map((option, optionIndex) => ({
    id: requiredText(option.id, `${product.handle}.options[${optionIndex}].id`),
    name: requiredText(option.name, `${product.handle}.options[${optionIndex}].name`),
    purpose: optionPurpose(option.name),
    values: option.optionValues.map((value, valueIndex) => {
      const label = requiredText(value.name, `${product.handle}.options[${optionIndex}].values[${valueIndex}].name`);
      const shopifySwatch = optionalText(value.swatch?.color);
      const purpose = optionPurpose(option.name);
      return {
        id: requiredText(value.id, `${product.handle}.options[${optionIndex}].values[${valueIndex}].id`),
        label,
        ...(purpose === 'color' ? { swatch: resolveColorSwatch(label, shopifySwatch) } : {}),
      };
    }),
  }));

const mapWeightUnit = (unit: string): ProductWeight['unit'] => {
  switch (unit) {
    case 'GRAMS': return 'g';
    case 'KILOGRAMS': return 'kg';
    case 'OUNCES': return 'oz';
    case 'POUNDS': return 'lb';
    default: return fail('variant.weightUnit', `unidad no soportada: ${unit}.`);
  }
};

const mapVariants = (
  product: ShopifyProductNode,
  options: ProductOption[],
  mediaGroups: Product['mediaGroups']
): ProductVariant[] => {
  const optionsByName = new Map(options.map((option) => [normalizeOptionName(option.name), option]));
  const colorOption = options.find((option) => option.purpose === 'color');
  const colorImageByValue = new Map(
    mediaGroups.map((group) => [group.optionValueId, group.imageIds[0]])
  );
  return product.variants.nodes.map((variant, variantIndex) => {
    const path = `${product.handle}.variants[${variantIndex}]`;
    const optionHint = variant.selectedOptions
      .flatMap((selection) => {
        const name = optionalText(selection.name);
        const value = optionalText(selection.value);
        return name && value ? [`${name}: ${value}`] : [];
      })
      .join(', ');
    const mappedSku = sku(requiredText(
      variant.sku,
      optionHint ? `${path}.sku (${optionHint})` : `${path}.sku`
    ));
    const price = moneyFromDecimal(variant.price.amount, variant.price.currencyCode);
    const compareAtPrice = variant.compareAtPrice
      ? moneyFromDecimal(variant.compareAtPrice.amount, variant.compareAtPrice.currencyCode)
      : undefined;
    const optionValues = variant.selectedOptions.map((selection, selectionIndex) => {
      const option = required(
        optionsByName.get(normalizeOptionName(selection.name)),
        `${path}.selectedOptions[${selectionIndex}]`,
        `opción desconocida: ${selection.name}.`
      );
      const value = required(option.values.find((candidate) =>
        normalizeOptionName(candidate.label) === normalizeOptionName(selection.value)
      ), `${path}.selectedOptions[${selectionIndex}]`, `valor desconocido: ${selection.value}.`);
      return { optionId: option.id, valueId: value.id };
    });
    const colorValueId = colorOption
      ? optionValues.find((selection) => selection.optionId === colorOption.id)?.valueId
      : undefined;
    if (colorOption && !colorValueId) {
      fail(`${path}.selectedOptions`, 'la variante no selecciona un color.');
    }
    const expectedColorImageId = colorValueId ? colorImageByValue.get(colorValueId) : undefined;
    const actualImageId = optionalText(variant.image?.id);
    if (colorValueId) {
      if (!expectedColorImageId) {
        fail(`${path}.image`, 'la variante tiene un color sin galería.');
      }
      if (!actualImageId) {
        fail(`${path}.image`, 'la variante debe tener asignada la imagen principal de su color.');
      }
      if (actualImageId !== expectedColorImageId) {
        fail(`${path}.image`, 'la imagen de la variante no coincide con la portada de su galería de color.');
      }
    }
    const imageId = expectedColorImageId ?? actualImageId;

    return {
      id: variantId(requiredText(variant.id, `${path}.id`)),
      sku: mappedSku,
      title: optionalText(variant.title),
      optionValues,
      price,
      ...(compareAtPrice && compareAtPrice.amountMinor > price.amountMinor
        ? { compareAtPrice }
        : {}),
      salesStatus: variant.availableForSale ? 'active' : 'unavailable',
      inventory: { kind: 'unknown' },
      inventoryPolicy: variant.currentlyNotInStock ? 'continue' : 'deny',
      quantityRule: {
        minimum: variant.quantityRule.minimum,
        increment: variant.quantityRule.increment,
        ...(variant.quantityRule.maximum === null ? {} : { maximum: variant.quantityRule.maximum }),
      },
      ...(imageId ? { imageId } : {}),
      ...(variant.weight > 0
        ? { weight: { value: variant.weight, unit: mapWeightUnit(variant.weightUnit) } }
        : {}),
    };
  });
};

const mergeImagesById = (
  primary: readonly ProductImage[],
  extra: readonly ProductImage[]
): ProductImage[] => {
  const images = [...primary];
  const seen = new Set(primary.map((image) => image.id));
  extra.forEach((image) => {
    if (seen.has(image.id)) return;
    seen.add(image.id);
    images.push(image);
  });
  return images;
};

const declaredMetafieldValue = (value: string | null | undefined): boolean => {
  const normalized = value?.trim() ?? '';
  return Boolean(normalized) && normalized !== '[]';
};

const mapRequiredColorGalleries = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  productTitle: string
): { mediaGroups: Product['mediaGroups']; images: ProductImage[] } => {
  const metafield = metafieldByKey(
    product,
    'color_galleries',
    'list.metaobject_reference',
    true
  );
  const references = metafield.references;
  if (!references?.nodes.length) {
    fail(
      `${product.handle}.metafields.kingbelt.color_galleries`,
      declaredMetafieldValue(metafield.value)
        ? 'las referencias de galería no llegan por Storefront. Publica la definición y los metaobjects con Storefront access = Read y mantén el scope unauthenticated_read_metaobjects.'
        : 'debe contener exactamente una galería por cada valor de Color.'
    );
  }
  const galleryReferences = required(
    references,
    `${product.handle}.metafields.kingbelt.color_galleries`,
    'debe contener exactamente una galería por cada valor de Color.'
  );

  if (galleryReferences.pageInfo.hasNextPage) {
    fail(`${product.handle}.metafields.kingbelt.color_galleries.references`, 'supera el límite de 250 referencias.');
  }

  const groupsByColorValueId = new Map<string, Product['mediaGroups'][number]>();
  const galleryImages: ProductImage[] = [];
  galleryReferences.nodes.forEach((reference, referenceIndex) => {
    const path = `${product.handle}.metafields.kingbelt.color_galleries[${referenceIndex}]`;
    if (
      reference.__typename !== 'Metaobject' ||
      !reference.fields
    ) {
      fail(path, 'la referencia no es un metaobject de galería publicado.');
    }
    const fields = required(reference.fields, path, 'faltan los campos del metaobject.');
    const colorField = required(
      fields.find((field) => field.key === 'color_value'),
      `${path}.color_value`,
      'falta el campo single_line_text_field.'
    );
    if (colorField.type !== 'single_line_text_field') {
      fail(`${path}.color_value`, `tipo ${colorField.type}; se esperaba single_line_text_field.`);
    }
    const colorLabel = requiredText(colorField.value, `${path}.color_value.value`);
    const colorValue = required(colorOption.values.find((value) =>
      normalizeOptionName(value.label) === normalizeOptionName(colorLabel)
    ), `${path}.color_value`, `el color ${colorLabel} no existe en la opción Color.`);
    if (groupsByColorValueId.has(colorValue.id)) {
      fail(`${path}.color_value`, `el color ${colorLabel} tiene más de una galería.`);
    }

    const imagesField = required(
      fields.find((field) => field.key === 'images'),
      `${path}.images`,
      'falta el campo list.file_reference.'
    );
    if (imagesField.type !== 'list.file_reference' || !imagesField.references) {
      fail(
        `${path}.images`,
        imagesField.type !== 'list.file_reference'
          ? `tipo ${imagesField.type}; se esperaba list.file_reference.`
          : 'falta el campo list.file_reference.'
      );
    }
    const imageReferences = required(imagesField.references, `${path}.images`, 'faltan las referencias de imagen.');
    if (imageReferences.pageInfo.hasNextPage) {
      fail(`${path}.images`, 'supera el límite de 250 referencias.');
    }
    if (imageReferences.nodes.length !== COLOR_GALLERY_IMAGE_COUNT) {
      fail(
        `${path}.images`,
        `debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes.`
      );
    }
    const seenImageIds = new Set<string>();
    const imageIds = imageReferences.nodes.map((imageReference, imageIndex) => {
      const imagePath = `${path}.images[${imageIndex}]`;
      if (imageReference.__typename !== 'MediaImage' || !imageReference.image) {
        fail(imagePath, 'la referencia no es una MediaImage publicada.');
      }
      const image = mapImage(
        required(imageReference.image, imagePath, 'falta la imagen publicada.'),
        imagePath,
        productTitle
      );
      if (seenImageIds.has(image.id)) {
        fail(imagePath, `la imagen ${image.id} está repetida en la galería.`);
      }
      seenImageIds.add(image.id);
      galleryImages.push(image);
      return image.id;
    });
    groupsByColorValueId.set(colorValue.id, {
      id: requiredText(reference.id, `${path}.id`),
      optionValueId: colorValue.id,
      imageIds,
    });
  });

  return {
    mediaGroups: colorOption.values.map((value) =>
      required(
        groupsByColorValueId.get(value.id),
        `${product.handle}.metafields.kingbelt.color_galleries`,
        `el color ${value.label} no tiene una galería asociada.`
      )
    ),
    images: galleryImages,
  };
};

const mapSpecifications = (source: ShopifyProductNode): Product['specifications'] => {
  const material = metafieldText(source, 'material', 'single_line_text_field', false);
  const width = metafieldText(source, 'width_mm', 'number_integer', false);
  const buckle = metafieldText(source, 'buckle_finish', 'single_line_text_field', false);
  const specifications = [
    ...(material ? [{ label: 'Material', value: material }] : []),
    ...(width && Number.isSafeInteger(Number(width)) && Number(width) > 0
      ? [{ label: 'Ancho', value: `${Number(width)} mm` }]
      : []),
    ...(buckle ? [{ label: 'Hebilla/acabado', value: buckle }] : []),
  ];
  return specifications;
};

const mapProduct = (source: ShopifyProductNode): Product => {
  const path = source.handle || source.id || 'product';
  const title = requiredText(source.title, `${path}.title`);
  const options = mapOptions(source);
  const productImages = source.images.nodes.map((image, index) =>
    mapImage(image, `${path}.images[${index}]`, title)
  );
  const colorOption = options.find((option) => option.purpose === 'color');
  const galleries = colorOption
    ? mapRequiredColorGalleries(source, colorOption, title)
    : { mediaGroups: [], images: [] };
  const mediaGroups = galleries.mediaGroups;
  const images = mergeImagesById(productImages, galleries.images);
  const primaryCollectionId = mapPrimaryCollectionReference(source).id;
  const badge = metafieldText(source, 'badge', 'single_line_text_field', false);
  const seoTitle = optionalText(source.seo.title);
  const seoDescription = optionalText(source.seo.description);
  const description = requiredText(source.description, `${path}.description`);
  const firstColorImageId = mediaGroups[0]?.imageIds[0];

  return {
    id: productId(requiredText(source.id, `${path}.id`)),
    reference: metafieldText(source, 'model_reference', 'single_line_text_field', false)
      ?? requiredText(source.handle, `${path}.handle`),
    handle: requiredText(source.handle, `${path}.handle`),
    title,
    description,
    summary: metafieldText(source, 'summary', 'multi_line_text_field', false) ?? description,
    vendor: requiredText(source.vendor, `${path}.vendor`),
    productType: requiredText(source.productType, `${path}.productType`),
    category: {
      id: requiredText(source.category?.id, `${path}.category.id`),
      name: requiredText(source.category?.name, `${path}.category.name`),
    },
    publicationStatus: source.publishedAt ? 'published' : 'unpublished',
    primaryCollectionId,
    collectionIds: source.collections.nodes.map((collection) => collection.id),
    ...(badge ? { badge } : {}),
    options,
    variants: mapVariants(source, options, mediaGroups),
    images,
    primaryImageId: firstColorImageId
      ?? requiredText(source.featuredImage?.id, `${path}.featuredImage.id`),
    mediaGroups,
    specifications: mapSpecifications(source),
    seo: {
      ...(seoTitle ? { title: seoTitle } : {}),
      ...(seoDescription ? { description: seoDescription } : {}),
    },
  };
};

export const mapShopifyCollection = (
  collection: ShopifyCollectionNode,
  index = 0
): Collection => {
  const title = requiredText(collection.title, `collections[${index}].title`);
  return {
    id: requiredText(collection.id, `collections[${index}].id`),
    handle: requiredText(collection.handle, `collections[${index}].handle`),
    title,
    description: optionalText(collection.description) ?? title,
    ...(collection.image
      ? { image: mapImage(collection.image, `collections[${index}].image`, title) }
      : {}),
  };
};

const collectionStubsFromProduct = (source: ShopifyProductNode): Collection[] =>
  source.collections.nodes.map((collection, index) => {
    const title = requiredText(collection.title, `${source.handle}.collections[${index}].title`);
    return {
      id: requiredText(collection.id, `${source.handle}.collections[${index}].id`),
      handle: requiredText(collection.handle, `${source.handle}.collections[${index}].handle`),
      title,
      description: title,
    };
  });

/** Normaliza un producto completo y valida sus invariantes de PDP. */
export const mapShopifyProduct = (
  source: ShopifyProductNode,
  allowedRemoteImageHosts: readonly string[]
): Product => {
  const product = mapProduct(source);
  assertValidCatalog(
    [product],
    collectionStubsFromProduct(source),
    SHOPIFY_SUPPORTED_CURRENCIES,
    allowedRemoteImageHosts
  );
  return product;
};

/** Normaliza la proyección de tarjeta sin exigir variantes ni galerías. */
export const mapShopifyProductSummary = (
  source: ShopifyProductSummaryNode,
  allowedRemoteImageHosts: readonly string[]
): ProductSummary => {
  const path = source.handle || source.id || 'product';
  const title = requiredText(source.title, `${path}.title`);
  const description = requiredText(source.description, `${path}.description`);
  const primaryCollection = mapPrimaryCollectionReference(source);
  const options = mapOptions(source);
  const minPrice = moneyFromDecimal(
    requiredText(source.priceRange.minVariantPrice.amount, `${path}.priceRange.minVariantPrice.amount`),
    requiredText(
      source.priceRange.minVariantPrice.currencyCode,
      `${path}.priceRange.minVariantPrice.currencyCode`
    )
  );
  const maxPrice = moneyFromDecimal(
    requiredText(source.priceRange.maxVariantPrice.amount, `${path}.priceRange.maxVariantPrice.amount`),
    requiredText(
      source.priceRange.maxVariantPrice.currencyCode,
      `${path}.priceRange.maxVariantPrice.currencyCode`
    )
  );
  const badge = metafieldText(source, 'badge', 'single_line_text_field', false);
  const summary: ProductSummary = {
    id: productId(requiredText(source.id, `${path}.id`)),
    handle: requiredText(source.handle, `${path}.handle`),
    title,
    reference: metafieldText(source, 'model_reference', 'single_line_text_field', false)
      ?? requiredText(source.handle, `${path}.handle`),
    primaryCollection,
    productType: requiredText(source.productType, `${path}.productType`),
    ...(source.featuredImage
      ? { primaryImage: mapImage(source.featuredImage, `${path}.featuredImage`, title) }
      : {}),
    summary: metafieldText(source, 'summary', 'multi_line_text_field', false) ?? description,
    priceRange: { min: minPrice, max: maxPrice },
    purchasable: source.availableForSale,
    colors: options.find((option) => option.purpose === 'color')?.values ?? [],
    ...(badge ? { badge } : {}),
  };
  assertValidProductSummary(summary, SHOPIFY_SUPPORTED_CURRENCIES, allowedRemoteImageHosts);
  return summary;
};

export const mapShopifyCollections = (
  collections: readonly ShopifyCollectionNode[],
  allowedRemoteImageHosts: readonly string[]
): Collection[] => {
  const mapped = collections.map((collection, index) => mapShopifyCollection(collection, index));
  assertValidCollections(mapped, allowedRemoteImageHosts);
  return mapped;
};

/** Normaliza y valida el catálogo completo antes de exponer un solo producto. */
export const mapShopifyCatalog = (
  payload: ShopifyCatalogPayload,
  allowedRemoteImageHosts: readonly string[]
): ShopifyCatalog => {
  const collections = payload.collections.map((collection, index) =>
    mapShopifyCollection(collection, index)
  );
  const products = payload.products.map(mapProduct);
  assertValidCatalog(products, collections, SHOPIFY_SUPPORTED_CURRENCIES, allowedRemoteImageHosts);
  return { products, collections };
};
