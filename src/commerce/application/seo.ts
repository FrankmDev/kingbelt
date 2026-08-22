import type { Collection, CollectionPage, Product, ProductImage, ProductSummary } from '../domain/catalog';
import { getPrimaryProductImage } from '../domain/product-media';
import type { PageSeo, SeoImage } from '@shared/seo/page-seo';
import { CATALOG_INDEX_PATH, collectionPath, productPath, resolveCanonicalUrl } from './paths';
import { createCollectionStructuredData, createProductStructuredData } from './structured-data';

export type { OgType, PageSeo, SeoImage } from '@shared/seo/page-seo';

/** Parámetros reservados para filtros, variantes o paginación futura (SSR o middleware). */
export const NON_INDEXABLE_QUERY_PARAMS = new Set([
  'tipo',
  'color',
  'precio',
  'disponible',
  'categoria',
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

export interface CommerceSeoOptions {
  searchParams?: URLSearchParams;
  /** `false` en catálogo demo para no indexar productos ficticios. */
  indexable?: boolean;
}

export const resolveCommerceRobots = (options?: CommerceSeoOptions): string | undefined => {
  if (options?.indexable === false) return 'noindex,follow';
  return getRobotsForQuery(options?.searchParams);
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
  title: `${collection.title} — Cinturones ${brand.name}`,
  description: collection.description,
  canonicalUrl: resolveCanonicalUrl(siteOrigin, collectionPath(collection.handle)),
  ogType: 'website',
  image,
});

const applyCommerceRobots = (seo: PageSeo, options?: CommerceSeoOptions): PageSeo => {
  const robots = resolveCommerceRobots(options);
  return robots ? { ...seo, robots } : seo;
};

export interface CommercePageHead {
  seo: PageSeo;
  schema: Record<string, unknown>;
}

/** Metadatos y JSON-LD de ficha de producto. */
export const resolveProductPageHead = (
  product: Product,
  brand: SiteBrand,
  siteOrigin: string | URL,
  options?: CommerceSeoOptions
): CommercePageHead => {
  const seo = applyCommerceRobots(
    buildProductPageSeo(product, brand, siteOrigin, toSeoImage(getPrimaryProductImage(product))),
    options
  );
  return {
    seo,
    schema: createProductStructuredData(product, seo.canonicalUrl, brand.name),
  };
};

/** Metadatos y JSON-LD de colección. */
export const resolveCollectionPageHead = (
  collectionPage: CollectionPage,
  brand: SiteBrand,
  siteOrigin: string | URL,
  options?: CommerceSeoOptions
): CommercePageHead => {
  const { collection, products } = collectionPage;
  const seo = applyCommerceRobots(
    buildCollectionPageSeo(collection, brand, siteOrigin, toSeoImage(collection.image)),
    options
  );
  return {
    seo,
    schema: createCollectionStructuredData(collection, products, seo.canonicalUrl, siteOrigin),
  };
};

interface CatalogIndexHeadInput {
  title: string;
  description: string;
  products: readonly ProductSummary[];
  collections: readonly Collection[];
}

/** Metadatos y JSON-LD del índice de catálogo. */
export const resolveCatalogIndexHead = (
  input: CatalogIndexHeadInput,
  brand: SiteBrand,
  siteOrigin: string | URL,
  options?: CommerceSeoOptions
): CommercePageHead => {
  const featured = input.collections.find((collection) => collection.featured) ?? input.collections[0];
  const seo = applyCommerceRobots(
    {
      title: input.title,
      description: input.description,
      canonicalUrl: resolveCanonicalUrl(siteOrigin, CATALOG_INDEX_PATH),
      ogType: 'website',
      image: toSeoImage(featured?.image),
    },
    options
  );
  return {
    seo,
    schema: createCollectionStructuredData(
      { title: `Cinturones ${brand.name}`, description: input.description, handle: 'productos' },
      input.products,
      seo.canonicalUrl,
      siteOrigin
    ),
  };
};
