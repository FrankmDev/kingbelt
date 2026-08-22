import { getLegalRobots, type LegalDocument } from '@content/legal';
import { createPageSeo, toSeoImage } from './page-head';
import { createBreadcrumbListSchema, createWebPageSchema } from './structured-data';
import type { PageSeo } from './page-seo';

interface LegalPageVisual {
  heading: string;
  image: string;
  imageAlt: string;
}

export const createLegalPageHead = (
  document: Pick<LegalDocument, 'title' | 'description' | 'href' | 'status'>,
  page: LegalPageVisual
): { seo: PageSeo; schema: Record<string, unknown>[] } => {
  const seo = createPageSeo({
    title: document.title,
    description: document.description,
    pathname: document.href,
    robots: getLegalRobots(document),
    image: toSeoImage(page.image, page.imageAlt),
  });
  return {
    seo,
    schema: [
      createWebPageSchema({
        name: document.title,
        description: document.description,
        url: seo.canonicalUrl,
      }),
      createBreadcrumbListSchema([{ name: page.heading, path: document.href }]),
    ],
  };
};
