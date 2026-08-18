import { resolveColorSwatch } from '../../domain/color-swatch';
import { assertValidCatalog } from '../../application/catalog-validation';
import {
  COLOR_GALLERY_IMAGE_COUNT,
  type Collection,
  type Product,
  type ProductImage,
  type ProductOption,
  type ProductVariant,
  type ProductWeight,
} from '../../domain/catalog';
import { productId, sku, variantId } from '../../domain/identifiers';
import { moneyFromDecimal } from '../../domain/money';
import type {
  ShopifyCatalogPayload,
  ShopifyImageNode,
  ShopifyMetafieldNode,
  ShopifyProductNode,
} from './catalog-query';

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

const metafieldByKey = (
  product: ShopifyProductNode,
  key: string,
  expectedType: string,
  requiredField = true
): ShopifyMetafieldNode | undefined => {
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
};

const metafieldText = (
  product: ShopifyProductNode,
  key: string,
  type: string,
  requiredField = true
): string | undefined => {
  const metafield = metafieldByKey(product, key, type, requiredField);
  return metafield
    ? requiredText(metafield.value, `${product.handle}.metafields.kingbelt.${key}.value`)
    : undefined;
};

const normalizeOptionName = (value: string): string =>
  value.trim().toLocaleLowerCase('es');

const optionPurpose = (name: string): ProductOption['purpose'] => {
  const normalized = normalizeOptionName(name);
  if (normalized === 'color') return 'color';
  if (normalized === 'talla' || normalized === 'tamaño' || normalized === 'tamano') return 'size';
  return undefined;
};

const mapOptions = (product: ShopifyProductNode): ProductOption[] =>
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
      sku: sku(optionalText(variant.sku) ?? `${requiredText(product.handle, `${path}.handle`)}:${requiredText(variant.id, `${path}.id`)}`),
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

const mapMetafieldColorGalleries = (
  product: ShopifyProductNode,
  colorOption: ProductOption
): Product['mediaGroups'] | undefined => {
  const metafield = metafieldByKey(
    product,
    'color_galleries',
    'list.metaobject_reference',
    false
  );
  const references = metafield?.references;
  if (!references?.nodes.length) return undefined;

  if (references.pageInfo.hasNextPage) {
    fail(`${product.handle}.metafields.kingbelt.color_galleries.references`, 'supera el límite de 250 referencias.');
  }

  const groupsByColorValueId = new Map<string, Product['mediaGroups'][number]>();
  references.nodes.forEach((reference, referenceIndex) => {
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
      fail(`${path}.color_value`, 'falta el campo single_line_text_field.');
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
      fail(`${path}.images`, 'falta el campo list.file_reference.');
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
      const image = required(imageReference.image, imagePath, 'falta la imagen publicada.');
      requiredText(image.url, `${imagePath}.url`);
      if (image.width == null) fail(`${imagePath}.width`, 'falta la anchura.');
      if (image.height == null) fail(`${imagePath}.height`, 'falta la altura.');
      const imageId = requiredText(image.id, `${imagePath}.id`);
      if (seenImageIds.has(imageId)) {
        fail(imagePath, `la imagen ${imageId} está repetida en la galería.`);
      }
      seenImageIds.add(imageId);
      return imageId;
    });
    groupsByColorValueId.set(colorValue.id, {
      id: requiredText(reference.id, `${path}.id`),
      optionValueId: colorValue.id,
      imageIds,
    });
  });

  return colorOption.values.map((value) =>
    required(
      groupsByColorValueId.get(value.id),
      `${product.handle}.metafields.kingbelt.color_galleries`,
      `el color ${value.label} no tiene una galería asociada.`
    )
  );
};

const FILENAME_COLOR_TOKEN_MIN = 3;

const foldFilenameKey = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const filenameToken = (value: string): string =>
  foldFilenameKey(value).replace(/[^a-z0-9]+/g, '');

const tokensFromImageUrl = (url: string): readonly string[] => {
  try {
    const pathname = new URL(url).pathname;
    const filename = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
    const stem = filename.replace(/\.[a-z0-9]+$/i, '');
    return foldFilenameKey(stem)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= FILENAME_COLOR_TOKEN_MIN);
  } catch {
    return [];
  }
};

/**
 * Detalles nativos extra: solo archivos cuyo nombre contiene exactamente un
 * token de color y no son portada de otro. Sin coincidencia inequívoca, se
 * omiten. Nunca se reparte por posición ni por huecos entre portadas.
 */
