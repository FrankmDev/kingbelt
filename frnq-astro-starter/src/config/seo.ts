import { siteConfig } from './site';

export const seoConfig = {
  titleTemplate: `%s — ${siteConfig.name}`,
  defaultTitle: siteConfig.name,
  defaultDescription: siteConfig.description,
  defaultImage: '',
  robots: {
    index: true,
    follow: true,
  },
} as const;
