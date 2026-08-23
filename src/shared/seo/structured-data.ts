import { businessFacts, confirmed, toTelHref } from '@config/business';
import { site, siteUrl } from '@config/site';
import { toCanonicalUrl } from '@shared/url';

export const SITE_ORGANIZATION_ID = `${siteUrl}/#organization`;
export const SITE_WEBSITE_ID = `${siteUrl}/#website`;

const SCHEMA_CONTEXT = 'https://schema.org';

const stripContext = (node: Record<string, unknown>): Record<string, unknown> => {
  const { '@context': _context, ...rest } = node;
  return rest;
};

const parseRegisteredAddress = (value: string): Record<string, unknown> | undefined => {
  const compact = value.replace(/\s+/g, ' ').trim();
  const match = compact.match(/^(.*?),\s*(\d{5})\s+([^(]+)\s*\(([^)]+)\),\s*([^,]+)$/);
  if (!match) {
    return {
      '@type': 'PostalAddress',
      streetAddress: compact,
      addressCountry: 'ES',
    };
  }
  return {
    '@type': 'PostalAddress',
    streetAddress: match[1].trim(),
    postalCode: match[2],
    addressLocality: match[3].trim(),
    addressRegion: match[4].trim(),
    addressCountry: match[5].trim() === 'España' ? 'ES' : match[5].trim(),
  };
};

export const createOrganizationSchema = (): Record<string, unknown> => {
  const email = confirmed(businessFacts.email) ?? site.contact.email;
  const phone = confirmed(businessFacts.contactPhone);
  const legalName = confirmed(businessFacts.legalName);
  const addressValue = confirmed(businessFacts.registeredAddress);
  const logoUrl = toCanonicalUrl(siteUrl, site.logos.ink);

  return {
    '@type': 'Organization',
    '@id': SITE_ORGANIZATION_ID,
    name: site.name,
    url: siteUrl,
    ...(legalName ? { legalName } : {}),
    email,
    ...(phone ? { telephone: toTelHref(phone).replace(/^tel:/, '') } : {}),
    ...(addressValue ? { address: parseRegisteredAddress(addressValue) } : {}),
    logo: {
      '@type': 'ImageObject',
      url: logoUrl,
      width: site.logos.width,
      height: site.logos.height,
    },
    image: logoUrl,
    sameAs: [site.social.instagram.href],
  };
};

export const createWebSiteSchema = (): Record<string, unknown> => {
  const tradeName = confirmed(businessFacts.tradeName);
  return {
    '@type': 'WebSite',
    '@id': SITE_WEBSITE_ID,
    name: site.name,
    ...(tradeName && tradeName !== site.name ? { alternateName: tradeName } : {}),
    description: site.description,
    url: siteUrl,
    inLanguage: 'es-ES',
    publisher: { '@id': SITE_ORGANIZATION_ID },
  };
};

export interface BreadcrumbEntry {
  name: string;
  path?: string;
}

export const createBreadcrumbListSchema = (
  items: readonly BreadcrumbEntry[],
  origin: string | URL = siteUrl
): Record<string, unknown> => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: toCanonicalUrl(origin, '/'),
    },
    ...items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 2,
      name: item.name,
      ...(item.path ? { item: toCanonicalUrl(origin, item.path) } : {}),
    })),
  ],
});

export const createFaqPageSchema = (
  items: readonly { question: string; answer: string }[],
  canonical: string
): Record<string, unknown> => ({
  '@type': 'FAQPage',
  url: canonical,
  inLanguage: 'es-ES',
  isPartOf: { '@id': SITE_WEBSITE_ID },
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

export const createWebPageSchema = (input: {
  type?: string | readonly string[];
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> => ({
  '@type': input.type ?? 'WebPage',
  name: input.name,
  description: input.description,
  url: input.url,
  inLanguage: 'es-ES',
  isPartOf: { '@id': SITE_WEBSITE_ID },
  about: { '@id': SITE_ORGANIZATION_ID },
  publisher: { '@id': SITE_ORGANIZATION_ID },
  ...(input.datePublished ? { datePublished: input.datePublished } : {}),
  ...(input.dateModified ? { dateModified: input.dateModified } : {}),
});

export const buildSchemaGraph = (
  pageSchema?: Record<string, unknown> | readonly Record<string, unknown>[] | object
): Record<string, unknown> => {
  const pageNodes = pageSchema
    ? (Array.isArray(pageSchema) ? pageSchema : [pageSchema]).map((node) =>
        stripContext(node as Record<string, unknown>)
      )
    : [];

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [createOrganizationSchema(), createWebSiteSchema(), ...pageNodes],
  };
};
