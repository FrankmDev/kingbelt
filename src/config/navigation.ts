import type { IconName } from '../components/ui/icon-paths';
import { legalFooterNav } from '@content/legal';
import { helpFooterNav } from '@content/help';
import { publicHighlights } from './business';
import { site } from './site';

export interface NavItem {
  label: string;
  href: string;
}

export interface HeaderAccountCta {
  label: string;
  href: string;
  ariaLabel: string;
}

/** CTA de cuenta en header y menú móvil. Login y registro comparten el mismo flujo alojado. */
export const headerAccountCta: HeaderAccountCta = {
  label: 'Iniciar sesión',
  href: '/cuenta/iniciar',
  ariaLabel: 'Iniciar sesión o crear cuenta',
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

export const footerContact = [
  {
    label: 'Email',
    value: site.contact.email,
    href: `mailto:${site.contact.email}`,
    external: false,
    icon: 'mail',
  },
  {
    label: 'Instagram',
    value: site.social.instagram.handle,
    href: site.social.instagram.href,
    external: true,
    icon: 'instagram',
  },
] as const satisfies readonly {
  label: string;
  value: string;
  href: string;
  external: boolean;
  icon: IconName;
}[];

export const socialLinks = [
  { label: 'Instagram', href: site.social.instagram.href, icon: 'instagram' },
] as const;
