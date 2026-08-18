import { assertValidCatalog } from '../../application/catalog-validation';
import type {
  Collection,
  Product,
  ProductImage,
  ProductOption,
  ProductVariant,
  ProductWeight,
} from '../../domain/catalog';
import { productId, sku, variantId } from '../../domain/identifiers';
import { moneyFromDecimal } from '../../domain/money';
import type {
  ShopifyCatalogPayload,
  ShopifyImageNode,
  ShopifyMetafieldNode,
  ShopifyProductNode,
  ShopifyVariantNode,
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
    if (requiredField) fail(`${product.handle}.metafields.kingbelt.${key}`, 'no está publicado para Storefront.');
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
      const swatch = optionalText(value.swatch?.color);
      return {
        id: requiredText(value.id, `${product.handle}.options[${optionIndex}].values[${valueIndex}].id`),
        label: requiredText(value.name, `${product.handle}.options[${optionIndex}].values[${valueIndex}].name`),
        ...(swatch ? { swatch } : {}),
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

const variantColorValueId = (
  variant: ShopifyVariantNode,
  optionsByName: Map<string, ProductOption>
): string | undefined => {
  const selection = variant.selectedOptions.find((item) => normalizeOptionName(item.name) === 'color');
  if (!selection) return undefined;
  const option = optionsByName.get(normalizeOptionName(selection.name));
  return option?.values.find((value) =>
    normalizeOptionName(value.label) === normalizeOptionName(selection.value)
  )?.id;
};

const mapVariants = (
  product: ShopifyProductNode,
  options: ProductOption[],
  mediaGroups: Product['mediaGroups']
): ProductVariant[] => {
  const optionsByName = new Map(options.map((option) => [normalizeOptionName(option.name), option]));
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
    const colorValueId = variantColorValueId(variant, optionsByName);
    const imageId = (colorValueId ? colorImageByValue.get(colorValueId) : undefined)
      ?? optionalText(variant.image?.id);

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
): Product['mediaGroups'] => {
  const metafield = metafieldByKey(product, 'color_galleries', 'list.metaobject_reference', false);
  const references = metafield?.references;
  if (!references?.nodes.length) return [];

  if (references.pageInfo.hasNextPage) {
    fail(`${product.handle}.metafields.kingbelt.color_galleries.references`, 'supera el límite de 250 referencias.');
  }

  return references.nodes.map((reference, referenceIndex) => {
    const path = `${product.handle}.metafields.kingbelt.color_galleries[${referenceIndex}]`;
    if (
      reference.__typename !== 'Metaobject' ||
      reference.type !== 'kingbelt.color_gallery' ||
      !reference.fields
    ) {
      fail(path, 'la referencia no es un metaobject kingbelt.color_gallery.');
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
    const imageIds = imageReferences.nodes.map((imageReference, imageIndex) => {
      if (
        imageReference.__typename !== 'MediaImage' ||
        !('image' in imageReference) ||
        !imageReference.image
      ) {
        fail(`${path}.images[${imageIndex}]`, 'la referencia no es una imagen publicada.');
      }
      const image = required(imageReference.image, `${path}.images[${imageIndex}]`, 'falta la imagen publicada.');
      return requiredText(image.id, `${path}.images[${imageIndex}].id`);
    });
    return {
      id: requiredText(reference.id, `${path}.id`),
      optionValueId: colorValue.id,
      imageIds,
    };
  });
};

const rebalanceColorGalleries = (
  groups: Map<string, string[]>,
  target: number
) => {
  const keys = [...groups.keys()];
  const extras = (key: string) => Math.max(0, (groups.get(key)?.length ?? 0) - 1);
  while (true) {
    const needy = keys.find((key) => (groups.get(key)?.length ?? 0) < target);
    const donor = keys
      .filter((key) => extras(key) > Math.max(0, target - 1))
      .sort((left, right) => extras(right) - extras(left))[0];
    if (!needy || !donor || donor === needy) break;
    const taken = groups.get(donor)?.pop();
    if (!taken) break;
    groups.get(needy)?.push(taken);
  }
};

const deriveColorMediaGroups = (
  product: ShopifyProductNode,
  colorOption: ProductOption,
  images: ProductImage[]
): Product['mediaGroups'] => {
  const imageIds = images.map((image) => image.id);
  if (!imageIds.length) {
    fail(`${product.handle}.images`, 'el producto no tiene imágenes publicadas.');
  }
  const imageIndex = new Map(imageIds.map((id, index) => [id, index]));
  const primaryByColor = new Map<string, string>();
  for (const variant of product.variants.nodes) {
    const colorName = variant.selectedOptions.find((item) => normalizeOptionName(item.name) === 'color')?.value;
    const colorValue = colorName
      ? colorOption.values.find((value) =>
        normalizeOptionName(value.label) === normalizeOptionName(colorName)
      )
      : undefined;
    const imageId = optionalText(variant.image?.id);
    if (!colorValue || !imageId || !imageIndex.has(imageId) || primaryByColor.has(colorValue.id)) continue;
    primaryByColor.set(colorValue.id, imageId);
  }

  const uniquePrimaries = new Set(primaryByColor.values());
  const distinctPrimaries = colorOption.values.every((value) => primaryByColor.has(value.id))
    && uniquePrimaries.size === colorOption.values.length;
  const groups = new Map<string, string[]>();

  if (distinctPrimaries) {
    const ordered = colorOption.values
      .map((value) => ({
        id: value.id,
        index: imageIndex.get(primaryByColor.get(value.id) as string) as number,
      }))
      .sort((left, right) => left.index - right.index);
    ordered.forEach((item, index) => {
      const end = index + 1 < ordered.length ? ordered[index + 1].index : imageIds.length;
      groups.set(item.id, imageIds.slice(item.index, Math.max(end, item.index + 1)));
    });
    rebalanceColorGalleries(groups, Math.min(3, Math.floor(imageIds.length / colorOption.values.length) || 1));
  } else {
    const sharedPrimary = uniquePrimaries.size === 1 ? [...uniquePrimaries][0] : undefined;
    const claimed = new Set<string>();
    for (const value of colorOption.values) {
      const primary = primaryByColor.get(value.id)
        ?? imageIds.find((id) => !claimed.has(id))
        ?? imageIds[0];
      groups.set(value.id, [primary]);
      if (!sharedPrimary) claimed.add(primary);
    }
    const leftover = imageIds.filter((id) => id !== sharedPrimary && !claimed.has(id));
    leftover.forEach((id, index) => {
      groups.get(colorOption.values[index % colorOption.values.length].id)?.push(id);
    });
  }

  return colorOption.values.map((value) => ({
    id: `${product.id}::${value.id}`,
    optionValueId: value.id,
    imageIds: required(
      groups.get(value.id)?.length ? groups.get(value.id) : undefined,
      `${product.handle}.mediaGroups.${value.label}`,
      'el color no tiene imagen publicada.'
    ),
  }));
};

const mapMediaGroups = (
  product: ShopifyProductNode,
  options: ProductOption[],
  images: ProductImage[]
): Product['mediaGroups'] => {
  const colorOption = options.find((option) => option.purpose === 'color');
  if (!colorOption) return [];
  const fromMetafields = mapMetafieldColorGalleries(product, colorOption);
  if (fromMetafields.length) return fromMetafields;
  return deriveColorMediaGroups(product, colorOption, images);
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
  const mediaGroups = mapMediaGroups(source, options, images);
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
