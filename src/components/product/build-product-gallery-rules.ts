import type { ProductImage, ProductMediaGroup } from '@commerce/domain/catalog';
import {
  escapeCssAttributeValue,
  escapeCssIdentifier,
  escapeStyleElementContent,
} from '@shared/css/css-identifier';

export interface ProductGalleryRulesInput {
  idPrefix: string;
  images: readonly ProductImage[];
  mediaGroups?: readonly ProductMediaGroup[];
}

/** Reglas CSS por producto, generadas en build (sin runtime en cliente). */
export const buildProductGalleryRules = ({
  idPrefix,
  images,
  mediaGroups = [],
}: ProductGalleryRulesInput): string => {
  const safePrefix = escapeCssIdentifier(idPrefix);
  const groupName = `gallery-${safePrefix}`;
  const galleryClass = `product-gallery--${safePrefix}`;

  const slideRules = images.map((_, index) => {
    const inputId = `${groupName}-${index + 1}`;
    return `.${galleryClass}:has(#${inputId}:checked) .product-gallery__stage .product-gallery__slide:nth-child(${index + 1}){opacity:1;visibility:visible}`;
  });

  const thumbRules = images.flatMap((_, index) => {
    const inputId = `${groupName}-${index + 1}`;
    const escapedFor = escapeCssAttributeValue(inputId);
    return [
      `.${galleryClass}:has(#${inputId}:checked) .product-gallery__thumb[for="${escapedFor}"]{border-color:var(--color-king-accent);box-shadow:inset 0 0 0 1px var(--color-king-accent)}`,
      `.${galleryClass}:has(#${inputId}:checked) .product-gallery__thumb[for="${escapedFor}"] img{opacity:1}`,
      `.${galleryClass}:has(#${inputId}:focus-visible) .product-gallery__thumb[for="${escapedFor}"]{outline:2px solid var(--color-king-accent);outline-offset:3px}`,
    ];
  });

  const mediaGroupRules = mediaGroups.flatMap((group) => {
    const optionValue = escapeCssAttributeValue(group.optionValueId);
    const mediaGroupId = escapeCssAttributeValue(group.id);
    return [
      `[data-product-page]:has([data-product-option][value="${optionValue}"]:checked) .${galleryClass} [data-gallery-media-group="${mediaGroupId}"]{display:revert}`,
      `[data-product-page]:has([data-product-option][value="${optionValue}"]:checked) .${galleryClass} [data-gallery-media-group]:not([data-gallery-media-group="${mediaGroupId}"]){display:none}`,
    ];
  });

  return escapeStyleElementContent(slideRules.concat(thumbRules, mediaGroupRules).join(''));
};
