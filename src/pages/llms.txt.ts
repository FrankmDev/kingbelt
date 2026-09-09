import type { APIRoute } from 'astro';
import { site, siteUrl } from '@config/site';
import { blogPosts, getBlogPostPath } from '@content/blog';
import { getLegalSitemapExcludedPaths } from '@content/legal';
import { normalizePathname, toCanonicalUrl } from '@shared/url';

export const prerender = true;

/** Páginas legales publicadas (los borradores quedan fuera). */
const legalPaths = (): string[] => {
  const excluded = new Set(getLegalSitemapExcludedPaths().map(normalizePathname));
  return [
    '/aviso-legal',
    '/privacidad',
    '/cookies',
    '/condiciones',
    '/envios-y-devoluciones',
    '/devoluciones',
  ].filter((path) => !excluded.has(path));
};

export const buildLlmsTxt = (origin: string | URL): string => {
  const url = (path: string): string => toCanonicalUrl(origin, path);
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.name} es una marca ecommerce masculina centrada en cinturones de cuero. `
      + 'Sitio en español, dirigido a España, con catálogo, revista editorial y centro de ayuda.',
    '',
    '## Páginas principales',
    '',
    `- [Inicio](${url('/')}): selección de cinturones, categorías y revista`,
    `- [Productos](${url('/productos')}): catálogo completo de cinturones de cuero`,
    '- [Sobre KingBelt](' + url('/sobre') + '): criterio de marca y producto',
    `- [Centro de ayuda](${url('/ayuda')}): guías de tallas, cuidados y atención`,
    `- [Contacto](${url('/contacto')}): atención al cliente`,
    '',
    '## Categorías',
    '',
    '- [Cinturones sport](' + url('/categorias/sport') + ')',
    '- [Cinturones casual](' + url('/categorias/casual') + ')',
    '- [Cinturones de vestir](' + url('/categorias/vestir') + ')',
    '',
    '## Guías y cuidados',
    '',
    `- [Guía de tallas](${url('/guia-de-tallas')}): cómo medir y elegir talla`,
    `- [Cuidados del cuero](${url('/cuidados')})`,
    '',
    '## Revista KingBelt',
    '',
    `- [Índice de la revista](${url('/blog')})`,
    ...blogPosts.map((post) => {
      const path = getBlogPostPath(post);
      return `- [${post.title}](${url(path)})`;
    }),
    '',
    '## Información legal',
    '',
    ...legalPaths().map((path) => `- [${path.slice(1).replace(/-/g, ' ')}](${url(path)})`),
    '',
    '## Archivos técnicos',
    '',
    `- [Sitemap](${url('/sitemap-index.xml')})`,
    `- [Sitemap de catálogo](${url('/sitemap-commerce.xml')})`,
    `- [RSS de la revista](${url('/rss.xml')})`,
    '',
  ];
  return lines.join('\n');
};

export const GET: APIRoute = () => {
  return new Response(buildLlmsTxt(siteUrl), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
};
