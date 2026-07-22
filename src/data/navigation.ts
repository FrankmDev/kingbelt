import { site } from './site';
import type { IconName } from '../components/ui/icon-paths';
import { legalFooterNav } from './legal';
import { helpFooterNav } from './help';
import { publicHighlights } from './business';

export interface NavItem {
  label: string;
  href: string;
}

export interface ChannelLink extends NavItem {
  external: boolean;
}

export const mainNav: NavItem[] = [
  { label: 'La marca', href: '/sobre' },
  { label: 'Revista', href: '/blog' },
  { label: 'Atención', href: '/ayuda' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerNav: NavItem[] = [
  { label: 'La marca', href: '/sobre' },
  { label: 'Revista', href: '/blog' },
  { label: 'Atención', href: '/ayuda' },
  { label: 'Colección', href: '/coleccion' },
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
    value: '@kingbelt',
    href: site.urls.instagram,
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

export const contactChannels: ChannelLink[] = [
  { label: 'Escribir por email', href: `mailto:${site.contact.email}`, external: false },
  { label: 'Instagram', href: site.urls.instagram, external: true },
];

export const socialLinks = [
  { label: 'Instagram', href: site.urls.instagram, icon: 'instagram' },
] as const;
