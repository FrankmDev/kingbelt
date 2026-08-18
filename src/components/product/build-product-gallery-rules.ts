import type { ProductImage } from '@commerce/domain/catalog';
import {
  escapeCssAttributeValue,
  escapeCssIdentifier,
  escapeStyleElementContent,
} from '@shared/css/css-identifier';

export interface ColorGalleryRulesInput {
  optionValueId: string;
  images: readonly ProductImage[];
}

export interface ProductGalleryRulesInput {
  idPrefix: string;
  colorGalleries: readonly ColorGalleryRulesInput[];
}

/** Reglas CSS por producto, generadas en build (sin runtime en cliente). */
export const buildProductGalleryRules = ({
  idPrefix,
  colorGalleries,
}: ProductGalleryRulesInput): string => {
  const safePrefix = escapeCssIdentifier(idPrefix);
  const galleryClass = `product-gallery--${safePrefix}`;
  const rules: string[] = [];

  rules.push(`.${galleryClass} .product-gallery__slide{opacity:0;visibility:hidden}`);

  colorGalleries.forEach((gallery, setIndex) => {
    const setId = escapeCssAttributeValue(gallery.optionValueId);
    const setName = `gallery-${safePrefix}-set-${setIndex + 1}`;
    const setSelector = `[data-gallery-set="${setId}"]`;

    gallery.images.forEach((_, index) => {
      const inputId = `${setName}-${index + 1}`;
      const escapedInputId = escapeCssIdentifier(inputId);
      const escapedFor = escapeCssAttributeValue(inputId);
      rules.push(
        `.${galleryClass}:has(#${escapedInputId}:checked) ${setSelector} .product-gallery__stage .product-gallery__slide:nth-child(${index + 1}){opacity:1;visibility:visible}`,
        `.${galleryClass}:has(#${escapedInputId}:checked) ${setSelector} .product-gallery__thumb[for="${escapedFor}"]{border-color:var(--color-king-accent);box-shadow:0 0 0 1px var(--color-king-accent)}`,
        `.${galleryClass}:has(#${escapedInputId}:checked) ${setSelector} .product-gallery__thumb[for="${escapedFor}"] img{opacity:1}`,
        `.${galleryClass}:has(#${escapedInputId}:focus-visible) ${setSelector} .product-gallery__thumb[for="${escapedFor}"]{outline:2px solid var(--color-king-accent);outline-offset:3px}`
      );
    });

    rules.push(
      `.${galleryClass} ${setSelector}:not(:has(.product-gallery__input:checked)) .product-gallery__stage .product-gallery__slide:first-child{opacity:1;visibility:visible}`
    );
  });

  return escapeStyleElementContent(rules.join(''));
};
