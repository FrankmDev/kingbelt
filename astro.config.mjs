// @ts-check
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { siteUrl } from './src/config/site.ts';
import { isSitemapExcluded } from './src/config/sitemap.ts';
import { buildProductRedirectMap } from './src/commerce/application/product-redirects.ts';
import {
  MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH,
  SHOPIFY_STOREFRONT_API_VERSION,
} from './src/commerce/infrastructure/shopify/config.ts';

const productRedirects = buildProductRedirectMap();

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  compressHTML: true,
  fetchFile: null,
  site: siteUrl,
  env: {
    schema: {
      COMMERCE_SOURCE: envField.enum({
        context: 'client',
        access: 'public',
        values: ['demo', 'shopify'],
      }),
      SHOPIFY_STORE_DOMAIN: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        max: 255,
      }),
      SHOPIFY_API_VERSION: envField.enum({
        context: 'server',
        access: 'public',
        values: [SHOPIFY_STOREFRONT_API_VERSION],
        default: SHOPIFY_STOREFRONT_API_VERSION,
      }),
      SHOPIFY_STOREFRONT_PRIVATE_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        max: MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH,
      }),
      SHOPIFY_CART_COOKIE_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        max: 256,
      }),
    },
  },
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
