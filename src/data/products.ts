export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  images: string[];
  colorImages: Record<string, string[]>;
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
      'El cinturón de vestir definitivo para el hombre que exige distinción en cada detalle. Confeccionado en piel napa box de primera calidad, el modelo 180/35 destaca por su perfil elegante de 3,5 cm de ancho, perfecto para conjuntos de traje o looks smart-casual. El forro interior en cuero regenerado garantiza una sujeción cómoda durante todo el día, mientras que la hebilla de zamak pulido aporta un cierre seguro con un acabado refinado. Un básico de armario que eleva cualquier atuendo con sutileza y clase.',
    shortDescription: 'Piel napa box. Forro cuero regenerado. Hebilla zamak. Elegancia sin concesiones.',
    images: [
      'https://picsum.photos/seed/kingbelt-180-1/800/1000',
      'https://picsum.photos/seed/kingbelt-180-2/800/1000',
      'https://picsum.photos/seed/kingbelt-180-3/800/1000',
    ],
    colorImages: {
      'Negro': [
        'https://picsum.photos/seed/180-negro-1/800/1000',
        'https://picsum.photos/seed/180-negro-2/800/1000',
      ],
      'Marrón': [
        'https://picsum.photos/seed/180-marron-1/800/1000',
        'https://picsum.photos/seed/180-marron-2/800/1000',
      ],
      'Cuero': [
        'https://picsum.photos/seed/180-cuero-1/800/1000',
        'https://picsum.photos/seed/180-cuero-2/800/1000',
      ],
      'Azul Marino': [
        'https://picsum.photos/seed/180-azul-1/800/1000',
        'https://picsum.photos/seed/180-azul-2/800/1000',
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
    amazonUrl: 'https://amazon.com/kingbelt-vestir-premium-180',
    whatsappMessage: 'Hola, estoy interesado en el modelo Vestir Premium 180 de KingBelt.',
    materials: ['Piel napa box', 'Forro cuero regenerado', 'Hebilla zamak pulido'],
    features: [
      'Ancho: 3,5 cm — perfil ideal para vestir',
      'Sistema de tornillo para ajuste personalizado',
      'Incluye llavero de regalo',
      'Presentado en bolsa de tela para conservación óptima',
    ],
    badge: 'bestseller',
    price: 32.90,
  },
  {
    id: 'MOD-4643/30',
    slug: 'vestir-slim-4643',
    name: 'Vestir Slim 4643',
    description:
      'La síntesis de la elegancia minimalista. Con un ancho reducido de 3 cm, el modelo 4643/30 está pensado para el hombre contemporáneo que busca un cinturón de vestir fino, discreto y sofisticado. La piel napa box confiere una suavidad inigualable y un brillo natural que mejora con el uso. El forro en cuero regenerado y la hebilla de zamak completan un diseño depurado donde menos es más, y cada milímetro cuenta.',
    shortDescription: 'Piel napa box. Perfil slim de 3 cm. Discreción y sofisticación.',
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
      'Incluye llavero de regalo',
      'Presentado en bolsa de tela para conservación óptima',
    ],
    badge: 'new',
    price: 26.90,
  },
  {
    id: 'MOD-5222/35',
    slug: 'carraca-automatica-5222',
    name: 'Carraca Automática 5222',
    description:
      'Versatilidad redefinida. El modelo 5222/35 combina la elegancia de un cinturón de vestir con la comodidad de un cierre automático tipo carraca. Su hebilla de zamak incorpora un sistema de cierre microajustable que permite una sujeción perfecta al milímetro, eliminando los orificios tradicionales. Ideal para el hombre dinámico que alterna entre el entorno profesional y el casual sin tiempo que perder.',
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
      'Incluye llavero de regalo y bolsa de tela',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5215/35',
    slug: 'reversible-5215',
    name: 'Reversible 5215',
    description:
      'Dos colores, un solo cinturón, infinitas posibilidades. El modelo 5215/35 es la elección inteligente del hombre práctico que viaja ligero pero nunca pierde estilo. Con una banda reversible de piel napa box, puedes alternar entre dos tonos según el momento: negro para la oficina, cuero o marrón para el afterwork. La hebilla de zamak giratoria completa un diseño funcional que duplica tu armario con una sola pieza.',
    shortDescription: 'Piel napa box reversible. Dos tonos en uno. Práctico y versátil.',
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
      'Incluye llavero de regalo y bolsa de tela',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5032/35',
    slug: 'casual-vacuno-5032',
    name: 'Casual Vacuno 5032',
    description:
      'Robustez sin renunciar a la elegancia. El modelo 5032/35 está confeccionado en piel de vacuno genuina, con un doble cosido al tono que refuerza la estructura y aporta un detalle visual de artesanía. Su hebilla de zamak y el ancho de 3,5 cm lo convierten en el aliado perfecto para looks casuales con actitud: vaqueros, chinos o incluso un look smart informal. Un cinturón que se siente sólido desde el primer contacto.',
    shortDescription: 'Piel de vacuno. Doble cosido al tono. Robusto y casual.',
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
      'Incluye llavero de regalo y bolsa de tela',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-5004/35',
    slug: 'casual-grabado-5004',
    name: 'Casual Grabado 5004',
    description:
      'Textura con personalidad. El modelo 5004/35 destaca por su grabado central en piel de vacuno, un detalle decorativo que aporta profundidad y carácter a cualquier look casual. La hebilla de zamak y el ancho de 3,5 cm mantienen la proporción ideal para combinarlo con vaqueros o pantalones chinos. Un cinturón que no pasa desapercibido pero nunca grita: la confianza del detalle bien resuelto.',
    shortDescription: 'Piel de vacuno con grabado central. Textura y carácter.',
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
      'Incluye llavero de regalo y bolsa de tela',
    ],
    price: 34.90,
  },
  {
    id: 'MOD-4704/35',
    slug: 'casual-serraje-4704',
    name: 'Casual Serraje 4704',
    description:
      'La suavidad del ante en su expresión más pura. El modelo 4704/35 está confeccionado en piel serraje de tacto aterciopelado, con forro interior en cuero regenerado que garantiza comodidad y durabilidad. Su hebilla de zamak y el ancho de 3,5 cm lo convierten en una pieza casual distinguida, perfecta para quienes buscan texturas diferentes sin abandonar la elegancia. Un acabado que evoca tradición artesanal.',
    shortDescription: 'Piel serraje/ante. Tacto aterciopelado. Tradición artesanal.',
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
      'Incluye llavero de regalo y bolsa de tela',
    ],
    price: 32.90,
  },
  {
    id: 'MOD-5444/35',
    slug: 'casual-combinado-5444',
    name: 'Casual Combinado 5444',
    description:
      'La armonía de dos mundos. El modelo 5444/35 combina piel de vacuno lisa con insertos de serraje/ante en un diseño que juega con contrates de textura y matiz. La hebilla de zamak une ambos mundos con elegancia, mientras que el ancho de 3,5 cm mantiene la proporción ideal para looks casuales con personalidad. Para el hombre que no teme mezclar y que entiende que la autenticidad está en los detalles.',
    shortDescription: 'Piel vacuno combinada con serraje. Texturas y contrastes.',
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
      'Incluye llavero de regalo y bolsa de tela',
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
