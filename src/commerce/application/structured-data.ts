import { calculatePriceRange } from '../domain/variants';
import { isVariantPurchasable } from '../domain/inventory';
import type { Collection, Product, ProductImage, ProductSummary, ProductVariant } from '../domain/catalog';
import { isRuntimeTechnicalSku } from '../domain/identifiers';
import { moneyToDecimal } from '../domain/money';
import { productPath, resolveCanonicalUrl } from './paths';

const SCHEMA_CONTEXT = 'https://schema.org';

/** Límite de entradas en ItemList para evitar HTML desproporcionado en catálogos grandes. */
export const COLLECTION_SCHEMA_MAX_ITEMS = 48;

const toAbsoluteHttpUrl = (url: string, base: string): string | undefined => {
  try {
    const resolved = new URL(url, base);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    return resolved.href;
  } catch {
    return undefined;
  }
};

const toAvailability = (variants: readonly ProductVariant[]): string => {
  if (variants.some(isVariantPurchasable)) return `${SCHEMA_CONTEXT}/InStock`;
  if (variants.some((variant) => variant.salesStatus === 'active')) {
    return `${SCHEMA_CONTEXT}/OutOfStock`;
  }
  return `${SCHEMA_CONTEXT}/Discontinued`;
};

const toSchemaImages = (
  images: readonly ProductImage[],
  canonical: string
): Array<string | Record<string, unknown>> => {
  const output: Array<string | Record<string, unknown>> = [];
  images.forEach((image) => {
    const url = toAbsoluteHttpUrl(image.url, canonical);
    if (!url) return;
    if (image.width && image.height) {
      output.push({
        '@type': 'ImageObject',
        url,
        width: image.width,
        height: image.height,
        ...(image.altText ? { caption: image.altText } : {}),
      });
      return;
    }
    output.push(url);
  });
  return output;
};

const getPricingVariants = (product: Product): ProductVariant[] =>
  product.variants.filter((variant) => variant.salesStatus === 'active');

export const createProductStructuredData = (
  product: Product,
  canonical: string,
  brandName: string
): Record<string, unknown> => {
  const pricingVariants = getPricingVariants(product);
  const availability = toAvailability(product.variants);

  const data: Record<string, unknown> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: toSchemaImages(product.images, canonical),
    mpn: product.reference,
    brand: { '@type': 'Brand', name: brandName },
    url: canonical,
  };

  if (!pricingVariants.length) return data;

  const priceRange = calculatePriceRange(pricingVariants);
  const hasRange = priceRange.min.amountMinor !== priceRange.max.amountMinor;
  const sharedOffer = {
    availability,
    url: canonical,
    itemCondition: `${SCHEMA_CONTEXT}/NewCondition`,
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'ES',
      returnPolicyCategory: `${SCHEMA_CONTEXT}/MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: 30,
      url: new URL('/devoluciones', canonical).href,
    },
  };

  if (hasRange) {
    data.offers = {
      '@type': 'AggregateOffer',
      lowPrice: moneyToDecimal(priceRange.min),
      highPrice: moneyToDecimal(priceRange.max),
      priceCurrency: priceRange.min.currency,
      offerCount: pricingVariants.length,
      ...sharedOffer,
    };
    return data;
  }

  const singleVariant = pricingVariants.length === 1 ? pricingVariants[0] : undefined;
  data.offers = {
    '@type': 'Offer',
    price: moneyToDecimal(priceRange.min),
    priceCurrency: priceRange.min.currency,
    ...(singleVariant && !isRuntimeTechnicalSku(singleVariant.sku)
      ? { sku: singleVariant.sku }
      : {}),
    ...sharedOffer,
  };

  return data;
};

export const createCollectionStructuredData = (
  collection: Pick<Collection, 'title' | 'description' | 'handle'>,
  products: readonly ProductSummary[],
  canonical: string,
  siteOrigin: string | URL
): Record<string, unknown> => {
  const listedProducts = products.slice(0, COLLECTION_SCHEMA_MAX_ITEMS);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.description,
    url: canonical,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: listedProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.title,
        url: resolveCanonicalUrl(siteOrigin, productPath(product.handle)),
      })),
    },
  };
};
