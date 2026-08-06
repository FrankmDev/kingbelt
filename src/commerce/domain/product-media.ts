import type { Product, ProductImage, ProductVariant } from './catalog';

const uniqueImages = (images: readonly ProductImage[]): ProductImage[] => {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.id)) return false;
    seen.add(image.id);
    return true;
  });
};

export const getProductImage = (
  product: Pick<Product, 'images'>,
  imageId: string | undefined
): ProductImage | undefined =>
  imageId ? product.images.find((image) => image.id === imageId) : undefined;

export const getPrimaryProductImage = (
  product: Pick<Product, 'images' | 'primaryImageId'>
): ProductImage | undefined =>
  getProductImage(product, product.primaryImageId) ?? product.images[0];

export const getVariantImage = (
  product: Pick<Product, 'images' | 'primaryImageId'>,
  variant: Pick<ProductVariant, 'imageId'>
): ProductImage | undefined =>
  getProductImage(product, variant.imageId) ?? getPrimaryProductImage(product);

export const getVariantGallery = (
  product: Pick<Product, 'images' | 'primaryImageId' | 'mediaGroups'>,
  variant?: Pick<ProductVariant, 'imageId' | 'optionValues'>
): ProductImage[] => {
  if (!variant) return [...product.images];

  const selectedValueIds = new Set(variant.optionValues.map((selection) => selection.valueId));
  const groupedImageIds = product.mediaGroups
    .filter((group) => selectedValueIds.has(group.optionValueId))
    .flatMap((group) => group.imageIds);
  const imageIds = variant.imageId
    ? [variant.imageId, ...groupedImageIds]
    : groupedImageIds;
  const images = uniqueImages(
    imageIds.flatMap((imageId) => {
      const image = getProductImage(product, imageId);
      return image ? [image] : [];
    })
  );

  return images.length ? images : [...product.images];
};
