import type { Collection, Product } from '../domain/catalog';
import { toCollectionReference } from '../domain/product-mappers';
import type { CartCatalog, CartCatalogProduct, CartCatalogVariant } from './cart-service';

export const CART_CATALOG_PATH = '/cart-catalog.json';

export type { CartCatalogProduct };

export interface CartCatalogSnapshot {
  collections: Array<Pick<Collection, 'id' | 'handle' | 'title'>>;
  products: CartCatalogProduct[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const legacyProductKeys = (product: CartCatalogProduct): string[] => {
  const keys = [product.reference, product.handle, product.id];
  const legacyMatch = product.id.match(/local:product:([^:]+):(\d+)$/i);
  if (legacyMatch) {
    keys.push(`kb-${legacyMatch[1]}-${legacyMatch[2]}`);
  }
  return keys;
};

export const createCartCatalog = (
  products: readonly CartCatalogProduct[],
  collections: readonly Pick<Collection, 'id' | 'handle' | 'title'>[]
): CartCatalog => {
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
  const productsByLegacyKey = new Map<string, CartCatalogProduct>();
  products.forEach((product) => {
    legacyProductKeys(product).forEach((key) => {
      productsByLegacyKey.set(key.toLocaleLowerCase('es'), product);
    });
  });
  const variantsById = new Map<string, CartCatalogVariant>();
  products.forEach((product) => {
    const collection = collectionsById.get(product.primaryCollectionId);
    if (!collection) return;
    const primaryCollection = toCollectionReference(collection);
    product.variants.forEach((variant) => variantsById.set(variant.id, {
      product,
      variant,
      primaryCollection,
    }));
  });

  return {
    getVariant: (variantId) => variantsById.get(variantId),
    resolveLegacyVariant: (productId, color, size) => {
      const product = productsByLegacyKey.get(productId.toLocaleLowerCase('es'));
      if (!product) return undefined;
      const matches = product.variants.filter((variant) =>
        variant.optionValues.some((selection) => {
          const option = product.options.find((item) => item.id === selection.optionId);
          const value = option?.values.find((item) => item.id === selection.valueId);
          return option?.purpose === 'color' && value?.label === color;
        }) &&
        variant.optionValues.some((selection) => {
          const option = product.options.find((item) => item.id === selection.optionId);
          const value = option?.values.find((item) => item.id === selection.valueId);
          return option?.purpose === 'size' && value?.label === size;
        })
      );
      return matches.length === 1 ? matches[0] : undefined;
    },
  };
};

export const toCartCatalogSnapshot = (
  products: readonly Product[],
  collections: readonly Collection[]
): CartCatalogSnapshot => ({
  collections: collections.map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
  })),
  products: products.map((product) => ({
    id: product.id,
    handle: product.handle,
    title: product.title,
    reference: product.reference,
    primaryCollectionId: product.primaryCollectionId,
    options: product.options,
    variants: product.variants,
    images: product.images,
    primaryImageId: product.primaryImageId,
    mediaGroups: product.mediaGroups,
  })),
});

export const parseCartCatalogSnapshot = (value: unknown): CartCatalog | undefined => {
  if (!isRecord(value) || !Array.isArray(value.collections) || !Array.isArray(value.products)) {
    return undefined;
  }
  if (value.products.length > 5_000 || value.collections.length > 1_000) return undefined;

  const collections = value.collections.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === 'string' ? item.id : '';
    const handle = typeof item.handle === 'string' ? item.handle : '';
    const title = typeof item.title === 'string' ? item.title : '';
    return id && handle && title ? [{ id, handle, title }] : [];
  });
  if (collections.length !== value.collections.length) return undefined;

  const products = value.products as CartCatalogProduct[];
  if (products.some((product) =>
    !product
    || typeof product.id !== 'string'
    || typeof product.handle !== 'string'
    || typeof product.title !== 'string'
    || typeof product.reference !== 'string'
    || typeof product.primaryCollectionId !== 'string'
    || !Array.isArray(product.options)
    || !Array.isArray(product.variants)
    || !Array.isArray(product.images)
    || !Array.isArray(product.mediaGroups)
    || product.variants.some((variant) => !variant?.id || !variant.price)
  )) {
    return undefined;
  }

  return createCartCatalog(products, collections);
};