const nativeDetailImageIdsByColor = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  coverByColorId: ReadonlyMap<string, string>
): Map<string, string[]> => {
  const coverIds = new Set(coverByColorId.values());
  const colors = colorOption.values.flatMap((value) => {
    const token = filenameToken(value.label);
    return token.length >= FILENAME_COLOR_TOKEN_MIN ? [{ id: value.id, token }] : [];
  });
  const extrasByColor = new Map(colorOption.values.map((value) => [value.id, [] as string[]]));
  const maxExtras = COLOR_GALLERY_IMAGE_COUNT - 1;

  product.images.nodes.forEach((image) => {
    const imageId = optionalText(image.id);
    const imageUrl = optionalText(image.url);
    if (!imageId || !imageUrl || coverIds.has(imageId)) return;
    const matches = colors.filter((color) => tokensFromImageUrl(imageUrl).includes(color.token));
    if (matches.length !== 1) return;
    const extras = extrasByColor.get(matches[0].id);
    if (extras && extras.length < maxExtras) extras.push(imageId);
  });

  return extrasByColor;
};

/**
 * Degradación segura cuando Storefront no expone `kingbelt.color_galleries`:
 * la portada es la imagen autoritativa compartida por las variantes de cada
 * color; los detalles nativos solo se añaden si el archivo nombra ese color
 * de forma inequívoca.
 */
const mapNativeColorMediaGroups = (
  product: ShopifyProductNode,
  colorOption: ProductOption
): Product['mediaGroups'] => {
  const productImageIds = new Set(product.images.nodes.map((image, imageIndex) =>
    requiredText(image.id, `${product.handle}.images[${imageIndex}].id`)
  ));
  const coverByColorId = new Map<string, string>();

  colorOption.values.forEach((value, valueIndex) => {
    const variantsForColor = product.variants.nodes.flatMap((variant, variantIndex) => {
      const selectedColor = variant.selectedOptions.find((selection) =>
        normalizeOptionName(selection.name) === normalizeOptionName(colorOption.name)
      );
      return selectedColor && normalizeOptionName(selectedColor.value) === normalizeOptionName(value.label)
        ? [{ variant, variantIndex }]
        : [];
    });
    const path = `${product.handle}.options.color.values[${valueIndex}]`;
    if (!variantsForColor.length) {
      fail(path, `el color ${value.label} no tiene variantes publicadas.`);
    }

    const imageIds = new Set(variantsForColor.map(({ variant, variantIndex }) =>
      requiredText(
        variant.image?.id,
        `${product.handle}.variants[${variantIndex}].image.id`
      )
    ));
    if (imageIds.size !== 1) {
      fail(path, `las variantes del color ${value.label} no comparten una única imagen principal.`);
    }

    const imageId = [...imageIds][0];
    if (!productImageIds.has(imageId)) {
      fail(path, `la imagen principal del color ${value.label} no pertenece a las imágenes del producto.`);
    }
    coverByColorId.set(value.id, imageId);
  });

  const extrasByColor = nativeDetailImageIdsByColor(product, colorOption, coverByColorId);

  return colorOption.values.map((value) => {
    const coverId = required(coverByColorId.get(value.id), `${product.handle}.options.color`, 'falta la portada nativa.');
    const extras = extrasByColor.get(value.id) ?? [];
    return {
      id: `${requiredText(product.id, `${product.handle}.id`)}::native-color::${value.id}`,
      optionValueId: value.id,
      imageIds: [coverId, ...extras].slice(0, COLOR_GALLERY_IMAGE_COUNT),
    };
  });
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
  const images = source.images.nodes.map((image, index) =>
    mapImage(image, `${path}.images[${index}]`, title)
  );
  const colorOption = options.find((option) => option.purpose === 'color');
  const mediaGroups = colorOption
    ? mapMetafieldColorGalleries(source, colorOption)
      ?? mapNativeColorMediaGroups(source, colorOption)
    : [];
  const primaryCollectionId = source.collections.nodes[0]?.id ??
    fail(`${path}.collections`, 'el producto no pertenece a ninguna colección publicada.');
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

/** Normaliza y valida el catálogo completo antes de exponer un solo producto. */
export const mapShopifyCatalog = (
  payload: ShopifyCatalogPayload,
  allowedRemoteImageHosts: readonly string[]
): ShopifyCatalog => {
  const collections = payload.collections.map((collection, index): Collection => {
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
  });
  const products = payload.products.map(mapProduct);
  assertValidCatalog(products, collections, ['EUR'], allowedRemoteImageHosts);
  return { products, collections };
};
