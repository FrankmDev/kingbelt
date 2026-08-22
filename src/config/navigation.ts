import type { IconName } from '../components/ui/icon-paths';
import { legalFooterNav } from '@content/legal';
import { helpFooterNav } from '@content/help';
import { publicHighlights, businessFacts, confirmed, toTelHref } from './business';
import { site } from './site';

export interface NavItem {
  label: string;
  href: string;
}

export interface HeaderAccountCta {
  label: string;
  ariaLabel: string;
  unavailableAriaLabel: string;
}

/** Copy del CTA de cuenta. El href lo resuelve `commerce-navigation` según el origen. */
export const headerAccountCta: HeaderAccountCta = {
  label: 'Mi cuenta',
  ariaLabel: 'Mi cuenta',
  unavailableAriaLabel: 'Mi cuenta no disponible',
};

export const mainNav: NavItem[] = [
  { label: 'Productos', href: '/productos' },
  { label: 'La marca', href: '/sobre' },
  { label: 'Revista', href: '/blog' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerNav: NavItem[] = [
  { label: 'Productos', href: '/productos' },
  { label: 'La marca', href: '/sobre' },
  { label: 'Revista', href: '/blog' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerHelpNav: NavItem[] = [...helpFooterNav];

export const footerLegalNav: NavItem[] = [...legalFooterNav];

export const footerHighlights = publicHighlights();

const footerEmail = confirmed(businessFacts.email) ?? site.contact.email;
const footerPhone = confirmed(businessFacts.phone);

export const footerContact: readonly {
  label: string;
  value: string;
  href: string;
  external: boolean;
  icon: IconName;
}[] = [
  {
    label: 'Email',
    value: footerEmail,
    href: `mailto:${footerEmail}`,
    external: false,
    icon: 'mail',
  },
  ...(footerPhone
    ? [
        {
          label: 'Teléfono',
          value: footerPhone,
          href: toTelHref(footerPhone),
          external: false,
          icon: 'phone' as IconName,
        },
      ]
    : []),
  {
    label: 'Instagram',
    value: site.social.instagram.handle,
    href: site.social.instagram.href,
    external: true,
    icon: 'instagram',
  },
];

export const socialLinks = [
  { label: 'Instagram', href: site.social.instagram.href, icon: 'instagram' },
] as const;
