import type { APIRoute } from 'astro';
import { getCatalogProvider } from '@commerce/catalog';
import { isShopifyCommerce } from '@commerce/commerce-source';
import { buildCommerceSitemapUrls } from '@config/sitemap';
import { siteUrl } from '@config/site';

const escapeXml = (value: string): string => value.replace(/[<>&'"]/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[character] ?? character));

const renderUrlset = (urls: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join('')}</urlset>`;

const xmlHeaders = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  'X-Robots-Tag': 'noindex',
} as const;

export const prerender = false;

export const GET: APIRoute = async ({ clientAddress }) => {
  if (!isShopifyCommerce()) {
    return new Response(renderUrlset([]), { headers: xmlHeaders });
  }

  const catalogProvider = await getCatalogProvider(clientAddress);
  const [productHandles, collectionHandles] = await Promise.all([
    catalogProvider.getProductHandles(),
    catalogProvider.getCollectionHandles(),
  ]);
  const urls = buildCommerceSitemapUrls(siteUrl, productHandles, collectionHandles, true);
  return new Response(renderUrlset(urls), { headers: xmlHeaders });
};
