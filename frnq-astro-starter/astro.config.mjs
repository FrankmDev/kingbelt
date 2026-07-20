import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { projectConfig } from './project.config';

const site = projectConfig.identity.domain || 'https://example.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
