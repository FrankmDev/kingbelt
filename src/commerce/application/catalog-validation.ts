import {
  COLOR_GALLERY_IMAGE_COUNT,
  type Collection,
  type Product,
  type ProductImage,
  type ProductSummary,
} from '../domain/catalog';
import type {
  CurrencyCode,
  Money,
} from '../domain/money';
import { isAllowedImageUrl } from '../domain/url-policy';

export interface CatalogValidationIssue {
  code: string;
  path: string;
  message: string;
}

export class CatalogValidationError extends Error {
  readonly issues: CatalogValidationIssue[];

  constructor(issues: CatalogValidationIssue[]) {
    super(`El catálogo contiene ${issues.length} ${issues.length === 1 ? 'error' : 'errores'} de validación.`);
    this.name = 'CatalogValidationError';
    this.issues = issues;
  }
}

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;
const MAX_IDENTIFIER_LENGTH = 256;
const MAX_CATALOG_TEXT_LENGTH = 10_000;
const MAX_CATALOG_PRODUCTS = 5_000;
const MAX_CATALOG_COLLECTIONS = 1_000;
export const SHOPIFY_MAX_PRODUCT_OPTIONS = 3;
export const SHOPIFY_MAX_PRODUCT_VARIANTS = 2_048;

const normalizedKey = (value: string): string =>
  value.trim().toLocaleLowerCase('es');

const duplicateValues = (values: readonly string[]): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    const key = normalizedKey(value);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  });
  return duplicates;
};

const issue = (
  issues: CatalogValidationIssue[],
  code: string,
  path: string,
  message: string
) => issues.push({ code, path, message });

const validateIdentifier = (
  value: unknown,
  path: string,
  code: string,
  label: string,
  issues: CatalogValidationIssue[]
) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    issue(issues, code, path, `${label} debe ser un identificador no vacío, sin espacios exteriores ni caracteres de control.`);
  }
};

const validateRequiredText = (
  value: unknown,
  path: string,
  code: string,
  label: string,
  issues: CatalogValidationIssue[]
) => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_CATALOG_TEXT_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    issue(issues, code, path, `${label} debe contener texto válido.`);
  } else if (HTML_TAG_PATTERN.test(value)) {
    issue(
      issues,
      'unsafe_catalog_html',
      path,
      `${label} debe ser texto plano; el HTML del proveedor no se admite.`
    );
  }
};

const validateHandle = (
  value: unknown,
  path: string,
  issues: CatalogValidationIssue[]
) => {
  if (typeof value !== 'string' || value.length > 128 || !HANDLE_PATTERN.test(value)) {
    issue(issues, 'invalid_handle', path, 'El handle debe usar minúsculas ASCII separadas por guiones.');
  }
};

const validateMoney = (
  money: Money,
  path: string,
  supported: ReadonlySet<CurrencyCode>,
  issues: CatalogValidationIssue[]
) => {
  if (!Number.isSafeInteger(money.amountMinor) || money.amountMinor < 0) {
    issue(issues, 'invalid_money', path, 'El importe debe ser un entero no negativo en unidades mínimas.');
  }
  if (!CURRENCY_PATTERN.test(money.currency)) {
    issue(issues, 'invalid_currency', `${path}.currency`, 'La moneda debe ser un código ISO 4217 de tres letras mayúsculas.');
  } else if (!supported.has(money.currency)) {
    issue(issues, 'unsupported_currency', `${path}.currency`, `Moneda no soportada: ${money.currency}.`);
  }
};

const validateImage = (
  value: ProductImage,
  path: string,
  issues: CatalogValidationIssue[],
  allowedRemoteImageHosts: readonly string[]
) => {
  validateIdentifier(value.id, `${path}.id`, 'invalid_image_id', 'El ID de imagen', issues);
  if (!isAllowedImageUrl(value.url, allowedRemoteImageHosts)) {
    issue(
      issues,
      'invalid_image_url',
      `${path}.url`,
      'La imagen debe usar una ruta raíz o HTTPS hacia un host aprobado de forma exacta.'
    );
  }
  validateRequiredText(value.altText, `${path}.altText`, 'image_missing_alt', 'El texto alternativo', issues);

  if (!Number.isInteger(value.width) || value.width <= 0) {
    issue(issues, 'invalid_image_width', `${path}.width`, 'El ancho debe ser un entero positivo.');
  }
  if (!Number.isInteger(value.height) || value.height <= 0) {
    issue(issues, 'invalid_image_height', `${path}.height`, 'El alto debe ser un entero positivo.');
  }
  if (value.position && (value.position.length > 100 || /[;{}]/.test(value.position))) {
    issue(issues, 'invalid_image_position', `${path}.position`, 'La posición de imagen contiene caracteres no permitidos.');
  }
};

