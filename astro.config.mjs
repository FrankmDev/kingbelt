// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { isSitemapExcluded } from './src/data/legal.ts';

// https://astro.build/config
export default defineConfig({
  // Preserve Astro 6's HTML-aware whitespace while the approved UI is unchanged.
  compressHTML: true,
  // KingBelt uses file-based static routes and does not opt into advanced routing.
  fetchFile: null,
  site: 'https://kingbelt.com',
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return !isSitemapExcluded(pathname);
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
