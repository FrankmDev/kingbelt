// @ts-check
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { siteUrl } from './src/config/site.ts';
import { getSsrSitemapUrls, isSitemapExcluded } from './src/config/sitemap.ts';
import { blogPosts, getBlogPostPath } from './src/content/blog.ts';
import { buildProductRedirectMap } from './src/commerce/application/product-redirects.ts';
import { MAX_HOSTED_URL_LENGTH } from './src/commerce/application/hosted-url.ts';
import {
  MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH,
  SHOPIFY_STOREFRONT_API_VERSION,
} from './src/commerce/infrastructure/shopify/config.ts';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionDriverConfig,
} from './src/session-driver.ts';

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
  trailingSlash: 'never',
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
      SHOPIFY_CUSTOMER_ACCOUNT_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        max: MAX_HOSTED_URL_LENGTH,
      }),
      SHOPIFY_STOREFRONT_PRIVATE_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        max: MAX_SHOPIFY_STOREFRONT_TOKEN_LENGTH,
      }),
      SHOPIFY_WEBHOOK_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        max: 256,
      }),
      VERCEL_DEPLOY_HOOK_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        max: 512,
      }),
    },
  },
  session: {
    driver: sessionDriverConfig,
    cookie: {
      name: SESSION_COOKIE_NAME,
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: SESSION_TTL_SECONDS,
    },
    ttl: SESSION_TTL_SECONDS,
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
      customPages: getSsrSitemapUrls(siteUrl),
      serialize(item) {
        const post = blogPosts.find(
          (entry) => item.url === new URL(getBlogPostPath(entry), siteUrl).href
        );
        if (post) {
          item.lastmod = post.date;
        }
        return item;
      },
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    plugins: [tailwindcss()],
  },
});
