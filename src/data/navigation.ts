import { site } from './site';

export interface NavItem {
  label: string;
  href: string;
}

export interface ChannelLink extends NavItem {
  external: boolean;
}

export const mainNav: NavItem[] = [
  { label: 'La marca', href: '/#marca' },
  { label: 'Proceso', href: '/#proceso' },
  { label: 'Contacto', href: '/#contacto' },
];

export const footerNav: NavItem[] = [
  { label: 'La marca', href: '/#marca' },
  { label: 'Proceso', href: '/#proceso' },
  { label: 'Contacto', href: '/#contacto' },
];

export const contactChannels: ChannelLink[] = [
  { label: 'Consultar por WhatsApp', href: site.urls.whatsapp, external: true },
  { label: 'Instagram', href: site.urls.instagram, external: true },
];

export const socialLinks = [
  { label: 'Instagram', href: site.urls.instagram, icon: 'instagram' },
  { label: 'WhatsApp', href: site.urls.whatsapp, icon: 'paper-plane' },
] as const;
