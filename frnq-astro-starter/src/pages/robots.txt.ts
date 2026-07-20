import type { APIRoute } from 'astro';
import { projectConfig } from '../../project.config';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://example.com');
  const sitemap = new URL('/sitemap-index.xml', origin);
  const policy = projectConfig.meta.initialized ? 'Allow: /' : 'Disallow: /';
  const body = `User-agent: *\n${policy}\n\nSitemap: ${sitemap.href}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
