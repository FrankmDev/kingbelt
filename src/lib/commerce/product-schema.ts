import { countAvailableVariants } from './product-variants';
import type { CommerceProduct, Money } from './types';

const schemaPrice = (money: Money): string => (money.amountMinor / 100).toFixed(2);

export const createProductStructuredData = (
  product: CommerceProduct,
  canonical: string,
  brandName: string
): Record<string, unknown> => {
  const availableVariants = countAvailableVariants(product);
  const availability = product.availableForSale
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
  const imageUrls = product.gallery.map((image) => new URL(image.url, canonical).href);
  const hasRange = product.priceRange.min.amountMinor !== product.priceRange.max.amountMinor;
  const offers = hasRange
    ? {
        '@type': 'AggregateOffer',
        lowPrice: schemaPrice(product.priceRange.min),
        highPrice: schemaPrice(product.priceRange.max),
        priceCurrency: product.priceRange.min.currency,
        offerCount: availableVariants,
        availability,
        url: canonical,
      }
    : {
        '@type': 'Offer',
        price: schemaPrice(product.priceRange.min),
        priceCurrency: product.priceRange.min.currency,
        availability,
        url: canonical,
      };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: imageUrls,
    sku: product.reference,
    brand: { '@type': 'Brand', name: brandName },
    url: canonical,
    offers,
  };
};
