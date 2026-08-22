import type { APIRoute } from 'astro';
import { siteUrl } from '@config/site';
import { isSearchIndexableDeployment } from '@shared/seo/deployment';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL(siteUrl);

  if (!isSearchIndexableDeployment()) {
    const body = ['User-agent: *', 'Disallow: /', ''].join('\n');
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const sitemapUrl = new URL('sitemap-index.xml', origin);
  const commerceSitemapUrl = new URL('sitemap-commerce.xml', origin);

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /carrito',
    'Disallow: /cuenta/',
    'Disallow: /desistimiento',
    'Disallow: /cart-catalog.json',
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
