import type { Collection, CollectionPage, Product, ProductImage, ProductSummary } from '../domain/catalog';
import { getPrimaryProductImage } from '../domain/product-media';
import type { PageSeo, SeoImage } from '@shared/seo/page-seo';
import { CATALOG_INDEX_PATH, collectionPath, productPath, resolveCanonicalUrl } from './paths';
import { createCollectionStructuredData, createProductStructuredData, type ProductSchemaCategory } from './structured-data';

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
  /** Colección principal declarada en el schema Product. */
  category?: ProductSchemaCategory;
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
  description: product.seo?.description ?? truncateForMetaDescription(product.summary),
  canonicalUrl: resolveCanonicalUrl(siteOrigin, productPath(product.handle)),
  ogType: 'product',
  image,
});

/** Longitud objetivo de meta description: Google trunca hacia los ~155-160 caracteres. */
const META_DESCRIPTION_MAX = 155;

const truncateForMetaDescription = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= META_DESCRIPTION_MAX) return normalized;
  const cut = normalized.lastIndexOf(' ', META_DESCRIPTION_MAX);
  return `${(cut > META_DESCRIPTION_MAX * 0.6 ? normalized.slice(0, cut) : normalized.slice(0, META_DESCRIPTION_MAX)).trimEnd()}…`;
};

/**
 * Descripción de colección para la head cuando Shopify no aporta contenido
 * (collection.description o collection.seo vacíos). Plantilla neutra, sin
 * datos comerciales: el texto editado en Shopify siempre tiene prioridad.
 */
export const buildCollectionMetaDescription = (
  collection: Pick<Collection, 'title' | 'description' | 'seo'>,
  brandName: string
): string => {
  const fromSeo = collection.seo?.description?.trim();
  if (fromSeo) return fromSeo;
  const fromDescription = collection.description?.trim();
  if (fromDescription && fromDescription !== collection.title.trim()) {
    return fromDescription;
  }
  const theme = collection.title.trim().toLowerCase();
  return `Descubre los cinturones de cuero ${theme} de ${brandName}: cuero, herrajes y ajuste pensados para el uso diario. Explora la colección.`;
};

const buildCollectionPageSeo = (
  collection: Pick<Collection, 'title' | 'description' | 'handle' | 'seo'>,
  brand: SiteBrand,
  siteOrigin: string | URL,
  image?: SeoImage
): PageSeo => ({
  title: collection.seo?.title ?? `${collection.title} — Cinturones de cuero ${brand.name}`,
  description: buildCollectionMetaDescription(collection, brand.name),
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
    schema: createProductStructuredData(product, seo.canonicalUrl, brand.name, options?.category),
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
    schema: createCollectionStructuredData(
      { title: collection.title, description: seo.description, handle: collection.handle },
      products,
      seo.canonicalUrl,
      siteOrigin
    ),
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
