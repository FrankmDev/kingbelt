import { site } from './site';
import type { IconName } from '../components/ui/icon-paths';

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
  { label: 'Atención', href: '/#atencion' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerNav: NavItem[] = [
  { label: 'La marca', href: '/sobre' },
  { label: 'Revista', href: '/blog' },
  { label: 'Atención', href: '/#atencion' },
  { label: 'Colección', href: '/coleccion' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerHelpNav: NavItem[] = [
  { label: 'Preguntas frecuentes', href: '/contacto' },
  { label: 'Privacidad', href: '/privacidad' },
];

export const footerHighlights = [
  'Hecho en España',
  'Envío 24–72h península',
  'Embalaje incluido',
] as const;

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
