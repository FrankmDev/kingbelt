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
import {
  isRuntimeTechnicalSku,
  productId,
  runtimeTechnicalSku,
  sku,
  variantId,
} from '../../domain/identifiers';
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
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD_IDENTIFIER,
  SHOPIFY_SUPPORTED_CURRENCIES,
} from './config';
import { isShopifyImageIdentifier } from './shopify-image-identifier';

export interface ShopifyCatalog {
  products: Product[];
  collections: Collection[];
}

export interface ShopifyProductMapOptions {
  requireCommercialSku?: boolean;
  requireCompleteColorGalleries?: boolean;
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
  if (
    id.length > 256
    || /[\u0000-\u001f\u007f]/.test(id)
    || !new RegExp(`^gid://shopify/${resource}/[^/?#\\s]+$`).test(id)
  ) {
    fail(path, `se esperaba un GID Shopify de ${resource}.`);
  }
  return id;
};

const requiredShopifyImageGid = (value: string | null | undefined, path: string): string => {
  if (!isShopifyImageIdentifier(value)) {
    return fail(path, 'se esperaba un GID Shopify de imagen.');
  }
  return value;
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
  {
    requireCommercialSku = true,
  }: { requireCommercialSku?: boolean } = {}
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
    const mappedVariantId = requiredShopifyGid(variant.id, 'ProductVariant', `${path}.id`);
    const skuPath = optionHint ? `${path}.sku (${optionHint})` : `${path}.sku`;
    const commercialSku = optionalText(variant.sku);
    if (commercialSku && isRuntimeTechnicalSku(commercialSku)) {
      fail(skuPath, 'usa un prefijo reservado para identificadores técnicos del runtime.');
    }
    const mappedSku = commercialSku
      ? sku(commercialSku)
      : requireCommercialSku
        ? sku(requiredText(variant.sku, skuPath))
        : runtimeTechnicalSku(mappedVariantId);
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
    if (colorValueId && !expectedColorImageId) {
      fail(`${path}.image`, 'la variante tiene un color sin galería nativa segura.');
    }
    const imageId = expectedColorImageId ?? actualImageId;

    return {
      id: variantId(mappedVariantId),
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

const IMAGE_FILE_STEM_PATTERN = /([^/?#]+)\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i;
const IMAGE_FILE_FAMILY_PATTERN = /[_-](\d+)(?:_[0-9a-f-]{36})?$/i;

const imageFileStem = (url: string): string | undefined => {
  const encoded = url.match(IMAGE_FILE_STEM_PATTERN)?.[1];
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
};

const imageFileFamily = (url: string): string | undefined => {
  const stem = imageFileStem(url);
  if (!stem) return undefined;
  const match = IMAGE_FILE_FAMILY_PATTERN.exec(stem);
  if (!match || match.index === undefined) return undefined;
  return stem.slice(0, match.index) || undefined;
};

const imageFileSequence = (url: string): number => {
  const match = imageFileStem(url)?.match(IMAGE_FILE_FAMILY_PATTERN);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const normalizedMediaToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const imageFamilyNamesColor = (family: string, color: string): boolean => {
  const normalizedFamily = normalizedMediaToken(family);
  const normalizedColor = normalizedMediaToken(color);
  return Boolean(normalizedColor) && (
    normalizedFamily === normalizedColor
    || normalizedFamily.endsWith(`_${normalizedColor}`)
  );
};

const mapNativeColorGroups = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  productImages: readonly ProductImage[],
  { requireComplete }: { requireComplete: boolean }
): Product['mediaGroups'] => {
  const nativeImages = product.images.nodes.map((image, index) => ({
    image,
    mapped: productImages[index],
  }));
  const nativeFamilies = new Map<string, typeof nativeImages>();
  nativeImages.forEach((candidate) => {
    const family = imageFileFamily(candidate.image.url);
    if (!family) return;
    const familyKey = normalizedMediaToken(family);
    if (!familyKey) return;
    const familyImages = nativeFamilies.get(familyKey) ?? [];
    familyImages.push(candidate);
    nativeFamilies.set(familyKey, familyImages);
  });

  const firstVariantImageByColor = new Map<string, ShopifyImageNode>();
  const firstVariantFamilyByColor = new Map<string, string>();
  product.variants.nodes.forEach((variant) => {
    const selectedColor = variant.selectedOptions.find((selection) =>
      normalizeOptionName(selection.name) === 'color'
    );
    const colorValue = selectedColor
      ? colorOption.values.find((value) =>
        normalizeOptionName(value.label) === normalizeOptionName(selectedColor.value)
      )
      : undefined;
    if (!colorValue || !variant.image) return;
    if (!firstVariantImageByColor.has(colorValue.id)) {
      firstVariantImageByColor.set(colorValue.id, variant.image);
    }
    const family = imageFileFamily(variant.image.url);
    const familyKey = family ? normalizedMediaToken(family) : '';
    if (familyKey && !firstVariantFamilyByColor.has(colorValue.id)) {
      firstVariantFamilyByColor.set(colorValue.id, familyKey);
    }
  });

  return colorOption.values.map((value) => {
    const path = `${product.handle}.images.${value.label}`;
    const variantImage = firstVariantImageByColor.get(value.id);
    const variantFamily = firstVariantFamilyByColor.get(value.id);
    const namedFamilies = [...nativeFamilies.keys()].filter((family) =>
      imageFamilyNamesColor(family, value.label)
    );
    if (requireComplete && namedFamilies.length !== 1) {
      fail(
        path,
        namedFamilies.length === 0
          ? `no existe una familia cuyo nombre termine en ${value.label}. Usa MODELO_${normalizedMediaToken(value.label).toUpperCase()}_01/02/03.`
          : `hay ${namedFamilies.length} familias cuyos nombres terminan en ${value.label}; debe haber exactamente una.`
      );
    }
    const selectedFamily = namedFamilies.length === 1
      ? namedFamilies[0]
      : variantFamily
        && nativeFamilies.has(variantFamily)
        && imageFamilyNamesColor(variantFamily, value.label)
        ? variantFamily
        : undefined;

    const familyCandidates = selectedFamily
      ? [...(nativeFamilies.get(selectedFamily) ?? [])]
        .sort((left, right) => imageFileSequence(left.image.url) - imageFileSequence(right.image.url))
      : [];
    if (requireComplete) {
      const sequences = familyCandidates.map(({ image }) => imageFileSequence(image.url));
      const uniqueIds = new Set(familyCandidates.map(({ mapped }) => mapped.id));
      if (
        familyCandidates.length !== COLOR_GALLERY_IMAGE_COUNT
        || uniqueIds.size !== COLOR_GALLERY_IMAGE_COUNT
        || sequences.some((sequence, index) => sequence !== index + 1)
      ) {
        fail(
          path,
          `la familia ${selectedFamily} debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes únicas numeradas 01, 02 y 03.`
        );
      }
    }

    const candidates = familyCandidates.length
      ? familyCandidates
        .slice(0, COLOR_GALLERY_IMAGE_COUNT)
        .map(({ mapped }) => mapped)
      : variantImage
        ? nativeImages
          .filter(({ image }) => image.id === variantImage.id || image.url === variantImage.url)
          .slice(0, 1)
          .map(({ mapped }) => mapped)
        : [];
    if (!candidates.length) {
      fail(
        path,
        `no se puede resolver una galería nativa segura para el color ${value.label}.`
      );
    }
    const uniqueCandidates = candidates.filter((image, index, all) =>
      all.findIndex((candidate) => candidate.id === image.id) === index
    );
    return {
      id: value.id,
      optionValueId: value.id,
      imageIds: uniqueCandidates.map((image) => image.id),
    };
  });
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
  source: ShopifyProductNode,
  {
    requireCommercialSku = true,
    requireCompleteColorGalleries = true,
  }: ShopifyProductMapOptions = {}
): Product => {
  const path = source.handle || source.id || 'product';
  const title = requiredText(source.title, `${path}.title`);
  const options = mapOptions(source);
  const productImages = source.images.nodes.map((image, index) =>
    mapImage(image, `${path}.images[${index}]`, title)
  );
  const colorOption = options.find((option) => option.purpose === 'color');
  const mediaGroups = colorOption
    ? mapNativeColorGroups(source, colorOption, productImages, {
      requireComplete: requireCompleteColorGalleries,
    })
    : [];
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
    variants: mapVariants(source, options, mediaGroups, { requireCommercialSku }),
    images: productImages,
    primaryImageId: firstColorImageId
      ?? requiredShopifyImageGid(source.featuredImage?.id, `${path}.featuredImage.id`),
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
  allowedRemoteImageHosts: readonly string[],
  options: ShopifyProductMapOptions = {}
): Product => {
  const requireCompleteColorGalleries = options.requireCompleteColorGalleries !== false;
  const product = mapProduct(source, {
    requireCommercialSku: options.requireCommercialSku !== false,
    requireCompleteColorGalleries,
  });
  assertValidCatalog(
    [product],
    collectionStubsFromProduct(source),
    SHOPIFY_SUPPORTED_CURRENCIES,
    allowedRemoteImageHosts,
    { requireColorGalleries: requireCompleteColorGalleries }
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
