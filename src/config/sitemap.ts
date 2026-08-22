import { getHelpSitemapExcludedPaths } from '../content/help';
import { getLegalSitemapExcludedPaths } from '../content/legal';
import { normalizePathname, toCanonicalUrl } from '../shared/url';

const STATIC_SITEMAP_EXCLUDED = new Set([
  '/404',
  '/carrito',
  '/cart-catalog.json',
  '/cuenta/iniciar',
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

export const buildCommerceSitemapUrls = (
  origin: string | URL,
  productHandles: readonly string[],
  collectionHandles: readonly string[],
  indexable: boolean
): string[] => {
  if (!indexable) return [];
  return [
    toCanonicalUrl(origin, '/productos'),
    ...collectionHandles.map((handle) => toCanonicalUrl(origin, `/categorias/${handle}`)),
    ...productHandles.map((handle) => toCanonicalUrl(origin, `/productos/${handle}`)),
  ];
};
