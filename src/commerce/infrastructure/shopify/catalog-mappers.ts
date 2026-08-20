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
  Connection,
  ShopifyCatalogPayload,
  ShopifyCollectionNode,
  ShopifyCollectionReferenceNode,
  ShopifyImageNode,
  ShopifyMetafieldNode,
  ShopifyMetafieldReferenceNode,
  ShopifyProductNode,
  ShopifyProductSummaryNode,
} from './catalog-query';
import {
  SHOPIFY_COLOR_GALLERIES_METAFIELD,
  SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER,
  SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER,
  SHOPIFY_SUPPORTED_CURRENCIES,
} from './config';

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

const requiredShopifyGid = (value: string | null | undefined, resource: string, path: string): string => {
  const id = requiredText(value, path);
  if (!new RegExp(`^gid://shopify/${resource}/[^/?#\\s]+$`).test(id)) {
    fail(path, `se esperaba un GID Shopify de ${resource}.`);
  }
  return id;
};

const requiredShopifyImageGid = (value: string | null | undefined, path: string): string => {
  const id = requiredText(value, path);
  if (!/^gid:\/\/shopify\/(?:ProductImage|MediaImage|ImageSource)\/[^/?#\s]+$/.test(id)) {
    const resource = /^gid:\/\/shopify\/([^/?#\s]+)\//.exec(id)?.[1] ?? 'desconocido';
    fail(path, `se esperaba un GID Shopify de imagen; se recibió el recurso ${resource}.`);
  }
  return id;
};

const requiredHandle = (value: string | null | undefined, path: string): string => {
  const handle = requiredText(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    fail(path, 'el handle no tiene un formato Shopify válido.');
  }
  return handle;
};

const mapImage = (
  image: ShopifyImageNode,
  path: string,
  fallbackAlt: string
): ProductImage => ({
  id: requiredShopifyImageGid(image.id, `${path}.id`),
  url: requiredText(image.url, `${path}.url`),
  altText: optionalText(image.altText) ?? requiredText(fallbackAlt, `${path}.altText`),
  width: image.width ?? fail(`${path}.width`, 'falta la anchura.'),
  height: image.height ?? fail(`${path}.height`, 'falta la altura.'),
});

type ShopifyAssignedCollection = Pick<ShopifyCollectionNode, 'id' | 'handle' | 'title'>;
type ShopifyMetafieldSource = Pick<ShopifyProductNode, 'handle' | 'metafields'> & {
  collections?: Connection<ShopifyAssignedCollection>;
};
type ShopifyOptionSource = Pick<ShopifyProductNode, 'handle' | 'options'>;

function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField: true,
  namespace?: string
): ShopifyMetafieldNode;
function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField?: boolean,
  namespace?: string
): ShopifyMetafieldNode | undefined;
function metafieldByKey(
  product: ShopifyMetafieldSource,
  key: string,
  expectedType: string,
  requiredField = true,
  namespace = 'kingbelt'
): ShopifyMetafieldNode | undefined {
  const metafield = product.metafields.find((candidate) =>
    candidate?.namespace === namespace && candidate.key === key
  ) ?? undefined;
  const path = `${product.handle}.metafields.${namespace}.${key}`;
  if (!metafield) {
    if (requiredField) {
      fail(
        path,
        'no llega por Storefront. Comprueba que la definición tenga Storefront access = Read y que el producto tenga el valor configurado.'
      );
    }
    return undefined;
  }
  if (metafield.type !== expectedType) {
    fail(path, `tipo ${metafield.type}; se esperaba ${expectedType}.`);
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

const isShopifyCollectionReference = (
  node: ShopifyMetafieldReferenceNode | null | undefined
): node is ShopifyCollectionReferenceNode =>
  node?.__typename === 'Collection';

const failPrimaryCollection = (handle: string, detail: string): never => {
  throw new ShopifyCatalogMappingError(`Product "${handle}":\n${detail}`);
};

/** Product.primaryCollection / primaryCollectionId sale de custom.kingbelt_primary_collection. Sin fallback. */
const mapPrimaryCollectionReference = (
  source: ShopifyMetafieldSource
): { id: string; handle: string; title: string } => {
  const handle = requiredText(source.handle, `${source.handle || 'product'}.handle`);
  const metafield = source.metafields.find((candidate) =>
    candidate?.namespace === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace
    && candidate.key === SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key
  );

  if (!metafield) {
    return failPrimaryCollection(
      handle,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is missing`
    );
  }

  if (metafield.type !== SHOPIFY_PRIMARY_COLLECTION_METAFIELD.type) {
    return failPrimaryCollection(
      handle,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} has type ${metafield.type}; expected ${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.type}`
    );
  }

  const reference = metafield.reference;
  if (!isShopifyCollectionReference(reference)) {
    if (reference) {
      return failPrimaryCollection(
        handle,
        `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} does not reference a Collection`
      );
    }
    const declaredValue = metafield.value?.trim() ?? '';
    if (!declaredValue) {
      return failPrimaryCollection(
        handle,
        `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} is empty`
      );
    }
    return failPrimaryCollection(
      handle,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} has a value but the Collection reference is not available in Storefront. Confirm the value is assigned, the Collection exists, the definition has Storefront access (Read / PUBLIC_READ), and the reference is visible on Storefront.`
    );
  }

  const path = `${handle}.metafields.${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}.${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}`;
  const mapped = {
    id: requiredShopifyGid(reference.id, 'Collection', `${path}.id`),
    handle: requiredHandle(reference.handle, `${path}.handle`),
    title: requiredText(reference.title, `${path}.title`),
  };
  const assigned = source.collections?.nodes ?? [];
  if (!assigned.some((collection) => collection.id === mapped.id)) {
    return failPrimaryCollection(
      handle,
      `${SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER} references collection "${mapped.handle}" but that collection is not assigned to this product`
    );
  }
  return mapped;
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
    id: requiredShopifyGid(option.id, 'ProductOption', `${product.handle}.options[${optionIndex}].id`),
    name: requiredText(option.name, `${product.handle}.options[${optionIndex}].name`),
    purpose: optionPurpose(option.name),
    values: option.optionValues.map((value, valueIndex) => {
      const label = requiredText(value.name, `${product.handle}.options[${optionIndex}].values[${valueIndex}].name`);
      const shopifySwatch = optionalText(value.swatch?.color);
      const purpose = optionPurpose(option.name);
      return {
        id: requiredShopifyGid(
          value.id,
          'ProductOptionValue',
          `${product.handle}.options[${optionIndex}].values[${valueIndex}].id`
        ),
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
  mediaGroups: Product['mediaGroups'],
  images: readonly ProductImage[]
): ProductVariant[] => {
  const optionsByName = new Map(options.map((option) => [normalizeOptionName(option.name), option]));
  const colorOption = options.find((option) => option.purpose === 'color');
  const colorImageByValue = new Map(
    mediaGroups.map((group) => [group.optionValueId, group.imageIds[0]])
  );
  const imagesById = new Map(images.map((image) => [image.id, image]));
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
    if (compareAtPrice) {
      if (compareAtPrice.currency !== price.currency) {
        fail(`${path}.compareAtPrice.currencyCode`, 'debe usar la misma moneda que price.');
      }
      if (compareAtPrice.amountMinor <= price.amountMinor) {
        fail(`${path}.compareAtPrice.amount`, 'debe ser mayor que price.');
      }
    }
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
    const actualImageId = variant.image
      ? requiredShopifyImageGid(variant.image.id, `${path}.image.id`)
      : undefined;
    if (colorValueId && mediaGroups.length > 0) {
      if (!expectedColorImageId) {
        fail(`${path}.image`, 'la variante tiene un color sin galería.');
      }
      if (!actualImageId) {
        fail(`${path}.image`, 'la variante debe tener asignada la imagen principal de su color.');
      }
      const expectedImage = expectedColorImageId
        ? imagesById.get(expectedColorImageId)
        : undefined;
      const matchesExactUrl = Boolean(
        expectedImage
        && variant.image
        && requiredText(variant.image.url, `${path}.image.url`) === expectedImage.url
      );
      if (actualImageId !== expectedColorImageId && !matchesExactUrl) {
        const sameUrlPath = (() => {
          if (!expectedImage || !variant.image) return false;
          try {
            const actual = new URL(variant.image.url);
            const expected = new URL(expectedImage.url);
            return actual.origin === expected.origin && actual.pathname === expected.pathname;
          } catch {
            return false;
          }
        })();
        fail(
          `${path}.image`,
          `la imagen de la variante no coincide con la portada de su galería de color (misma ruta CDN: ${sameUrlPath ? 'sí' : 'no'}).`
        );
      }
    }
    const imageId = expectedColorImageId ?? actualImageId;

    return {
      id: variantId(requiredShopifyGid(variant.id, 'ProductVariant', `${path}.id`)),
      sku: mappedSku,
      title: optionalText(variant.title),
      optionValues,
      price,
      ...(compareAtPrice ? { compareAtPrice } : {}),
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

const reconcileGalleryImageIds = (
  productHandle: string,
  productImages: readonly ProductImage[],
  galleries: { mediaGroups: Product['mediaGroups']; images: ProductImage[] }
): { mediaGroups: Product['mediaGroups']; images: ProductImage[] } => {
  const productImagesByUrl = new Map<string, ProductImage>();
  productImages.forEach((image) => {
    if (productImagesByUrl.has(image.url)) {
      fail(`${productHandle}.images`, 'dos imágenes de producto comparten la misma URL y no se pueden reconciliar.');
    }
    productImagesByUrl.set(image.url, image);
  });

  const canonicalIdByReferenceId = new Map<string, string>();
  const images = galleries.images.map((image) => {
    const canonical = productImagesByUrl.get(image.url) ?? image;
    canonicalIdByReferenceId.set(image.id, canonical.id);
    return canonical;
  });
  const mediaGroups = galleries.mediaGroups.map((group) => ({
    ...group,
    imageIds: group.imageIds.map((id) => canonicalIdByReferenceId.get(id) ?? id),
  }));

  return { mediaGroups, images };
};

const declaredMetafieldValue = (value: string | null | undefined): boolean => {
  const normalized = value?.trim() ?? '';
  return Boolean(normalized) && normalized !== '[]';
};

const colorGalleriesPath = (handle: string) =>
  `${handle}.metafields.${SHOPIFY_COLOR_GALLERIES_METAFIELD_IDENTIFIER}`;

const readColorGalleriesMetafield = (product: ShopifyProductNode) =>
  metafieldByKey(
    product,
    SHOPIFY_COLOR_GALLERIES_METAFIELD.key,
    SHOPIFY_COLOR_GALLERIES_METAFIELD.type,
    true,
    SHOPIFY_COLOR_GALLERIES_METAFIELD.namespace
  );

const mapCompleteColorGalleryGroup = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  productTitle: string,
  reference: ShopifyMetafieldReferenceNode,
  referenceIndex: number
): { group: Product['mediaGroups'][number]; images: ProductImage[] } => {
  const path = `${colorGalleriesPath(product.handle)}[${referenceIndex}]`;
  if (reference.__typename !== 'Metaobject' || !reference.fields) {
    return fail(path, 'la referencia no es un metaobject de galería publicado.');
  }
  if (reference.type !== SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE) {
    return fail(
      `${path}.type`,
      `tipo ${reference.type ?? 'ausente'}; se esperaba ${SHOPIFY_COLOR_GALLERY_METAOBJECT_TYPE}.`
    );
  }
  const fields = reference.fields;
  const colorField = fields.find((field) => field.key === 'color_value');
  if (!colorField) {
    return fail(`${path}.color_value`, 'falta el campo single_line_text_field.');
  }
  if (colorField.type !== 'single_line_text_field') {
    return fail(`${path}.color_value`, `tipo ${colorField.type}; se esperaba single_line_text_field.`);
  }
  const colorLabel = colorField.value?.trim();
  if (!colorLabel) {
    return fail(`${path}.color_value.value`, 'el valor está vacío.');
  }
  const colorValue = colorOption.values.find((value) =>
    normalizeOptionName(value.label) === normalizeOptionName(colorLabel)
  );
  if (!colorValue) {
    return fail(`${path}.color_value`, `el color ${colorLabel} no existe en la opción Color.`);
  }

  const imagesField = fields.find((field) => field.key === 'images');
  if (!imagesField || imagesField.type !== 'list.file_reference' || !imagesField.references) {
    return fail(
      `${path}.images`,
      !imagesField
        ? 'falta el campo list.file_reference.'
        : imagesField.type !== 'list.file_reference'
          ? `tipo ${imagesField.type}; se esperaba list.file_reference.`
          : 'falta el campo list.file_reference.'
    );
  }
  const imageReferences = imagesField.references;
  if (imageReferences.pageInfo.hasNextPage) {
    return fail(`${path}.images`, 'supera el límite de 250 referencias.');
  }
  if (imageReferences.nodes.length !== COLOR_GALLERY_IMAGE_COUNT) {
    return fail(
      `${path}.images`,
      `debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes.`
    );
  }
  const seenImageIds = new Set<string>();
  const images: ProductImage[] = [];
  const imageIds = imageReferences.nodes.map((imageReference, imageIndex) => {
    const imagePath = `${path}.images[${imageIndex}]`;
    if (imageReference.__typename !== 'MediaImage' || !imageReference.image) {
      return fail(imagePath, 'la referencia no es una MediaImage publicada.');
    }
    requiredShopifyGid(imageReference.id, 'MediaImage', `${imagePath}.id`);
    const image = mapImage(imageReference.image, imagePath, productTitle);
    if (seenImageIds.has(image.id)) {
      return fail(imagePath, `la imagen ${image.id} está repetida en la galería.`);
    }
    seenImageIds.add(image.id);
    images.push(image);
    return image.id;
  });
  return {
    group: {
      id: requiredShopifyGid(reference.id, 'Metaobject', `${path}.id`),
      optionValueId: colorValue.id,
      imageIds,
    },
    images,
  };
};

const mapRequiredColorGalleries = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  productTitle: string
): { mediaGroups: Product['mediaGroups']; images: ProductImage[] } => {
  const path = colorGalleriesPath(product.handle);
  const metafield = readColorGalleriesMetafield(product);
  const references = metafield.references;
  if (!references?.nodes.length) {
    fail(
      path,
      declaredMetafieldValue(metafield.value)
        ? 'las referencias de galería no llegan por Storefront. Publica la definición y los metaobjects con Storefront access = Read y mantén el scope unauthenticated_read_metaobjects.'
        : 'debe contener exactamente una galería por cada valor de Color.'
    );
  }
  const galleryReferences = required(
    references,
    path,
    'debe contener exactamente una galería por cada valor de Color.'
  );
  if (galleryReferences.pageInfo.hasNextPage) {
    fail(`${path}.references`, 'supera el límite de 250 referencias.');
  }

  const groupsByColorValueId = new Map<string, Product['mediaGroups'][number]>();
  const galleryImages: ProductImage[] = [];
  galleryReferences.nodes.forEach((reference, referenceIndex) => {
    const mapped = mapCompleteColorGalleryGroup(
      product,
      colorOption,
      productTitle,
      reference,
      referenceIndex
    );
    if (groupsByColorValueId.has(mapped.group.optionValueId)) {
      const colorLabel = colorOption.values.find((value) => value.id === mapped.group.optionValueId)?.label
        ?? mapped.group.optionValueId;
      fail(
        `${path}[${referenceIndex}].color_value`,
        `el color ${colorLabel} tiene más de una galería.`
      );
    }
    groupsByColorValueId.set(mapped.group.optionValueId, mapped.group);
    galleryImages.push(...mapped.images);
  });

  return {
    mediaGroups: colorOption.values.map((value) =>
      required(
        groupsByColorValueId.get(value.id),
        path,
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
  let normalizedWidth: string | undefined;
  if (width !== undefined) {
    const widthNumber = Number(width);
    if (!/^\d+$/.test(width) || !Number.isSafeInteger(widthNumber) || widthNumber <= 0) {
      fail(`${source.handle}.metafields.kingbelt.width_mm.value`, 'debe ser un entero positivo.');
    }
    normalizedWidth = `${widthNumber} mm`;
  }
  const specifications = [
    ...(material ? [{ label: 'Material', value: material }] : []),
    ...(normalizedWidth ? [{ label: 'Ancho', value: normalizedWidth }] : []),
    ...(buckle ? [{ label: 'Hebilla/acabado', value: buckle }] : []),
  ];
  return specifications;
};

const mapProduct = (
  source: ShopifyProductNode
): Product => {
  const path = source.handle || source.id || 'product';
  const title = requiredText(source.title, `${path}.title`);
  const options = mapOptions(source);
  const productImages = source.images.nodes.map((image, index) =>
    mapImage(image, `${path}.images[${index}]`, title)
  );
  const colorOption = options.find((option) => option.purpose === 'color');
  const rawGalleries = !colorOption
    ? { mediaGroups: [], images: [] }
    : mapRequiredColorGalleries(source, colorOption, title);
  const galleries = reconcileGalleryImageIds(path, productImages, rawGalleries);
  const mediaGroups = galleries.mediaGroups;
  const images = mergeImagesById(productImages, galleries.images);
  const primaryCollection = mapPrimaryCollectionReference(source);
  const badge = metafieldText(source, 'badge', 'single_line_text_field', false);
  const seoTitle = optionalText(source.seo.title);
  const seoDescription = optionalText(source.seo.description);
  const description = requiredText(source.description, `${path}.description`);
  const firstColorImageId = mediaGroups[0]?.imageIds[0];

  return {
    id: productId(requiredShopifyGid(source.id, 'Product', `${path}.id`)),
    reference: metafieldText(source, 'model_reference', 'single_line_text_field', false)
      ?? requiredHandle(source.handle, `${path}.handle`),
    handle: requiredHandle(source.handle, `${path}.handle`),
    title,
    description,
    summary: metafieldText(source, 'summary', 'multi_line_text_field', false) ?? description,
    vendor: requiredText(source.vendor, `${path}.vendor`),
    productType: requiredText(source.productType, `${path}.productType`),
    category: {
      id: requiredShopifyGid(source.category?.id, 'TaxonomyCategory', `${path}.category.id`),
      name: requiredText(source.category?.name, `${path}.category.name`),
    },
    publicationStatus: source.publishedAt ? 'published' : 'unpublished',
    primaryCollectionId: primaryCollection.id,
    collectionIds: source.collections.nodes.map((collection, index) =>
      requiredShopifyGid(collection.id, 'Collection', `${path}.collections[${index}].id`)
    ),
    ...(badge ? { badge } : {}),
    options,
    variants: mapVariants(source, options, mediaGroups, images),
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
    id: requiredShopifyGid(collection.id, 'Collection', `collections[${index}].id`),
    handle: requiredHandle(collection.handle, `collections[${index}].handle`),
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
      id: requiredShopifyGid(collection.id, 'Collection', `${source.handle}.collections[${index}].id`),
      handle: requiredHandle(collection.handle, `${source.handle}.collections[${index}].handle`),
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
    id: productId(requiredShopifyGid(source.id, 'Product', `${path}.id`)),
    handle: requiredHandle(source.handle, `${path}.handle`),
    title,
    reference: metafieldText(source, 'model_reference', 'single_line_text_field', false)
      ?? requiredHandle(source.handle, `${path}.handle`),
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
  const products = payload.products.map((product) => mapProduct(product));
  assertValidCatalog(products, collections, SHOPIFY_SUPPORTED_CURRENCIES, allowedRemoteImageHosts);
  return { products, collections };
};
