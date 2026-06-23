import type { ImageMetadata } from 'astro';

export type ProductImage = string | ImageMetadata;

const productAssetModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/products/**/*.{avif,jpg,jpeg,png,webp}',
  { eager: true },
);

function productAsset(path: string): ImageMetadata {
  const module = productAssetModules[`../assets/products/${path}`];
  if (!module) {
    throw new Error(`Missing product asset: src/assets/products/${path}`);
  }

  return module.default;
}

const producto1ColorImages: Record<string, ProductImage[]> = {
  Marrón: [
    productAsset('producto1/1-1/portada.jpg'),
    productAsset('producto1/1-1/perspectiva1.png'),
    productAsset('producto1/1-1/perspectiva2.png'),
  ],
  'Azul Marino': [
    productAsset('producto1/1-2/portada.png'),
    productAsset('producto1/1-2/perspectiva1.png'),
    productAsset('producto1/1-2/perspectiva2.png'),
  ],
  Cuero: [
    productAsset('producto1/1-3/portada.png'),
    productAsset('producto1/1-3/perspectiva1.png'),
    productAsset('producto1/1-3/perspectiva2.png'),
  ],
  Negro: [
    productAsset('producto1/1-4/portada.png'),
    productAsset('producto1/1-4/perspectiva1.png'),
    productAsset('producto1/1-4/perspectiva2.png'),
  ],
};

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  images: ProductImage[];
  colorImages: Record<string, ProductImage[]>;
  colors: { name: string; hex: string }[];
  sizes: string[];
  amazonUrl: string;
  whatsappMessage: string;
  materials: string[];
  features: string[];
  badge?: 'new' | 'bestseller';
  price: number;
  sizeEquivalence?: Record<string, number>;
}

