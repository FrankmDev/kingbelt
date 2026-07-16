/** Datos provisionales de catálogo — sustituir por capa de comercio / Shopify. */

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  /** Destino provisional hasta conectar rutas de colección. */
  href: string;
  featured?: boolean;
  badge?: string;
  tagline?: string;
}

export interface ProductPreview {
  id: string;
  name: string;
  slug: string;
  category: string;
  color: string;
  price: number;
  currency: 'EUR';
  image: string;
  imageAlt: string;
  imagePosition?: string;
  badge?: string;
  /** Destino provisional hasta existir PDP. */
  href: string;
}

export const productCategories: ProductCategory[] = [
  {
    id: 'vestir',
    name: 'Vestir',
    slug: 'vestir',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro de vestir sobre fondo neutro',
    imagePosition: 'center 62%',
    href: '#coleccion',
    featured: true,
    badge: 'Principal',
    tagline: 'Silueta limpia para conjunto formal',
  },
  {
    id: 'casual',
    name: 'Casual',
    slug: 'casual',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón marrón para uso diario',
    imagePosition: 'center 55%',
    href: '#coleccion',
    tagline: 'Proporción para el día a día',
  },
  {
    id: 'sport',
    name: 'Sport',
    slug: 'sport',
    image: '/image.jpg',
    imageAlt: 'Selección de cinturones con acabado resistente',
    imagePosition: 'center 42%',
    href: '#coleccion',
    tagline: 'Acabado resistente con carácter',
  },
];

export const featuredProducts: ProductPreview[] = [
  {
    id: 'kb-001',
    name: 'Cinturón Atlas',
    slug: 'cinturon-atlas',
    category: 'Vestir',
    color: 'Negro',
    price: 89,
    currency: 'EUR',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón Atlas negro con hebilla metálica',
    imagePosition: 'center 65%',
    badge: 'Nuevo',
    href: '#coleccion',
  },
  {
    id: 'kb-002',
    name: 'Cinturón Ruta',
    slug: 'cinturon-ruta',
    category: 'Casual',
    color: 'Marrón',
    price: 79,
    currency: 'EUR',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón Ruta marrón con textura de cuero',
    imagePosition: 'center 50%',
    href: '#coleccion',
  },
  {
    id: 'kb-003',
    name: 'Cinturón Garaje',
    slug: 'cinturon-garaje',
    category: 'Sport',
    color: 'Negro / acero',
    price: 85,
    currency: 'EUR',
    image: '/image.jpg',
    imageAlt: 'Cinturón Garaje con herraje oscuro',
    imagePosition: 'center 40%',
    href: '#coleccion',
  },
  {
    id: 'kb-004',
    name: 'Cinturón Bandera',
    slug: 'cinturon-bandera',
    category: 'Casual',
    color: 'Marrón / detalle tricolor',
    price: 95,
    currency: 'EUR',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Cinturón con detalle de bandera española',
    imagePosition: 'center 58%',
    badge: 'Edición',
    href: '#coleccion',
  },
];

export const formatPrice = (price: number, currency: ProductPreview['currency'] = 'EUR') =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
