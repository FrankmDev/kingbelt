import type { Product, ProductImage, ProductVariant } from './catalog';

export interface ColorGallery {
  optionValueId: string;
  images: ProductImage[];
}

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

/** Orden de la ficha: galerías de color en el orden comercial, después el resto. */
export const getProductGalleryImages = (
  product: Pick<Product, 'images' | 'mediaGroups'>
): ProductImage[] => {
  if (!product.mediaGroups.length) return [...product.images];

  const byId = new Map(product.images.map((image) => [image.id, image]));
  const seen = new Set<string>();
  const ordered: ProductImage[] = [];
  for (const group of product.mediaGroups) {
    for (const imageId of group.imageIds) {
      const image = byId.get(imageId);
      if (!image || seen.has(imageId)) continue;
      seen.add(imageId);
      ordered.push(image);
    }
  }
  for (const image of product.images) {
    if (seen.has(image.id)) continue;
    ordered.push(image);
  }
  return ordered;
};

/** Galerías por color (tres imágenes por grupo en la demo y en Shopify estructurado). */
export const getColorGalleries = (
  product: Pick<Product, 'images' | 'mediaGroups'>
): ColorGallery[] => {
  if (!product.mediaGroups.length) {
    return product.images.length ? [{ optionValueId: 'default', images: [...product.images] }] : [];
  }

  const byId = new Map(product.images.map((image) => [image.id, image]));
  return product.mediaGroups.flatMap((group) => {
    const images = group.imageIds.flatMap((imageId) => {
      const image = byId.get(imageId);
      return image ? [image] : [];
    });
    return images.length ? [{ optionValueId: group.optionValueId, images }] : [];
  });
};

export const getInitialColorValueId = (
  variant: Pick<ProductVariant, 'optionValues'> | undefined,
  galleries: readonly ColorGallery[]
): string | undefined => {
  const galleryIds = new Set(galleries.map((gallery) => gallery.optionValueId));
  return variant?.optionValues.find((selection) => galleryIds.has(selection.valueId))?.valueId
    ?? galleries[0]?.optionValueId;
};

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
