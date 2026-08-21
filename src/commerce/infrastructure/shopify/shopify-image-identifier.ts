const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_IDENTIFIER_LENGTH = 256;

/**
 * Storefront `Image.id` is a GraphQL `ID`. Shopify documents it as a unique
 * image identifier, not a closed GID resource taxonomy. Observed Storefront
 * values include ProductImage, ImageSource and CollectionImage.
 */
const SHOPIFY_IMAGE_GID_PATTERN = /^gid:\/\/shopify\/[A-Za-z][A-Za-z0-9]*\/[^/?#\s]+$/;

export const isShopifyImageIdentifier = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) return false;
  if (value !== value.trim()) return false;
  if (CONTROL_CHARACTER_PATTERN.test(value)) return false;
  return SHOPIFY_IMAGE_GID_PATTERN.test(value);
};
