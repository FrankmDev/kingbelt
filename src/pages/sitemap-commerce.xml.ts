import type { APIRoute } from 'astro';
import { getCatalogProvider } from '@commerce/catalog';
import { isShopifyCommerce } from '@commerce/commerce-source';
import { buildCommerceSitemapEntries, type CommerceSitemapEntry } from '@config/sitemap';
import { siteUrl } from '@config/site';

const escapeXml = (value: string): string => value.replace(/[<>&'"]/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[character] ?? character));

const renderEntry = (entry: CommerceSitemapEntry): string => {
  const image = entry.image
    ? '<image:image>'
      + `<image:loc>${escapeXml(entry.image.url)}</image:loc>`
      + `<image:title>${escapeXml(entry.image.title)}</image:title>`
      + (entry.image.caption ? `<image:caption>${escapeXml(entry.image.caption)}</image:caption>` : '')
      + '</image:image>'
    : '';
  return `<url><loc>${escapeXml(entry.url)}</loc>${image}</url>`;
};

const renderUrlset = (entries: readonly CommerceSitemapEntry[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n`
  + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`
  + entries.map(renderEntry).join('')
  + `</urlset>`;

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
  const [products, collections] = await Promise.all([
    catalogProvider.getProductSummaries(),
    catalogProvider.getCollections(),
  ]);
  const entries = buildCommerceSitemapEntries(siteUrl, products, collections, true);
  return new Response(renderUrlset(entries), { headers: xmlHeaders });
};