export const products: Product[] = [
  {
    id: 'MOD-180/35',
    slug: 'vestir-premium-180',
    name: 'Vestir Premium 180',
    description:
      'Cinturón de vestir confeccionado en piel napa box. Perfil de 3,5 cm de ancho, pensado para traje o looks smart-casual. Forro interior en cuero regenerado para sujeción cómoda. Hebilla de zamak pulido con cierre seguro y acabado refinado.',
    shortDescription: 'Piel napa box. Forro cuero regenerado. Hebilla zamak pulido. 3,5 cm.',
    images: producto1ColorImages.Marrón,
    colorImages: producto1ColorImages,
    colors: [
      { name: 'Marrón', hex: '#3A2419' },
      { name: 'Azul Marino', hex: '#111823' },
      { name: 'Cuero', hex: '#8B4F2E' },
      { name: 'Negro', hex: '#0B0B0A' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-vestir-premium-180',
    whatsappMessage: 'Hola, estoy interesado en el modelo Vestir Premium 180 de KingBelt.',
    materials: ['Piel napa box', 'Forro cuero regenerado', 'Hebilla zamak pulido'],
    features: [
      'Ancho: 3,5 cm — perfil ideal para vestir',
      'Sistema de tornillo para ajuste personalizado',
    ],
    badge: 'bestseller',
    price: 32.90,
  },
  {
    id: 'MOD-4643/30',
    slug: 'vestir-slim-4643',
    name: 'Vestir Slim 4643',
    description:
      'Cinturón de vestir con ancho reducido de 3 cm, perfil fino para trajes ajustados. Piel napa box con brillo natural que mejora con el uso. Forro en cuero regenerado y hebilla de zamak. Diseño depurado.',
    shortDescription: 'Piel napa box. Perfil slim de 3 cm. Hebilla zamak.',
    images: [
      'https://picsum.photos/seed/kingbelt-4643-1/800/1000',
      'https://picsum.photos/seed/kingbelt-4643-2/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/4643-negro-1/800/1000',
        'https://picsum.photos/seed/4643-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/4643-marron-1/800/1000',
        'https://picsum.photos/seed/4643-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/4643-cuero-1/800/1000',
        'https://picsum.photos/seed/4643-cuero-2/800/1000',
      ],
      'Azul Marino': [
        'https://picsum.photos/seed/4643-azul-1/800/1000',
        'https://picsum.photos/seed/4643-azul-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
      { name: 'Azul Marino', hex: '#1A2F4B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-vestir-slim-4643',
    whatsappMessage: 'Hola, estoy interesado en el modelo Vestir Slim 4643 de KingBelt.',
    materials: ['Piel napa box', 'Forro cuero regenerado', 'Hebilla zamak'],
    features: [
      'Ancho: 3 cm — perfil extra fino para trajes ajustados',
      'Sistema de tornillo para ajuste personalizado',
    ],
    badge: 'new',
    price: 26.90,
  },
  {
    id: 'MOD-5222/35',
    slug: 'carraca-automatica-5222',
    name: 'Carraca Automática 5222',
    description:
      'Cinturón con cierre automático tipo carraca. Hebilla de zamak con sistema microajustable que permite una sujeción precisa al milímetro, sin orificios tradicionales. Para uso profesional y casual.',
    shortDescription: 'Cierre automático carraca. Ajuste milimétrico. Vestir y casual.',
    images: [
      'https://picsum.photos/seed/kingbelt-5222-1/800/1000',
      'https://picsum.photos/seed/kingbelt-5222-2/800/1000',
      'https://picsum.photos/seed/kingbelt-5222-3/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/5222-negro-1/800/1000',
        'https://picsum.photos/seed/5222-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/5222-marron-1/800/1000',
        'https://picsum.photos/seed/5222-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/5222-cuero-1/800/1000',
        'https://picsum.photos/seed/5222-cuero-2/800/1000',
      ],
      'Azul Marino': [
        'https://picsum.photos/seed/5222-azul-1/800/1000',
        'https://picsum.photos/seed/5222-azul-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
      { name: 'Azul Marino', hex: '#1A2F4B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-carraca-5222',
    whatsappMessage: 'Hola, estoy interesado en el modelo Carraca Automática 5222 de KingBelt.',
    materials: ['Piel napa box', 'Forro cuero regenerado', 'Hebilla zamak con cierre automático'],
    features: [
      'Cierre automático carraca — ajuste milimétrico sin orificios',
      'Ancho: 3,5 cm — versátil para vestir o casual',
      'Sistema de tornillo para ajuste personalizado',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5215/35',
    slug: 'reversible-5215',
    name: 'Reversible 5215',
    description:
      'Cinturón reversible con banda de piel napa box en dos tonos. Alterna entre negro para oficina y cuero o marrón para el resto del día. Hebilla de zamak giratoria que permite cambiar de tono en segundos.',
    shortDescription: 'Piel napa box reversible. Dos tonos en uno. Hebilla giratoria.',
    images: [
      'https://picsum.photos/seed/kingbelt-5215-1/800/1000',
      'https://picsum.photos/seed/kingbelt-5215-2/800/1000',
    ],
    colorImages: {
      'Negro / Cuero': [
        'https://picsum.photos/seed/5215-nc-1/800/1000',
        'https://picsum.photos/seed/5215-nc-2/800/1000',
      ],
      'Negro / Marrón': [
        'https://picsum.photos/seed/5215-nm-1/800/1000',
        'https://picsum.photos/seed/5215-nm-2/800/1000',
      ],
      'Negro / Azul Marino': [
        'https://picsum.photos/seed/5215-na-1/800/1000',
        'https://picsum.photos/seed/5215-na-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro / Cuero', hex: '#2D2518' },
      { name: 'Negro / Marrón', hex: '#3B2418' },
      { name: 'Negro / Azul Marino', hex: '#1A2230' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-reversible-5215',
    whatsappMessage: 'Hola, estoy interesado en el modelo Reversible 5215 de KingBelt.',
    materials: ['Piel napa box reversible', 'Hebilla zamak giratoria'],
    features: [
      'Diseño reversible — dos colores en una sola pieza',
      'Hebilla giratoria para cambio de tono en segundos',
      'Ancho: 3,5 cm',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5032/35',
    slug: 'casual-vacuno-5032',
    name: 'Casual Vacuno 5032',
    description:
      'Cinturón en piel de vacuno con doble cosido al tono que refuerza la estructura. Hebilla de zamak, ancho 3,5 cm. Para vaqueros, chinos o smart informal.',
    shortDescription: 'Piel de vacuno. Doble cosido al tono. 3,5 cm.',
    images: [
      'https://picsum.photos/seed/kingbelt-5032-1/800/1000',
      'https://picsum.photos/seed/kingbelt-5032-2/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/5032-negro-1/800/1000',
        'https://picsum.photos/seed/5032-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/5032-marron-1/800/1000',
        'https://picsum.photos/seed/5032-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/5032-cuero-1/800/1000',
        'https://picsum.photos/seed/5032-cuero-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-casual-5032',
    whatsappMessage: 'Hola, estoy interesado en el modelo Casual Vacuno 5032 de KingBelt.',
    materials: ['Piel de vacuno', 'Hebilla zamak'],
    features: [
      'Doble cosido al tono — resistencia y estética',
      'Ancho: 3,5 cm',
      'Sistema de tornillo para ajuste personalizado',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5004/35',
    slug: 'casual-grabado-5004',
    name: 'Casual Grabado 5004',
    description:
      'Cinturón con grabado central en piel de vacuno. Detalle decorativo en relieve que aporta profundidad al look casual. Hebilla de zamak, ancho 3,5 cm. Para vaqueros o chinos.',
    shortDescription: 'Piel de vacuno con grabado central. 3,5 cm.',
    images: [
      'https://picsum.photos/seed/kingbelt-5004-1/800/1000',
      'https://picsum.photos/seed/kingbelt-5004-2/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/5004-negro-1/800/1000',
        'https://picsum.photos/seed/5004-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/5004-marron-1/800/1000',
        'https://picsum.photos/seed/5004-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/5004-cuero-1/800/1000',
        'https://picsum.photos/seed/5004-cuero-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-casual-5004',
    whatsappMessage: 'Hola, estoy interesado en el modelo Casual Grabado 5004 de KingBelt.',
    materials: ['Piel de vacuno con grabado central', 'Hebilla zamak'],
    features: [
      'Grabado central decorativo en relieve',
      'Ancho: 3,5 cm',
      'Sistema de tornillo para ajuste personalizado',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-4704/35',
    slug: 'casual-serraje-4704',
    name: 'Casual Serraje 4704',
    description:
      'Cinturón en piel serraje de tacto aterciopelado con forro interior en cuero regenerado. Hebilla de zamak, ancho 3,5 cm. Para looks casuales con textura y comodidad.',
    shortDescription: 'Piel serraje/ante. Forro cuero regenerado. 3,5 cm.',
    images: [
      'https://picsum.photos/seed/kingbelt-4704-1/800/1000',
      'https://picsum.photos/seed/kingbelt-4704-2/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/4704-negro-1/800/1000',
        'https://picsum.photos/seed/4704-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/4704-marron-1/800/1000',
        'https://picsum.photos/seed/4704-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/4704-cuero-1/800/1000',
        'https://picsum.photos/seed/4704-cuero-2/800/1000',
      ],
      'Azul Marino': [
        'https://picsum.photos/seed/4704-azul-1/800/1000',
        'https://picsum.photos/seed/4704-azul-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
      { name: 'Azul Marino', hex: '#1A2F4B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-serraje-4704',
    whatsappMessage: 'Hola, estoy interesado en el modelo Casual Serraje 4704 de KingBelt.',
    materials: ['Piel serraje/ante', 'Forro cuero regenerado', 'Hebilla zamak'],
    features: [
      'Piel serraje de tacto aterciopelado',
      'Ancho: 3,5 cm',
      'Sistema de tornillo para ajuste personalizado',
    ],
    price: 32.90,
  },
  {
    id: 'MOD-5444/35',
    slug: 'casual-combinado-5444',
    name: 'Casual Combinado 5444',
    description:
      'Cinturón que combina piel de vacuno lisa con insertos de serraje/ante. Contraste de texturas y matices. Hebilla de zamak, ancho 3,5 cm. Para looks casuales.',
    shortDescription: 'Piel vacuno combinada con serraje. Contraste de texturas.',
    images: [
      'https://picsum.photos/seed/kingbelt-5444-1/800/1000',
      'https://picsum.photos/seed/kingbelt-5444-2/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/5444-negro-1/800/1000',
        'https://picsum.photos/seed/5444-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/5444-marron-1/800/1000',
        'https://picsum.photos/seed/5444-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/5444-cuero-1/800/1000',
        'https://picsum.photos/seed/5444-cuero-2/800/1000',
      ],
      'Azul Marino': [
        'https://picsum.photos/seed/5444-azul-1/800/1000',
        'https://picsum.photos/seed/5444-azul-2/800/1000',
      ],
    },
    colors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Marrón', hex: '#6B3A1F' },
      { name: 'Cuero', hex: '#8B5A2B' },
      { name: 'Azul Marino', hex: '#1A2F4B' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    sizeEquivalence: {
      '90': 105,
      '95': 110,
      '100': 115,
      '105': 120,
      '110': 130,
      '115': 135,
    },
    amazonUrl: 'https://amazon.com/kingbelt-combinado-5444',
    whatsappMessage: 'Hola, estoy interesado en el modelo Casual Combinado 5444 de KingBelt.',
    materials: ['Piel de vacuno', 'Piel serraje/ante', 'Hebilla zamak'],
    features: [
      'Combinación de piel lisa y serraje en un solo diseño',
      'Ancho: 3,5 cm',
      'Sistema de tornillo para ajuste personalizado',
    ],
    price: 34.90,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(currentSlug: string, limit = 3): Product[] {
  return products.filter((p) => p.slug !== currentSlug).slice(0, limit);
}
