import { siteUrl } from '@config/site';
import { toCanonicalUrl } from '@shared/url';
import type { OgType, PageSeo, SeoImage } from './page-seo';

export const createPageSeo = (input: {
  title: string;
  description: string;
  pathname: string;
  robots?: string;
  ogType?: OgType;
  image?: SeoImage;
}): PageSeo => ({
  title: input.title,
  description: input.description,
  canonicalUrl: toCanonicalUrl(siteUrl, input.pathname),
  ...(input.robots ? { robots: input.robots } : {}),
  ...(input.ogType ? { ogType: input.ogType } : {}),
  ...(input.image ? { image: input.image } : {}),
});

export const toSeoImage = (url: string, altText: string, width?: number, height?: number): SeoImage => ({
  url,
  altText,
  ...(width ? { width } : {}),
  ...(height ? { height } : {}),
});
