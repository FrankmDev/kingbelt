import { getAllProductDetails } from '../../data/catalog';
import { toCartProduct } from './product-mapper';
import type { LocalCatalogProduct } from './types';

/**
 * Catálogo público mínimo del proveedor local. Se incluye en el cliente para
 * resolver IDs persistidos sin confiar en precios, URLs o copy de localStorage.
 */
const localCatalog = new Map<string, LocalCatalogProduct>(
  getAllProductDetails().map((product) => [
    product.id,
    {
      product: toCartProduct(product),
      colors: product.colorOptions.map((option) => option.name),
      sizes: [...product.sizes],
    },
  ])
);

export const getLocalCatalogProduct = (productId: string): LocalCatalogProduct | undefined =>
  localCatalog.get(productId);

export const isKnownProductSelection = (
  entry: LocalCatalogProduct,
  color: string,
  size: string
): boolean => entry.colors.includes(color) && entry.sizes.includes(size);