const validateOptionalText = (
  value: string | undefined,
  path: string,
  code: string,
  label: string,
  issues: CatalogValidationIssue[]
) => {
  if (value !== undefined) validateRequiredText(value, path, code, label, issues);
};

export interface CatalogValidationOptions {
  requireColorGalleries?: boolean;
}

export const validateCatalog = (
  products: readonly Product[],
  collections: readonly Collection[],
  supportedCurrencies: readonly CurrencyCode[] = ['EUR'],
  allowedRemoteImageHosts: readonly string[] = [],
  options: CatalogValidationOptions = {}
): CatalogValidationIssue[] => {
  const issues: CatalogValidationIssue[] = [];
  const supported = new Set(supportedCurrencies);
  const requireColorGalleries = options.requireColorGalleries !== false;

  if (!products.length) {
    issue(issues, 'empty_catalog', 'products', 'El catálogo normalizado no puede estar vacío.');
  }
  if (!collections.length) {
    issue(issues, 'empty_catalog', 'collections', 'El catálogo normalizado debe incluir sus colecciones.');
  }

  if (products.length > MAX_CATALOG_PRODUCTS) {
    issue(issues, 'catalog_too_large', 'products', `El catálogo supera ${MAX_CATALOG_PRODUCTS} productos.`);
  }
  if (collections.length > MAX_CATALOG_COLLECTIONS) {
    issue(issues, 'catalog_too_large', 'collections', `El catálogo supera ${MAX_CATALOG_COLLECTIONS} colecciones.`);
  }

  if (!supported.size) {
    issue(issues, 'missing_supported_currency', 'supportedCurrencies', 'Debe existir al menos una moneda soportada.');
  }
  supportedCurrencies.forEach((currency, index) => {
    if (!CURRENCY_PATTERN.test(currency)) {
      issue(issues, 'invalid_currency', `supportedCurrencies[${index}]`, 'La moneda soportada debe usar tres letras mayúsculas.');
    }
  });
  duplicateValues(supportedCurrencies).forEach((currency) =>
    issue(issues, 'duplicate_supported_currency', 'supportedCurrencies', `Moneda soportada duplicada: ${currency}.`)
  );

  duplicateValues(products.map((product) => product.handle)).forEach((handle) =>
    issue(issues, 'duplicate_product_handle', 'products', `Handle de producto duplicado: ${handle}.`)
  );
  duplicateValues(products.map((product) => product.id)).forEach((id) =>
    issue(issues, 'duplicate_product_id', 'products', `ID de producto duplicado: ${id}.`)
  );
  duplicateValues(products.map((product) => product.reference)).forEach((reference) =>
    issue(issues, 'duplicate_product_reference', 'products', `Referencia comercial duplicada: ${reference}.`)
  );
  duplicateValues(collections.map((collection) => collection.handle)).forEach((handle) =>
    issue(issues, 'duplicate_collection_handle', 'collections', `Handle de colección duplicado: ${handle}.`)
  );
  duplicateValues(collections.map((collection) => collection.id)).forEach((id) =>
    issue(issues, 'duplicate_collection_id', 'collections', `ID de colección duplicado: ${id}.`)
  );

  const collectionIds = new Set(collections.map((collection) => collection.id));
  const variantIds: string[] = [];
  const skus: string[] = [];
  const allImageIds: string[] = [];

  collections.forEach((collection, collectionIndex) => {
    const path = `collections[${collectionIndex}]`;
    validateIdentifier(collection.id, `${path}.id`, 'invalid_collection_id', 'El ID de colección', issues);
    validateHandle(collection.handle, `${path}.handle`, issues);
    validateRequiredText(collection.title, `${path}.title`, 'empty_collection_title', 'El título de colección', issues);
    validateRequiredText(collection.description, `${path}.description`, 'empty_collection_description', 'La descripción de colección', issues);
    validateOptionalText(collection.badge, `${path}.badge`, 'empty_collection_badge', 'El distintivo de colección', issues);
    validateOptionalText(collection.tagline, `${path}.tagline`, 'empty_collection_tagline', 'El tagline de colección', issues);
    if (collection.image) {
      validateImage(collection.image, `${path}.image`, issues, allowedRemoteImageHosts);
      allImageIds.push(collection.image.id);
    }
  });

  products.forEach((product, productIndex) => {
    const productPath = `products[${productIndex}]`;
    validateIdentifier(product.id, `${productPath}.id`, 'invalid_product_id', 'El ID de producto', issues);
    validateIdentifier(product.reference, `${productPath}.reference`, 'invalid_product_reference', 'La referencia comercial', issues);
    validateHandle(product.handle, `${productPath}.handle`, issues);
    validateRequiredText(product.title, `${productPath}.title`, 'empty_product_title', 'El título de producto', issues);
    validateRequiredText(product.vendor, `${productPath}.vendor`, 'empty_vendor', 'El vendor', issues);
    validateRequiredText(product.productType, `${productPath}.productType`, 'empty_product_type', 'El tipo de producto', issues);
    validateIdentifier(product.category?.id, `${productPath}.category.id`, 'invalid_product_category', 'El ID de categoría oficial', issues);
    validateRequiredText(product.category?.name, `${productPath}.category.name`, 'invalid_product_category', 'La categoría oficial', issues);
    if (!['published', 'unpublished'].includes(product.publicationStatus)) {
      issue(issues, 'invalid_publication_status', `${productPath}.publicationStatus`, 'El estado de publicación no es válido.');
    } else if (product.publicationStatus !== 'published') {
      issue(issues, 'unpublished_product', `${productPath}.publicationStatus`, 'Un catálogo publicable no puede contener productos no publicados para el canal.');
    }
    validateRequiredText(product.summary, `${productPath}.summary`, 'empty_product_summary', 'El resumen', issues);
    validateRequiredText(product.description, `${productPath}.description`, 'empty_product_description', 'La descripción', issues);
    validateOptionalText(product.badge, `${productPath}.badge`, 'empty_product_badge', 'El distintivo de producto', issues);
    validateOptionalText(product.seo?.title, `${productPath}.seo.title`, 'empty_seo_title', 'El título SEO', issues);
    validateOptionalText(product.seo?.description, `${productPath}.seo.description`, 'empty_seo_description', 'La descripción SEO', issues);

    if (!product.collectionIds.length) {
      issue(issues, 'product_without_collection', `${productPath}.collectionIds`, 'El producto debe pertenecer al menos a una colección.');
    }
    duplicateValues(product.collectionIds).forEach((id) =>
      issue(issues, 'duplicate_product_collection', `${productPath}.collectionIds`, `Colección repetida en el producto: ${id}.`)
    );
    product.collectionIds.forEach((id, index) => {
      if (!collectionIds.has(id)) {
        issue(issues, 'unknown_product_collection', `${productPath}.collectionIds[${index}]`, `Colección inexistente: ${id}.`);
      }
    });
    if (!product.collectionIds.includes(product.primaryCollectionId)) {
      issue(issues, 'primary_collection_not_assigned', `${productPath}.primaryCollectionId`, 'La colección principal debe pertenecer al producto.');
    }
    if (!collectionIds.has(product.primaryCollectionId)) {
      issue(issues, 'unknown_primary_collection', `${productPath}.primaryCollectionId`, `Colección principal inexistente: ${product.primaryCollectionId}.`);
    }
    validateIdentifier(
      product.primaryCollectionId,
      `${productPath}.primaryCollectionId`,
      'invalid_primary_collection',
      'La colección principal',
      issues
    );

    const optionIds = product.options.map((option) => option.id);
    const optionNames = product.options.map((option) => option.name);
    duplicateValues(optionIds).forEach((id) =>
      issue(issues, 'duplicate_option_id', `${productPath}.options`, `ID de opción duplicado: ${id}.`)
    );
    duplicateValues(optionNames).forEach((name) =>
      issue(issues, 'duplicate_option_name', `${productPath}.options`, `Nombre de opción duplicado: ${name}.`)
    );
    if (product.options.length > SHOPIFY_MAX_PRODUCT_OPTIONS) {
      issue(
        issues,
        'too_many_product_options',
        `${productPath}.options`,
        `Shopify admite como máximo ${SHOPIFY_MAX_PRODUCT_OPTIONS} opciones por producto.`
      );
    }
    const purposes = product.options.flatMap((option) => option.purpose ? [option.purpose] : []);
    duplicateValues(purposes).forEach((purpose) =>
      issue(issues, 'duplicate_option_purpose', `${productPath}.options`, `Propósito de opción duplicado: ${purpose}.`)
    );

    const valueToOption = new Map<string, string>();
    const usedValueIds = new Set<string>();
    product.options.forEach((option, optionIndex) => {
      const optionPath = `${productPath}.options[${optionIndex}]`;
      validateIdentifier(option.id, `${optionPath}.id`, 'invalid_option_id', 'El ID de opción', issues);
      validateRequiredText(option.name, `${optionPath}.name`, 'empty_option_name', 'El nombre de opción', issues);
      if (!option.values.length) {
        issue(issues, 'option_without_values', `${optionPath}.values`, 'La opción debe declarar al menos un valor.');
      }
      duplicateValues(option.values.map((value) => value.id)).forEach((id) =>
        issue(issues, 'duplicate_option_value_id', `${optionPath}.values`, `ID de valor duplicado: ${id}.`)
      );
      duplicateValues(option.values.map((value) => value.label)).forEach((label) =>
        issue(issues, 'duplicate_option_value_label', `${optionPath}.values`, `Etiqueta de valor duplicada: ${label}.`)
      );
      option.values.forEach((value, valueIndex) => {
        const valuePath = `${optionPath}.values[${valueIndex}]`;
        validateIdentifier(value.id, `${valuePath}.id`, 'invalid_option_value_id', 'El ID de valor', issues);
        validateRequiredText(value.label, `${valuePath}.label`, 'empty_option_value_label', 'La etiqueta de valor', issues);
        if (valueToOption.has(value.id)) {
          issue(issues, 'duplicate_product_option_value_id', `${valuePath}.id`, `El ID de valor ya pertenece a otra opción: ${value.id}.`);
        } else {
          valueToOption.set(value.id, option.id);
        }
        if (value.swatch && !/^#[0-9a-f]{3,8}$/i.test(value.swatch) && !/^linear-gradient\([^;{}]+\)$/i.test(value.swatch)) {
          issue(issues, 'invalid_option_swatch', `${valuePath}.swatch`, 'La muestra debe ser un color hexadecimal o un gradiente lineal seguro.');
        }
      });
    });

    const imageIds = new Set<string>();
    product.images.forEach((image, imageIndex) => {
      const imagePath = `${productPath}.images[${imageIndex}]`;
      validateImage(image, imagePath, issues, allowedRemoteImageHosts);
      if (imageIds.has(image.id)) {
        issue(issues, 'duplicate_product_image_id', `${imagePath}.id`, `ID de imagen duplicado en el producto: ${image.id}.`);
      }
      imageIds.add(image.id);
      allImageIds.push(image.id);
    });
    if (!product.primaryImageId) {
      issue(issues, 'missing_primary_image', `${productPath}.primaryImageId`, 'El producto no tiene imagen principal.');
    } else if (!imageIds.has(product.primaryImageId)) {
      issue(issues, 'unknown_primary_image', `${productPath}.primaryImageId`, `La imagen principal no existe: ${product.primaryImageId}.`);
    }

    const mediaGroupIds = product.mediaGroups.map((group) => group.id);
    const colorOption = product.options.find((option) => option.purpose === 'color');
    const colorValueIds = new Set(colorOption?.values.map((value) => value.id) ?? []);
    const mediaGroupByValue = new Map(product.mediaGroups.map((group) => [group.optionValueId, group]));
    duplicateValues(mediaGroupIds).forEach((id) =>
      issue(issues, 'duplicate_media_group_id', `${productPath}.mediaGroups`, `ID de grupo de medios duplicado: ${id}.`)
    );
    duplicateValues(product.mediaGroups.map((group) => group.optionValueId)).forEach((id) =>
      issue(issues, 'duplicate_media_group_option_value', `${productPath}.mediaGroups`, `El valor de opción tiene más de un grupo de medios: ${id}.`)
    );
    product.mediaGroups.forEach((group, groupIndex) => {
      const groupPath = `${productPath}.mediaGroups[${groupIndex}]`;
      validateIdentifier(group.id, `${groupPath}.id`, 'invalid_media_group_id', 'El ID del grupo de medios', issues);
      if (!valueToOption.has(group.optionValueId)) {
        issue(issues, 'media_group_unknown_option_value', `${groupPath}.optionValueId`, `Valor de opción inexistente: ${group.optionValueId}.`);
      }
      if (colorOption && !colorValueIds.has(group.optionValueId)) {
        issue(issues, 'media_group_not_color', `${groupPath}.optionValueId`, 'Cada grupo de medios debe pertenecer a un valor de la opción Color.');
      }
      if (!group.imageIds.length) {
        issue(issues, 'empty_media_group', `${groupPath}.imageIds`, 'El grupo de medios debe contener al menos una imagen.');
      } else if (colorOption && requireColorGalleries && group.imageIds.length !== COLOR_GALLERY_IMAGE_COUNT) {
        issue(
          issues,
          'invalid_color_gallery_cardinality',
          `${groupPath}.imageIds`,
          `Cada galería de color debe contener exactamente ${COLOR_GALLERY_IMAGE_COUNT} imágenes.`
        );
      }
      duplicateValues(group.imageIds).forEach((id) =>
        issue(issues, 'duplicate_media_group_image', `${groupPath}.imageIds`, `Imagen repetida en el grupo: ${id}.`)
      );
      group.imageIds.forEach((id, imageIndex) => {
        if (!imageIds.has(id)) {
          issue(issues, 'media_group_unknown_image', `${groupPath}.imageIds[${imageIndex}]`, `Imagen inexistente: ${id}.`);
        }
      });
    });
    if (colorOption && (requireColorGalleries || product.mediaGroups.length > 0)) {
      colorOption.values.forEach((value, valueIndex) => {
        if (!mediaGroupByValue.has(value.id)) {
          issue(issues, 'missing_color_media_group', `${productPath}.options[${product.options.indexOf(colorOption)}].values[${valueIndex}]`, `El color ${value.label} no tiene una galería asociada.`);
        }
      });
      const firstColorImageId = mediaGroupByValue.get(colorOption.values[0]?.id)?.imageIds[0];
      if (firstColorImageId && product.primaryImageId !== firstColorImageId) {
        issue(issues, 'primary_image_color_mismatch', `${productPath}.primaryImageId`, 'La imagen principal debe ser la primera del primer color publicado.');
      }
    }

    if (!product.variants.length) {
      issue(issues, 'product_without_variants', `${productPath}.variants`, 'El producto no tiene variantes.');
    }
    if (product.variants.length > SHOPIFY_MAX_PRODUCT_VARIANTS) {
      issue(
        issues,
        'too_many_product_variants',
        `${productPath}.variants`,
        `Shopify admite como máximo ${SHOPIFY_MAX_PRODUCT_VARIANTS.toLocaleString('es-ES')} variantes por producto.`
      );
    }
    const combinations = new Set<string>();
    const productCurrencies = new Set<string>();
    product.variants.forEach((variant, variantIndex) => {
      const variantPath = `${productPath}.variants[${variantIndex}]`;
      validateIdentifier(variant.id, `${variantPath}.id`, 'invalid_variant_id', 'El ID de variante', issues);
      validateIdentifier(variant.sku, `${variantPath}.sku`, 'invalid_sku', 'El SKU', issues);
      variantIds.push(variant.id);
      skus.push(variant.sku);
      validateOptionalText(variant.title, `${variantPath}.title`, 'empty_variant_title', 'El título de variante', issues);

      const selectedOptionIds = variant.optionValues.map((selection) => selection.optionId);
      duplicateValues(selectedOptionIds).forEach((id) =>
        issue(issues, 'duplicate_variant_option', `${variantPath}.optionValues`, `La variante selecciona dos valores para la opción: ${id}.`)
      );
      if (variant.optionValues.length !== product.options.length) {
        issue(issues, 'incomplete_variant_options', `${variantPath}.optionValues`, 'La variante debe seleccionar exactamente un valor de cada opción.');
      }
      variant.optionValues.forEach((selection, selectionIndex) => {
        const selectionPath = `${variantPath}.optionValues[${selectionIndex}]`;
        const expectedOptionId = valueToOption.get(selection.valueId);
        if (!optionIds.includes(selection.optionId)) {
          issue(issues, 'unknown_variant_option', `${selectionPath}.optionId`, `Opción inexistente: ${selection.optionId}.`);
        } else if (!expectedOptionId) {
          issue(issues, 'unknown_option_value', `${selectionPath}.valueId`, `Valor de opción inexistente: ${selection.valueId}.`);
        } else if (expectedOptionId !== selection.optionId) {
          issue(issues, 'option_value_mismatch', selectionPath, `El valor ${selection.valueId} no pertenece a la opción ${selection.optionId}.`);
        } else {
          usedValueIds.add(selection.valueId);
        }
      });
      const selectionByOption = new Map(variant.optionValues.map((selection) => [selection.optionId, selection.valueId]));
      const combination = product.options.map((option) => `${option.id}=${selectionByOption.get(option.id) ?? ''}`).join('|');
      if (combinations.has(combination)) {
        issue(issues, 'duplicate_option_combination', variantPath, `Combinación de opciones duplicada: ${combination}.`);
      }
      combinations.add(combination);

      validateMoney(variant.price, `${variantPath}.price`, supported, issues);
      productCurrencies.add(variant.price.currency);
      if (variant.compareAtPrice) {
        validateMoney(variant.compareAtPrice, `${variantPath}.compareAtPrice`, supported, issues);
        if (variant.compareAtPrice.currency !== variant.price.currency) {
          issue(issues, 'compare_price_currency_mismatch', `${variantPath}.compareAtPrice.currency`, 'El precio comparado debe usar la moneda del precio.');
        }
        if (variant.compareAtPrice.amountMinor <= variant.price.amountMinor) {
          issue(issues, 'invalid_compare_price', `${variantPath}.compareAtPrice`, 'El precio comparado debe ser mayor que el precio vigente.');
        }
      }
      if (!['active', 'unavailable'].includes(variant.salesStatus)) {
        issue(issues, 'invalid_variant_sales_status', `${variantPath}.salesStatus`, 'El estado comercial de variante no es válido.');
      }
      if (!['deny', 'continue'].includes(variant.inventoryPolicy)) {
        issue(issues, 'invalid_inventory_policy', `${variantPath}.inventoryPolicy`, 'La política de inventario no es válida.');
      }
      if (variant.inventory.kind === 'known') {
        if (!Number.isSafeInteger(variant.inventory.quantity) || variant.inventory.quantity < 0) {
          issue(issues, 'invalid_inventory_quantity', `${variantPath}.inventory.quantity`, 'El inventario conocido debe ser un entero no negativo.');
        }
      } else if (variant.inventory.kind !== 'unknown') {
        issue(issues, 'invalid_inventory', `${variantPath}.inventory`, 'El inventario debe ser conocido o desconocido.');
      }
      const quantityRule = variant.quantityRule;
      if (!quantityRule || typeof quantityRule !== 'object') {
        issue(issues, 'missing_quantity_rule', `${variantPath}.quantityRule`, 'La variante debe declarar su regla de cantidad completa.');
      } else {
        if (!Number.isSafeInteger(quantityRule.minimum) || quantityRule.minimum < 1) {
          issue(issues, 'invalid_quantity_minimum', `${variantPath}.quantityRule.minimum`, 'El mínimo debe ser un entero positivo.');
        } else if (quantityRule.minimum !== 1) {
          issue(issues, 'unsupported_quantity_minimum', `${variantPath}.quantityRule.minimum`, 'KingBelt admite actualmente un mínimo de cantidad igual a 1.');
        }
        if (!Number.isSafeInteger(quantityRule.increment) || quantityRule.increment < 1) {
          issue(issues, 'invalid_quantity_increment', `${variantPath}.quantityRule.increment`, 'El incremento debe ser un entero positivo.');
        } else if (quantityRule.increment !== 1) {
          issue(issues, 'unsupported_quantity_increment', `${variantPath}.quantityRule.increment`, 'KingBelt admite actualmente un incremento de cantidad igual a 1.');
        }
        if (
          quantityRule.maximum !== undefined &&
          (!Number.isSafeInteger(quantityRule.maximum) || quantityRule.maximum < quantityRule.minimum)
        ) {
          issue(issues, 'invalid_quantity_maximum', `${variantPath}.quantityRule.maximum`, 'El máximo debe ser un entero igual o superior al mínimo.');
        } else if (
          quantityRule.maximum !== undefined &&
          Number.isSafeInteger(quantityRule.minimum) &&
          Number.isSafeInteger(quantityRule.increment) &&
          (quantityRule.maximum - quantityRule.minimum) % quantityRule.increment !== 0
        ) {
          issue(issues, 'unaligned_quantity_maximum', `${variantPath}.quantityRule.maximum`, 'El máximo debe estar alineado con el mínimo y el incremento.');
        }
      }
      if (variant.weight) {
        if (!Number.isFinite(variant.weight.value) || variant.weight.value <= 0) {
          issue(issues, 'invalid_weight', `${variantPath}.weight.value`, 'El peso debe ser positivo y finito.');
        }
        if (!['g', 'kg', 'oz', 'lb'].includes(variant.weight.unit)) {
          issue(issues, 'invalid_weight_unit', `${variantPath}.weight.unit`, 'La unidad de peso no está soportada.');
        }
      }
      if (variant.imageId) {
        if (!imageIds.has(variant.imageId)) {
          issue(issues, 'variant_unknown_image', `${variantPath}.imageId`, `Imagen de variante inexistente: ${variant.imageId}.`);
        }
      }
      if (colorOption && (requireColorGalleries || product.mediaGroups.length > 0)) {
        const selectedColorId = selectionByOption.get(colorOption.id);
        const expectedImageId = selectedColorId ? mediaGroupByValue.get(selectedColorId)?.imageIds[0] : undefined;
        if (!variant.imageId) {
          issue(issues, 'missing_variant_color_image', `${variantPath}.imageId`, 'La variante debe referenciar la imagen principal de su color.');
        } else if (expectedImageId && variant.imageId !== expectedImageId) {
          issue(issues, 'variant_color_image_mismatch', `${variantPath}.imageId`, 'La variante debe referenciar la primera imagen de su galería de color.');
        }
      }
    });
    if (productCurrencies.size > 1) {
      issue(issues, 'mixed_product_currencies', `${productPath}.variants`, 'Todas las variantes del producto deben usar la misma moneda.');
    }
    product.options.forEach((option, optionIndex) => {
      option.values.forEach((value, valueIndex) => {
        if (!usedValueIds.has(value.id)) {
          issue(issues, 'unused_option_value', `${productPath}.options[${optionIndex}].values[${valueIndex}]`, `Ninguna variante usa el valor ${value.label}.`);
        }
      });
    });

    duplicateValues(product.specifications.map((specification) => specification.label)).forEach((label) =>
      issue(issues, 'duplicate_specification_label', `${productPath}.specifications`, `Especificación duplicada: ${label}.`)
    );
    product.specifications.forEach((specification, specificationIndex) => {
      const path = `${productPath}.specifications[${specificationIndex}]`;
      validateRequiredText(specification.label, `${path}.label`, 'empty_specification_label', 'La etiqueta de especificación', issues);
      validateRequiredText(specification.value, `${path}.value`, 'empty_specification_value', 'El valor de especificación', issues);
    });
  });

  duplicateValues(variantIds).forEach((id) =>
    issue(issues, 'duplicate_variant_id', 'products.variants', `ID de variante duplicado: ${id}.`)
  );
  duplicateValues(skus).forEach((value) =>
    issue(issues, 'duplicate_sku', 'products.variants', `SKU duplicado: ${value}.`)
  );
  duplicateValues(allImageIds).forEach((id) =>
    issue(issues, 'duplicate_image_id', 'catalog.images', `ID de imagen duplicado en el catálogo: ${id}.`)
  );

  const productIdentities = new Set(products.map((product) => normalizedKey(product.id)));
  variantIds.forEach((id) => {
    if (productIdentities.has(normalizedKey(id))) {
      issue(issues, 'product_variant_identity_collision', 'products', `Un producto y una variante comparten identidad: ${id}.`);
    }
  });
  const entityIdentities = new Set([
    ...products.map((product) => normalizedKey(product.id)),
    ...variantIds.map(normalizedKey),
  ]);
  skus.forEach((value) => {
    if (entityIdentities.has(normalizedKey(value))) {
      issue(issues, 'entity_sku_identity_collision', 'products.variants', `Un SKU coincide con la identidad de una entidad: ${value}.`);
    }
  });

  return issues;
};

