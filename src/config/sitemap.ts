import { getHelpSitemapExcludedPaths } from '../content/help';
import { getLegalSitemapExcludedPaths } from '../content/legal';
import { normalizePathname, toCanonicalUrl } from '../shared/url';

const STATIC_SITEMAP_EXCLUDED = new Set([
  '/404',
  '/carrito',
  '/cart-catalog.json',
  '/cuenta/iniciar',
  '/llms.txt',
  '/rss.xml',
]);

export const isSitemapExcluded = (pathname: string): boolean => {
  const normalized = normalizePathname(pathname);
  if (STATIC_SITEMAP_EXCLUDED.has(normalized)) return true;
  if (getHelpSitemapExcludedPaths().includes(normalized)) return true;
  return getLegalSitemapExcludedPaths().includes(normalized);
};

/**
 * Rutas SSR que Google debe descubrir y que `@astrojs/sitemap` no ve
 * porque no se prerenderizan. Hoy: la portada, que depende del catálogo.
 */
export const SSR_INDEXABLE_SITEMAP_PATHS = ['/'] as const;

export const getSsrSitemapUrls = (origin: string | URL): string[] =>
  SSR_INDEXABLE_SITEMAP_PATHS
    .filter((pathname) => !isSitemapExcluded(pathname))
    .map((pathname) => toCanonicalUrl(origin, pathname));

/** Google recomienda no pasar de ~1000 imágenes por archivo de sitemap. */
export const MAX_COMMERCE_SITEMAP_IMAGES = 1000;

export interface CommerceSitemapImageEntry {
  url: string;
  title: string;
  caption?: string;
}

export interface CommerceSitemapEntry {
  url: string;
  image?: CommerceSitemapImageEntry;
}

interface SitemapImageSource {
  url: string;
  altText: string;
}

interface SitemapProductEntryInput {
  handle: string;
  title: string;
  primaryImage?: SitemapImageSource;
}

interface SitemapCollectionEntryInput {
  handle: string;
  title: string;
  image?: SitemapImageSource;
}

const toSitemapImage = (
  origin: string | URL,
  source: SitemapImageSource,
  title: string
): CommerceSitemapImageEntry | undefined => {
  try {
    return {
      url: new URL(source.url, origin).href,
      title,
      ...(source.altText.trim() ? { caption: source.altText.trim() } : {}),
    };
  } catch {
    return undefined;
  }
};

/**
 * Entradas del sitemap de comercio con su imagen principal, para que Google
 * Images indexe productos y categorías directamente desde el feed.
 */
export const buildCommerceSitemapEntries = (
  origin: string | URL,
  products: readonly SitemapProductEntryInput[],
  collections: readonly SitemapCollectionEntryInput[],
  indexable: boolean
): CommerceSitemapEntry[] => {
  if (!indexable) return [];
  let imageBudget = MAX_COMMERCE_SITEMAP_IMAGES;
  const takeImage = (
    source: SitemapImageSource | undefined,
    title: string
  ): CommerceSitemapImageEntry | undefined => {
    if (!source || imageBudget <= 0) return undefined;
    const image = toSitemapImage(origin, source, title);
    if (!image) return undefined;
    imageBudget -= 1;
    return image;
  };
  return [
    { url: toCanonicalUrl(origin, '/productos') },
    ...collections.map((collection) => ({
      url: toCanonicalUrl(origin, `/categorias/${collection.handle}`),
      ...(collection.image
        ? { image: takeImage(collection.image, `Cinturones ${collection.title} KingBelt`) }
        : {}),
    })),
    ...products.map((product) => ({
      url: toCanonicalUrl(origin, `/productos/${product.handle}`),
      ...(product.primaryImage
        ? { image: takeImage(product.primaryImage, product.title) }
        : {}),
    })),
  ];
};
