export type OgType = 'website' | 'article' | 'product';

export interface SeoImage {
  url: string;
  altText: string;
  width?: number;
  height?: number;
}

export interface PageSeo {
  title: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
  ogType?: OgType;
  image?: SeoImage;
}
