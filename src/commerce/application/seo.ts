import type { Collection, CollectionPage, Product, ProductImage } from '../domain/catalog';
import { getPrimaryProductImage } from '../domain/product-media';
import type { PageSeo, SeoImage } from '@shared/seo/page-seo';
import { collectionPath, productPath, resolveCanonicalUrl } from './paths';
import { createCollectionStructuredData, createProductStructuredData } from './structured-data';

export type { OgType, PageSeo, SeoImage } from '@shared/seo/page-seo';

/** Parámetros reservados para filtros, variantes o paginación futura (SSR o middleware). */
export const NON_INDEXABLE_QUERY_PARAMS = new Set([
  'tipo',
  'color',
  'precio',
  'disponible',
  'variant',
  'variante',
  'sku',
  'sort',
  'orden',
  'q',
  'buscar',
]);

export const getRobotsForQuery = (searchParams?: URLSearchParams): string | undefined => {
  if (!searchParams?.size) return undefined;
  for (const key of searchParams.keys()) {
    if (NON_INDEXABLE_QUERY_PARAMS.has(key.toLowerCase())) return 'noindex,follow';
  }
  const page = searchParams.get('page');
  return page && page !== '1' ? 'noindex,follow' : undefined;
};

interface SiteBrand {
  name: string;
}

const toSeoImage = (
  image: Pick<ProductImage, 'url' | 'altText' | 'width' | 'height'> | undefined
): SeoImage | undefined => {
  if (!image?.url) return undefined;
  return {
    url: image.url,
    altText: image.altText,
    width: image.width,
    height: image.height,
  };
};

const buildProductPageSeo = (
  product: Pick<Product, 'title' | 'summary' | 'handle' | 'seo'>,
  brand: SiteBrand,
  siteOrigin: string | URL,
  image?: SeoImage
): PageSeo => ({
  title: product.seo?.title ?? `${product.title} — ${brand.name}`,
  description: product.seo?.description ?? product.summary,
  canonicalUrl: resolveCanonicalUrl(siteOrigin, productPath(product.handle)),
  ogType: 'product',
  image,
});

const buildCollectionPageSeo = (
  collection: Pick<Collection, 'title' | 'description' | 'handle'>,
  brand: SiteBrand,
  siteOrigin: string | URL,
  image?: SeoImage
): PageSeo => ({
  title: `${collection.title} — Colección ${brand.name}`,
  description: collection.description,
  canonicalUrl: resolveCanonicalUrl(siteOrigin, collectionPath(collection.handle)),
  ogType: 'website',
  image,
});

export interface CommercePageHead {
  seo: PageSeo;
  schema: Record<string, unknown>;
}

/** Metadatos y JSON-LD de ficha de producto, resueltos en build time. */
export const resolveProductPageHead = (
  product: Product,
  brand: SiteBrand,
  siteOrigin: string | URL
): CommercePageHead => {
  const seo = buildProductPageSeo(product, brand, siteOrigin, toSeoImage(getPrimaryProductImage(product)));
  return {
    seo,
    schema: createProductStructuredData(product, seo.canonicalUrl, brand.name),
  };
};

/** Metadatos y JSON-LD de colección, resueltos en build time. */
export const resolveCollectionPageHead = (
  collectionPage: CollectionPage,
  brand: SiteBrand,
  siteOrigin: string | URL
): CommercePageHead => {
  const { collection, products } = collectionPage;
  const seo = buildCollectionPageSeo(collection, brand, siteOrigin, toSeoImage(collection.image));
  return {
    seo,
    schema: createCollectionStructuredData(collection, products, seo.canonicalUrl, siteOrigin),
  };
};
