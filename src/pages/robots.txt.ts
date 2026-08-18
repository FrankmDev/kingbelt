import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site ?? 'https://kingbelt.com');
  const commerceSitemapUrl = new URL('sitemap-commerce.xml', site ?? 'https://kingbelt.com');

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart-catalog.json',
    'Disallow: /api/',
    '',
    `Sitemap: ${sitemapUrl.href}`,
    `Sitemap: ${commerceSitemapUrl.href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
