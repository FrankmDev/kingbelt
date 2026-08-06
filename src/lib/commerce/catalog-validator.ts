import type {
  CommerceCollection,
  CommerceProduct,
  CurrencyCode,
  Money,
  ProductImage,
} from './types';

export interface CatalogValidationIssue {
  code: string;
  path: string;
  message: string;
}

const duplicateValues = (values: readonly string[]): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    const key = value.trim().toLocaleLowerCase('es');
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  });
  return duplicates;
};

const validateMoney = (
  money: Money,
  path: string,
  supported: ReadonlySet<CurrencyCode>,
  issues: CatalogValidationIssue[]
) => {
  if (!Number.isSafeInteger(money.amountMinor) || money.amountMinor < 0) {
    issues.push({ code: 'invalid_money', path, message: 'El importe debe ser un entero no negativo en unidades mínimas.' });
  }
  if (!supported.has(money.currency)) {
    issues.push({ code: 'unsupported_currency', path, message: `Moneda no soportada: ${money.currency}.` });
  }
};

const validateImage = (
  value: ProductImage,
  path: string,
  issues: CatalogValidationIssue[]
) => {
  if (value.url && !value.altText.trim()) {
    issues.push({ code: 'image_missing_alt', path, message: 'La imagen tiene URL pero no texto alternativo.' });
  }
  if (!value.placeholder && value.url && (!value.width || !value.height)) {
    issues.push({ code: 'image_missing_dimensions', path, message: 'La imagen final debe declarar ancho y alto conocidos.' });
  }
};

export const validateCatalog = (
  products: readonly CommerceProduct[],
  collections: readonly CommerceCollection[],
  supportedCurrencies: readonly CurrencyCode[] = ['EUR']
): CatalogValidationIssue[] => {
  const issues: CatalogValidationIssue[] = [];
  const supported = new Set(supportedCurrencies);

  duplicateValues(products.map((product) => product.handle)).forEach((handle) =>
    issues.push({ code: 'duplicate_product_handle', path: 'products', message: `Handle de producto duplicado: ${handle}.` })
  );
  duplicateValues(products.map((product) => product.id)).forEach((id) =>
    issues.push({ code: 'duplicate_product_id', path: 'products', message: `ID de producto duplicado: ${id}.` })
  );

  const variantIds: string[] = [];
  const skus: string[] = [];
  products.forEach((product, productIndex) => {
    const productPath = `products[${productIndex}]`;
    if (!product.reference.trim()) issues.push({ code: 'empty_reference', path: `${productPath}.reference`, message: 'La referencia de producto está vacía.' });
    if (!product.primaryImage) issues.push({ code: 'missing_primary_image', path: `${productPath}.primaryImage`, message: 'El producto no tiene imagen principal.' });
    if (!product.variants.length) issues.push({ code: 'product_without_variants', path: `${productPath}.variants`, message: 'El producto no tiene variantes.' });
    if (product.variants.length > 2_048) issues.push({ code: 'variant_limit_exceeded', path: `${productPath}.variants`, message: 'El producto supera el límite de 2.048 variantes.' });

    const optionValues = new Map(
      product.options.map((option) => [option.name, new Set(option.values.map((value) => value.value))])
    );
    const combinations = new Set<string>();
    product.variants.forEach((variant, variantIndex) => {
      const variantPath = `${productPath}.variants[${variantIndex}]`;
      variantIds.push(variant.id);
      if (!variant.sku.trim()) issues.push({ code: 'variant_without_sku', path: `${variantPath}.sku`, message: 'La variante no tiene SKU.' });
      else skus.push(variant.sku);
      const combination = [...variant.selectedOptions]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((option) => `${option.name}=${option.value}`)
        .join('|');
      if (combinations.has(combination)) issues.push({ code: 'duplicate_option_combination', path: variantPath, message: `Combinación de opciones duplicada: ${combination}.` });
      combinations.add(combination);
      variant.selectedOptions.forEach((selected) => {
        if (!optionValues.get(selected.name)?.has(selected.value)) {
          issues.push({ code: 'unknown_option_value', path: `${variantPath}.selectedOptions`, message: `La opción ${selected.name}=${selected.value} no existe en el producto.` });
        }
      });
      validateMoney(variant.price, `${variantPath}.price`, supported, issues);
      if (variant.compareAtPrice) validateMoney(variant.compareAtPrice, `${variantPath}.compareAtPrice`, supported, issues);
      if (variant.image) validateImage(variant.image, `${variantPath}.image`, issues);
    });
    if (product.primaryImage) validateImage(product.primaryImage, `${productPath}.primaryImage`, issues);
    product.gallery.forEach((item, index) => validateImage(item, `${productPath}.gallery[${index}]`, issues));
  });

  duplicateValues(variantIds).forEach((id) =>
    issues.push({ code: 'duplicate_variant_id', path: 'products.variants', message: `ID de variante duplicado: ${id}.` })
  );
  duplicateValues(skus).forEach((sku) =>
    issues.push({ code: 'duplicate_sku', path: 'products.variants', message: `SKU duplicado: ${sku}.` })
  );

  const productHandles = new Set(products.map((product) => product.handle));
  collections.forEach((collection, collectionIndex) => {
    collection.productHandles?.forEach((handle) => {
      if (!productHandles.has(handle)) {
        issues.push({ code: 'collection_unknown_product', path: `collections[${collectionIndex}].productHandles`, message: `La colección apunta a un producto inexistente: ${handle}.` });
      }
    });
  });
  return issues;
};