export const assertValidCatalog = (
  products: readonly Product[],
  collections: readonly Collection[],
  supportedCurrencies: readonly CurrencyCode[] = ['EUR'],
  allowedRemoteImageHosts: readonly string[] = [],
  options: CatalogValidationOptions = {}
): void => {
  const issues = validateCatalog(
    products,
    collections,
    supportedCurrencies,
    allowedRemoteImageHosts,
    options
  );
  if (issues.length) throw new CatalogValidationError(issues);
};

/** Valida una lista de colecciones sin exigir productos ni catálogo completo. */
export const assertValidCollections = (
  collections: readonly Collection[],
  allowedRemoteImageHosts: readonly string[] = []
): void => {
  const issues: CatalogValidationIssue[] = [];
  if (collections.length > MAX_CATALOG_COLLECTIONS) {
    issue(issues, 'catalog_too_large', 'collections', `El catálogo supera ${MAX_CATALOG_COLLECTIONS} colecciones.`);
  }
  duplicateValues(collections.map((collection) => collection.handle)).forEach((handle) =>
    issue(issues, 'duplicate_collection_handle', 'collections', `Handle de colección duplicado: ${handle}.`)
  );
  duplicateValues(collections.map((collection) => collection.id)).forEach((id) =>
    issue(issues, 'duplicate_collection_id', 'collections', `ID de colección duplicado: ${id}.`)
  );
  collections.forEach((collection, collectionIndex) => {
    const path = `collections[${collectionIndex}]`;
    validateIdentifier(collection.id, `${path}.id`, 'invalid_collection_id', 'El ID de colección', issues);
    validateHandle(collection.handle, `${path}.handle`, issues);
    validateRequiredText(collection.title, `${path}.title`, 'empty_collection_title', 'El título de colección', issues);
    validateRequiredText(collection.description, `${path}.description`, 'empty_collection_description', 'La descripción de colección', issues);
    validateOptionalText(collection.badge, `${path}.badge`, 'empty_collection_badge', 'El distintivo de colección', issues);
    validateOptionalText(collection.tagline, `${path}.tagline`, 'empty_collection_tagline', 'El tagline de colección', issues);
    if (collection.image) {
      validateImage(collection.image, `${path}.image`, issues, allowedRemoteImageHosts);
    }
  });
  if (issues.length) throw new CatalogValidationError(issues);
};

