import { getHelpSitemapExcludedPaths } from '../content/help';
import { getLegalSitemapExcludedPaths } from '../content/legal';
import { normalizePathname } from '../shared/url';

const STATIC_SITEMAP_EXCLUDED = new Set([
  '/404',
  '/carrito',
  '/cart-catalog.json',
]);

export const isSitemapExcluded = (pathname: string): boolean => {
  const normalized = normalizePathname(pathname);
  if (STATIC_SITEMAP_EXCLUDED.has(normalized)) return true;
  if (getHelpSitemapExcludedPaths().includes(normalized)) return true;
  return getLegalSitemapExcludedPaths().includes(normalized);
};
