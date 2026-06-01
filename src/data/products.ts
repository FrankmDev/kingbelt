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
}

export const products: Product[] = [
  {
    id: 'kb-001',
    slug: 'roadmaster-classic',
    name: 'Roadmaster Classic',
    description:
      'El cinturón definitivo para el hombre que vive en movimiento. Confeccionado en piel de vacuno de grano completo de 4mm de espesor, el Roadmaster Classic combina la robustez de la tradición motera con una silueta depurada y contemporánea. La hebilla de acero inoxidable cepillado aporta un punto de luz industrial que eleva cualquier look.',
    shortDescription: 'Piel grano completo. Hebilla acero cepillado. El clásico reinventado.',
    images: [
      'https://picsum.photos/seed/kingbelt-roadmaster-1/800/1000',
      'https://picsum.photos/seed/kingbelt-roadmaster-2/800/1000',
      'https://picsum.photos/seed/kingbelt-roadmaster-3/800/1000',
    ],
    colorImages: {
      'Noir': [
        'https://picsum.photos/seed/roadmaster-noir-1/800/1000',
        'https://picsum.photos/seed/roadmaster-noir-2/800/1000',
        'https://picsum.photos/seed/roadmaster-noir-3/800/1000',
      ],
      'Cognac': [
        'https://picsum.photos/seed/roadmaster-cognac-1/800/1000',
        'https://picsum.photos/seed/roadmaster-cognac-2/800/1000',
        'https://picsum.photos/seed/roadmaster-cognac-3/800/1000',
      ],
      'Graphite': [
        'https://picsum.photos/seed/roadmaster-graphite-1/800/1000',
        'https://picsum.photos/seed/roadmaster-graphite-2/800/1000',
        'https://picsum.photos/seed/roadmaster-graphite-3/800/1000',
      ],
      'Saddle': [
        'https://picsum.photos/seed/roadmaster-saddle-1/800/1000',
        'https://picsum.photos/seed/roadmaster-saddle-2/800/1000',
        'https://picsum.photos/seed/roadmaster-saddle-3/800/1000',
      ],
    },
    colors: [
      { name: 'Noir', hex: '#1A1A1A' },
      { name: 'Cognac', hex: '#6B3A1F' },
      { name: 'Graphite', hex: '#3A3A3A' },
      { name: 'Saddle', hex: '#8B5A2B' },
    ],
    sizes: ['85', '90', '95', '100', '105', '110'],
    amazonUrl: 'https://amazon.com/kingbelt-roadmaster-classic',
    whatsappMessage: 'Hola, estoy interesado en el modelo Roadmaster Classic de KingBelt.',
    materials: ['Piel de vacuno grano completo', 'Forro interior de microfibra', 'Hebilla de acero inoxidable 316L'],
    features: [
      'Costuras reforzadas a doble aguja',
      'Acabado envejecido a mano',
      'Resistente al agua y abrasión',
      'Ancho: 4cm',
    ],
    badge: 'bestseller',
  },
  {
    id: 'kb-002',
    slug: 'iron-striker',
    name: 'Iron Striker',
    description:
      'Diseñado para soportar el paso del tiempo sin perder identidad. El Iron Striker presenta una hebilla de doble pasador en acero bruto que evoca la estética de los talleres mecánicos de Detroit. La piel vaquetilla se oscurece con el uso, desarrollando una pátina única que cuenta tu historia.',
    shortDescription: 'Vaquetilla natural. Doble pasador. Evoluciona contigo.',
    images: [
      'https://picsum.photos/seed/kingbelt-iron-1/800/1000',
      'https://picsum.photos/seed/kingbelt-iron-2/800/1000',
    ],
    colorImages: {
      'Midnight': [
        'https://picsum.photos/seed/iron-midnight-1/800/1000',
        'https://picsum.photos/seed/iron-midnight-2/800/1000',
      ],
      'Tan': [
        'https://picsum.photos/seed/iron-tan-1/800/1000',
        'https://picsum.photos/seed/iron-tan-2/800/1000',
      ],
      'Saddle': [
        'https://picsum.photos/seed/iron-saddle-1/800/1000',
        'https://picsum.photos/seed/iron-saddle-2/800/1000',
      ],
      'Graphite': [
        'https://picsum.photos/seed/iron-graphite-1/800/1000',
        'https://picsum.photos/seed/iron-graphite-2/800/1000',
      ],
    },
    colors: [
      { name: 'Midnight', hex: '#0F0F0F' },
      { name: 'Tan', hex: '#8B5A2B' },
      { name: 'Saddle', hex: '#7B4E2D' },
      { name: 'Graphite', hex: '#3A3A3A' },
    ],
    sizes: ['90', '95', '100', '105', '110'],
    amazonUrl: 'https://amazon.com/kingbelt-iron-striker',
    whatsappMessage: 'Hola, estoy interesado en el modelo Iron Striker de KingBelt.',
    materials: ['Vaquetilla de curtición vegetal', 'Hebilla de acero bruto', 'Herrajes de latón'],
    features: [
      'Doble pasador de seguridad',
      'Pátina natural progresiva',
      'Borde bruñido a mano',
      'Ancho: 3.8cm',
    ],
  },
  {
    id: 'kb-003',
    slug: 'asphalt-rider',
    name: 'Asphalt Rider',
    description:
      'Minimalismo extremo para el hombre que prefiere dejar que sus acciones hablen. El Asphalt Rider elimina lo superfluo para centrarse en la esencia: una banda de piel negra mate de altísima calidad y una hebilla de perfil bajo en negro mate. Invisible hasta que decides destacar.',
    shortDescription: 'Piel negra mate. Hebilla low-profile. Sutileza total.',
    images: [
      'https://picsum.photos/seed/kingbelt-asphalt-1/800/1000',
      'https://picsum.photos/seed/kingbelt-asphalt-2/800/1000',
      'https://picsum.photos/seed/kingbelt-asphalt-3/800/1000',
    ],
    colorImages: {
      'Stealth': [
        'https://picsum.photos/seed/asphalt-stealth-1/800/1000',
        'https://picsum.photos/seed/asphalt-stealth-2/800/1000',
        'https://picsum.photos/seed/asphalt-stealth-3/800/1000',
      ],
      'Charcoal': [
        'https://picsum.photos/seed/asphalt-charcoal-1/800/1000',
        'https://picsum.photos/seed/asphalt-charcoal-2/800/1000',
        'https://picsum.photos/seed/asphalt-charcoal-3/800/1000',
      ],
      'Obsidian': [
        'https://picsum.photos/seed/asphalt-obsidian-1/800/1000',
        'https://picsum.photos/seed/asphalt-obsidian-2/800/1000',
        'https://picsum.photos/seed/asphalt-obsidian-3/800/1000',
      ],
      'Slate': [
        'https://picsum.photos/seed/asphalt-slate-1/800/1000',
        'https://picsum.photos/seed/asphalt-slate-2/800/1000',
        'https://picsum.photos/seed/asphalt-slate-3/800/1000',
      ],
    },
    colors: [
      { name: 'Stealth', hex: '#0A0A0A' },
      { name: 'Charcoal', hex: '#2D2D2D' },
      { name: 'Obsidian', hex: '#111111' },
      { name: 'Slate', hex: '#4A4A4A' },
    ],
    sizes: ['85', '90', '95', '100', '105'],
    amazonUrl: 'https://amazon.com/kingbelt-asphalt-rider',
    whatsappMessage: 'Hola, estoy interesado en el modelo Asphalt Rider de KingBelt.',
    materials: ['Piel de becerro napa', 'Hebilla de zamak con PVD negro mate', 'Forro de algodón orgánico'],
    features: [
      'Hebilla de perfil ultra-bajo',
      'Acabado mate resistente a arañazos',
      'Flexibilidad superior desde el primer uso',
      'Ancho: 3.5cm',
    ],
    badge: 'new',
  },
  {
    id: 'kb-004',
    slug: 'tank-buckle',
    name: 'Tank Buckle',
    description:
      'La hebilla más imponente de la colección. Inspirada en las chapas de blindaje de los vehículos industriales, la hebilla del Tank tiene un peso y una presencia física real. Equilibrada por una banda de piel gruesa que distribuye la tensión con maestría.',
    shortDescription: 'Hebilla statement. Piel gruesa. Presencia innegable.',
    images: [
      'https://picsum.photos/seed/kingbelt-tank-1/800/1000',
      'https://picsum.photos/seed/kingbelt-tank-2/800/1000',
    ],
    colorImages: {
      'Raw Black': [
        'https://picsum.photos/seed/tank-rawblack-1/800/1000',
        'https://picsum.photos/seed/tank-rawblack-2/800/1000',
      ],
      'Saddle': [
        'https://picsum.photos/seed/tank-saddle-1/800/1000',
        'https://picsum.photos/seed/tank-saddle-2/800/1000',
      ],
      'Graphite': [
        'https://picsum.photos/seed/tank-graphite-1/800/1000',
        'https://picsum.photos/seed/tank-graphite-2/800/1000',
      ],
      'Cognac': [
        'https://picsum.photos/seed/tank-cognac-1/800/1000',
        'https://picsum.photos/seed/tank-cognac-2/800/1000',
      ],
    },
    colors: [
      { name: 'Raw Black', hex: '#111111' },
      { name: 'Saddle', hex: '#7B4E2D' },
      { name: 'Graphite', hex: '#3A3A3A' },
      { name: 'Cognac', hex: '#6B3A1F' },
    ],
    sizes: ['90', '95', '100', '105', '110', '115'],
    amazonUrl: 'https://amazon.com/kingbelt-tank-buckle',
    whatsappMessage: 'Hola, estoy interesado en el modelo Tank Buckle de KingBelt.',
    materials: ['Piel de búfalo de 5mm', 'Hebilla de acero fundido', 'Remaches de cobre'],
    features: [
      'Hebilla de placa completa estilo industrial',
      'Remaches decorativos funcionales',
      'Banda extra gruesa para máxima durabilidad',
      'Ancho: 4.5cm',
    ],
  },
  {
    id: 'kb-005',
    slug: 'night-crawler',
    name: 'Night Crawler',
    description:
      'Elegancia nocturna con un twist subversivo. El Night Crawler combina piel de serpiente texturizada en relieve con una hebilla geométrica en tono antracita. Diseñado para la noche, funciona igual de bien con un traje oscuro que con una chaqueta de cuero.',
    shortDescription: 'Textura reptil. Hebilla geométrica. Elegancia oscura.',
    images: [
      'https://picsum.photos/seed/kingbelt-night-1/800/1000',
      'https://picsum.photos/seed/kingbelt-night-2/800/1000',
    ],
    colorImages: {
      'Onyx': [
        'https://picsum.photos/seed/night-onyx-1/800/1000',
        'https://picsum.photos/seed/night-onyx-2/800/1000',
      ],
      'Viper': [
        'https://picsum.photos/seed/night-viper-1/800/1000',
        'https://picsum.photos/seed/night-viper-2/800/1000',
      ],
      'Obsidian': [
        'https://picsum.photos/seed/night-obsidian-1/800/1000',
        'https://picsum.photos/seed/night-obsidian-2/800/1000',
      ],
      'Saddle': [
        'https://picsum.photos/seed/night-saddle-1/800/1000',
        'https://picsum.photos/seed/night-saddle-2/800/1000',
      ],
    },
    colors: [
      { name: 'Onyx', hex: '#0D0D0D' },
      { name: 'Viper', hex: '#3D2B1F' },
      { name: 'Obsidian', hex: '#1A1A1A' },
      { name: 'Saddle', hex: '#8B5A2B' },
    ],
    sizes: ['85', '90', '95', '100', '105'],
    amazonUrl: 'https://amazon.com/kingbelt-night-crawler',
    whatsappMessage: 'Hola, estoy interesado en el modelo Night Crawler de KingBelt.',
    materials: ['Piel de vacuno con grabado reptil', 'Hebilla de aleación de zinc', 'Barniz protector mate'],
    features: [
      'Textura en relieve con efecto 3D',
      'Hebilla geométrica de diseño exclusivo',
      'Tratamiento hidrófugo',
      'Ancho: 3.5cm',
    ],
  },
  {
    id: 'kb-006',
    slug: 'highway-king',
    name: 'Highway King',
    description:
      'El flagship de KingBelt. El Highway King es la síntesis perfecta entre lujo artesanal y utilidad motera. Construido con tiras de piel seleccionadas a mano, presenta una hebilla de latón macizo con acabado vintage que recuerda a las insignias de las carreteras americanas.',
    shortDescription: 'Latón macizo. Piel seleccionada a mano. El buque insignia.',
    images: [
      'https://picsum.photos/seed/kingbelt-highway-1/800/1000',
      'https://picsum.photos/seed/kingbelt-highway-2/800/1000',
      'https://picsum.photos/seed/kingbelt-highway-3/800/1000',
    ],
    colorImages: {
      'Burnished': [
        'https://picsum.photos/seed/highway-burnished-1/800/1000',
        'https://picsum.photos/seed/highway-burnished-2/800/1000',
        'https://picsum.photos/seed/highway-burnished-3/800/1000',
      ],
      'Jet': [
        'https://picsum.photos/seed/highway-jet-1/800/1000',
        'https://picsum.photos/seed/highway-jet-2/800/1000',
        'https://picsum.photos/seed/highway-jet-3/800/1000',
      ],
      'Cognac': [
        'https://picsum.photos/seed/highway-cognac-1/800/1000',
        'https://picsum.photos/seed/highway-cognac-2/800/1000',
        'https://picsum.photos/seed/highway-cognac-3/800/1000',
      ],
      'Graphite': [
        'https://picsum.photos/seed/highway-graphite-1/800/1000',
        'https://picsum.photos/seed/highway-graphite-2/800/1000',
        'https://picsum.photos/seed/highway-graphite-3/800/1000',
      ],
    },
    colors: [
      { name: 'Burnished', hex: '#4A2C17' },
      { name: 'Jet', hex: '#151515' },
      { name: 'Cognac', hex: '#6B3A1F' },
      { name: 'Graphite', hex: '#3A3A3A' },
    ],
    sizes: ['90', '95', '100', '105', '110'],
    amazonUrl: 'https://amazon.com/kingbelt-highway-king',
    whatsappMessage: 'Hola, estoy interesado en el modelo Highway King de KingBelt.',
    materials: ['Piel de vacuno selección premium', 'Hebilla de latón macizo fundido', 'Tratamiento de cera de abeja'],
    features: [
      'Hebilla de latón con acabado envejecido',
      'Costuras selladas a calor',
      'Garantía de por vida',
      'Ancho: 4cm',
    ],
    badge: 'bestseller',
  },
  {
    id: 'kb-007',
    slug: 'steel-rebel',
    name: 'Steel Rebel',
    description:
      'Para quienes rechazan las reglas pero respetan la calidad. El Steel Rebel integra una cadena de acero entretejida en la puntera como detalle distintivo, mientras mantiene la funcionalidad impecable de un cinturón de alto rendimiento.',
    shortDescription: 'Detalle cadena. Actitud sin sacrificar calidad.',
    images: [
      'https://picsum.photos/seed/kingbelt-steel-1/800/1000',
      'https://picsum.photos/seed/kingbelt-steel-2/800/1000',
    ],
    colorImages: {
      'Gunmetal': [
        'https://picsum.photos/seed/steel-gunmetal-1/800/1000',
        'https://picsum.photos/seed/steel-gunmetal-2/800/1000',
      ],
      'Obsidian': [
        'https://picsum.photos/seed/steel-obsidian-1/800/1000',
        'https://picsum.photos/seed/steel-obsidian-2/800/1000',
      ],
      'Saddle': [
        'https://picsum.photos/seed/steel-saddle-1/800/1000',
        'https://picsum.photos/seed/steel-saddle-2/800/1000',
      ],
      'Cognac': [
        'https://picsum.photos/seed/steel-cognac-1/800/1000',
        'https://picsum.photos/seed/steel-cognac-2/800/1000',
      ],
    },
    colors: [
      { name: 'Gunmetal', hex: '#2A2A2A' },
      { name: 'Obsidian', hex: '#0A0A0A' },
      { name: 'Saddle', hex: '#8B5A2B' },
      { name: 'Cognac', hex: '#6B3A1F' },
    ],
    sizes: ['85', '90', '95', '100', '105', '110'],
    amazonUrl: 'https://amazon.com/kingbelt-steel-rebel',
    whatsappMessage: 'Hola, estoy interesado en el modelo Steel Rebel de KingBelt.',
    materials: ['Piel de caballo full-grain', 'Cadena de acero inoxidable 304', 'Hebilla de seguridad de doble prong'],
    features: [
      'Detalle de cadena decorativa funcional',
      'Doble prong para máxima sujeción',
      'Acabado distressed intencional',
      'Ancho: 4cm',
    ],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(currentSlug: string, limit = 3): Product[] {
  return products.filter((p) => p.slug !== currentSlug).slice(0, limit);
}
