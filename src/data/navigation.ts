export interface NavItem {
  label: string;
  href: string;
}

export const mainNav: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Colección', href: '/#coleccion' },
  { label: 'La Marca', href: '/#marca' },
  { label: 'Contacto', href: '/#contacto' },
];

export const footerNav: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Colección', href: '/#coleccion' },
  { label: 'La Marca', href: '/#marca' },
  { label: 'Contacto', href: '/#contacto' },
];

export const socialLinks = [
  { label: 'Instagram', href: 'https://instagram.com/kingbelt' },
  { label: 'WhatsApp', href: 'https://wa.me/1234567890' },
];
