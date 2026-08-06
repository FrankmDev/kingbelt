import type {
  CartProduct,
  CommerceProduct,
  CommerceProductSummary,
  ProductVariant,
} from './types';

export const toProductSummary = (product: CommerceProduct): CommerceProductSummary => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  reference: product.reference,
  primaryCollection: product.primaryCollection,
  productType: product.productType,
  primaryImage: product.primaryImage,
  shortDescription: product.shortDescription,
  priceRange: product.priceRange,
  availableForSale: product.availableForSale,
  colors: product.colors,
  badge: product.badge,
});

export const toCartProduct = (
  product: CommerceProduct,
  variant: ProductVariant
): CartProduct => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  collection: product.primaryCollection.title,
  reference: product.reference,
  unitPrice: variant.price,
  image: variant.image ?? product.primaryImage,
  href: `/productos/${product.handle}`,
});
