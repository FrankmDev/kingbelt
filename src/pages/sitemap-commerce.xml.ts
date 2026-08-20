import type { APIRoute } from 'astro';
import { getCatalogProvider } from '@commerce/catalog';
import { siteUrl } from '@config/site';

const escapeXml = (value: string): string => value.replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[character] ?? character));

export const prerender = false;

export const GET: APIRoute = async ({ clientAddress }) => {
  const catalogProvider = await getCatalogProvider(clientAddress);
  const [productHandles, collectionHandles] = await Promise.all([
    catalogProvider.getProductHandles(),
    catalogProvider.getCollectionHandles(),
  ]);
  const urls = [
    new URL('/productos', siteUrl).href,
    ...collectionHandles.map((handle) => new URL(`/categorias/${handle}`, siteUrl).href),
    ...productHandles.map((handle) => new URL(`/productos/${handle}`, siteUrl).href),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
};
