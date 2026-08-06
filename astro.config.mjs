// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { siteUrl } from './src/config/site.ts';
import { isSitemapExcluded } from './src/config/sitemap.ts';
import { buildProductRedirectMap } from './src/commerce/application/product-redirects.ts';

const productRedirects = buildProductRedirectMap();

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  fetchFile: null,
  site: siteUrl,
  // Sin astronauta/Dev Toolbar en desarrollo: menos ruido y superficie JS.
  devToolbar: {
    enabled: false,
  },
  // CSS externo: reutilizable entre rutas y compatible con una CSP basada en assets propios.
  build: {
    inlineStylesheets: 'never',
  },
  ...(Object.keys(productRedirects).length ? { redirects: productRedirects } : {}),
  integrations: [
    sitemap({
      filter: (page) => !isSitemapExcluded(new URL(page).pathname),
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    plugins: [tailwindcss()],
  },
});
