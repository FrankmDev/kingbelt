import { confirmed, businessFacts } from '@config/business';

const madeInSpain = confirmed(businessFacts.madeInSpain);

export const hero = {
  brand: 'KingBelt',
  badge: madeInSpain ? `Hecho a mano en ${madeInSpain}` : 'Hecho a mano en España',
  subtitleLines: [
    { text: 'Cinturones de cuero ', variant: 'plain' as const },
    { text: 'con criterio.', variant: 'em' as const },
  ],
  signals: [
    { label: 'Selección curada', href: '#coleccion' },
    { label: 'Guía de tallas', href: '/guia-de-tallas' },
    { label: 'Atención directa', href: '/contacto' },
  ] as const,
  index: '01',
  primaryCta: { label: 'Ver colección', href: '#coleccion' },
  secondaryCta: { label: 'Sobre KingBelt', href: '/sobre' },
} as const;

export const brandStatement = {
  index: '04',
  eyebrow: 'Sobre KingBelt',
  meta: 'Marca · Producto',
  lede: 'Una marca que empieza por el producto y avanza con criterio, no con ruido de escaparate.',
  title: 'Accesorios masculinos con criterio, <em>no con etiqueta.</em>',
  titleLines: [
    { text: 'Accesorios masculinos con criterio,', variant: 'plain' as const },
    { text: 'no con etiqueta.', variant: 'em' as const },
  ],
  quote: {
    eyebrow: 'Criterio',
    text: 'Cuero y herraje con criterio, no con etiqueta.',
  },
  paragraphs: [
    'Piezas con carácter para el día a día: proporción contenida, materiales con presencia y un acabado que se nota al usarlas.',
  ],
  signals: [
    {
      number: '01',
      label: 'Curaduría',
      text: 'Catálogo reducido: cada referencia tiene que merecer su sitio.',
    },
    {
      number: '02',
      label: 'Proporción',
      text: 'Presencia contenida que completa el conjunto sin dominarlo.',
    },
    {
      number: '03',
      label: 'Criterio',
      text: 'Piezas seleccionadas con atención al material, al ajuste y al uso real.',
    },
  ] as const,
  tags: ['Cuero', 'Proporción', 'Uso diario'] as const,
  image: '/images/blog/cinturon-marron.jpg',
  imageAlt: 'Detalle de cinturón de cuero marrón con hebilla metálica',
  imagePosition: 'center 42%',
  imageLabel: 'Material',
  imageCaption: 'Presencia contenida, sin teatralidad.',
  cta: { label: 'Conocer la marca', href: '/sobre' },
} as const;

export const categoriesSection = {
  index: '03',
  eyebrow: 'Colección',
  title: 'Líneas distintas, <em>un mismo criterio.</em>',
  body: 'Entrada al catálogo por uso y estilo. Cada categoría agrupa piezas con la misma lógica de proporción y acabado.',
  meta: 'Catálogo por categorías',
} as const;

export const featuredSection = {
  index: '02',
  eyebrow: 'Destacados',
  title: 'Una selección <em>con criterio.</em>',
  body: 'Referencias destacadas de la colección. Imagen, categoría, descripción breve y precio — sin ruido comercial de más.',
  meta: 'Selección destacada',
  cta: { label: 'Ver colección', href: '#coleccion' },
} as const;

export const standardsSection = {
  index: '05',
  eyebrow: 'Qué recibes',
  title: 'Tres cosas que buscamos <em>en cada pieza.</em>',
  lede: 'No es filosofía de marca: es lo que debe notarse cuando abrochas el cinturón y lo usas una semana.',
  meta: 'Integración / Material / Utilidad',
  panel: {
    eyebrow: 'Criterio de producto',
    statement: 'Lo que debe notarse al usar la pieza, no solo al verla en pantalla.',
  },
  principles: [
    {
      number: '01',
      label: 'Integración',
      meta: 'Proporción',
      text: 'Silueta y escala que encajan con pantalón y calzado sin dominar el conjunto.',
    },
    {
      number: '02',
      label: 'Material',
      meta: 'Presencia',
      text: 'Cuero con cuerpo y herrajes con peso real — se nota al cogerlo y al abrocharlo.',
    },
    {
      number: '03',
      label: 'Utilidad',
      meta: 'Uso diario',
      text: 'Pensado para el uso diario: ajuste cómodo, agujeros bien rematados y curva que no se deforma a la primera.',
    },
  ],
  image: '/images/blog/cinturon-marron-oscuro.jpg',
  imageAlt: 'Detalle de cinturón de cuero con hebilla metálica',
  imageLabel: 'Detalle / cierre',
  imageCaption: 'Proporción, material y cierre en una sola pieza.',
} as const;

export const styleBanner = {
  eyebrow: 'En conjunto',
  title: 'El cinturón completa el look, no lo anuncia.',
  body: 'Proporción entre pantalón, calzado y cinturón. Presencia contenida para el armario masculino actual.',
  image: '/images/brand/cinturones-en-taller.jpg',
  imageAlt: 'Conjunto masculino con cinturón de cuero, pantalón y calzado',
  imagePosition: 'center 38%',
} as const;

export const journalSection = {
  index: '06',
  eyebrow: 'Revista KingBelt',
  title: 'Lecturas que <em>acompañan</em> la compra.',
  body: 'Guías sobre medida, materiales y estilo. Contenido real para decidir con más contexto.',
  meta: '3 lecturas de referencia',
  cta: { label: 'Ir a la revista', href: '/blog' },
} as const;

export const trustSection = {
  index: '07',
  eyebrow: 'Antes de elegir',
  title: 'Menos dudas, <em>más claridad.</em>',
  items: [
    {
      title: 'Ayuda para elegir',
      text: 'Consulta la guía de tallas, el centro de ayuda o escríbenos antes de decidir.',
    },
    {
      title: 'Información de producto',
      text: 'Material, color, categoría y precio visibles en cada referencia. Sin letra pequeña inventada.',
    },
    {
      title: 'Atención directa',
      text: 'Escríbenos con tu duda concreta por email o Instagram.',
    },
  ],
} as const;

export const closingCta = {
  index: '08',
  eyebrow: 'KingBelt',
  title: 'Descubre la colección <em>o conoce la marca.</em>',
  description:
    'Empieza por las categorías, revisa la selección o escríbenos si necesitas orientación antes de elegir.',
  primary: { label: 'Ver colección', href: '#coleccion' },
  secondary: { label: 'Contactar', href: '/contacto' },
  backgroundImage: '/images/blog/cinturon-negro.jpg',
  backgroundAlt: '',
  backgroundPosition: 'center 60%',
} as const;
