import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  srcDir: fileURLToPath(new URL('./src/', import.meta.url)),
  outDir: fileURLToPath(new URL('./dist/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./.cache/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../public/', import.meta.url)),
  compressHTML: true,
  fetchFile: null,
  env: {
    schema: {
      COMMERCE_SOURCE: envField.enum({
        context: 'client',
        access: 'public',
        values: ['demo', 'shopify'],
      }),
    },
  },
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    plugins: [tailwindcss()],
  },
});