/** Valida la proyección de tarjeta sin exigir el producto completo. */
export const assertValidProductSummary = (
  product: ProductSummary,
  supportedCurrencies: readonly CurrencyCode[] = ['EUR'],
  allowedRemoteImageHosts: readonly string[] = []
): void => {
  const issues: CatalogValidationIssue[] = [];
  const supported = new Set(supportedCurrencies);
  const path = `summaries.${product.handle || product.id || 'product'}`;
  validateIdentifier(product.id, `${path}.id`, 'invalid_product_id', 'El ID de producto', issues);
  validateIdentifier(product.reference, `${path}.reference`, 'invalid_product_reference', 'La referencia comercial', issues);
  validateHandle(product.handle, `${path}.handle`, issues);
  validateRequiredText(product.title, `${path}.title`, 'empty_product_title', 'El título de producto', issues);
  validateRequiredText(product.productType, `${path}.productType`, 'empty_product_type', 'El tipo de producto', issues);
  validateRequiredText(product.summary, `${path}.summary`, 'empty_product_summary', 'El resumen', issues);
  validateOptionalText(product.badge, `${path}.badge`, 'empty_product_badge', 'El distintivo de producto', issues);
  validateIdentifier(
    product.primaryCollection.id,
    `${path}.primaryCollection.id`,
    'invalid_collection_id',
    'El ID de colección',
    issues
  );
  validateHandle(product.primaryCollection.handle, `${path}.primaryCollection.handle`, issues);
  validateRequiredText(
    product.primaryCollection.title,
    `${path}.primaryCollection.title`,
    'empty_collection_title',
    'El título de colección',
    issues
  );
  if (product.primaryImage) {
    validateImage(product.primaryImage, `${path}.primaryImage`, issues, allowedRemoteImageHosts);
  }
  validateMoney(product.priceRange.min, `${path}.priceRange.min`, supported, issues);
  validateMoney(product.priceRange.max, `${path}.priceRange.max`, supported, issues);
  if (product.priceRange.min.currency !== product.priceRange.max.currency) {
    issue(issues, 'mixed_product_currencies', `${path}.priceRange`, 'El rango de precio debe usar una sola moneda.');
  } else if (product.priceRange.min.amountMinor > product.priceRange.max.amountMinor) {
    issue(issues, 'invalid_money', `${path}.priceRange`, 'El precio mínimo no puede superar el máximo.');
  }
  if (typeof product.purchasable !== 'boolean') {
    issue(issues, 'invalid_inventory', `${path}.purchasable`, 'La disponibilidad de la tarjeta debe ser un booleano.');
  }
  duplicateValues(product.colors.map((color) => color.id)).forEach((id) =>
    issue(issues, 'duplicate_option_value_id', `${path}.colors`, `ID de valor duplicado: ${id}.`)
  );
  product.colors.forEach((color, colorIndex) => {
    const colorPath = `${path}.colors[${colorIndex}]`;
    validateIdentifier(color.id, `${colorPath}.id`, 'invalid_option_value_id', 'El ID de valor', issues);
    validateRequiredText(color.label, `${colorPath}.label`, 'empty_option_value_label', 'La etiqueta de valor', issues);
    if (color.swatch && !/^#[0-9a-f]{3,8}$/i.test(color.swatch) && !/^linear-gradient\([^;{}]+\)$/i.test(color.swatch)) {
      issue(issues, 'invalid_option_swatch', `${colorPath}.swatch`, 'La muestra debe ser un color hexadecimal o un gradiente lineal seguro.');
    }
  });
  if (issues.length) throw new CatalogValidationError(issues);
};
