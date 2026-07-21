// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Preserve Astro 6's HTML-aware whitespace while the approved UI is unchanged.
  compressHTML: true,
  // KingBelt uses file-based static routes and does not opt into advanced routing.
  fetchFile: null,
  vite: {
    plugins: [tailwindcss()],
  },
  site: 'https://kingbelt.com',
});
