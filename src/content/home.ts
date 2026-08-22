import { confirmed, businessFacts, FREE_SHIPPING_LABEL } from '@config/business';

const madeInSpain = confirmed(businessFacts.madeInSpain);

export const hero = {
  brand: 'KingBelt',
  badge: 'Producto Nacional',
  subtitleLines: [
    { text: 'Cinturones de cuero ', variant: 'plain' as const },
    { text: 'con criterio.', variant: 'em' as const },
  ],
  signals: [
    { label: FREE_SHIPPING_LABEL, href: '/envios-y-devoluciones' },
    { label: 'Fabricación artesanal', href: '/sobre' },
    { label: madeInSpain ? `Hecho en ${madeInSpain}` : 'Hecho en España', href: '/sobre' },
  ] as const,
  index: '01',
  primaryCta: { label: 'Ver colección', href: '/productos' },
  secondaryCta: { label: 'Sobre KingBelt', href: '/sobre' },
} as const;

export const brandStatement = {
  index: '03',
  eyebrow: 'Sobre KingBelt',
  meta: 'Marca · Producto',
  title: 'Accesorios masculinos con criterio, <em>no con etiqueta.</em>',
  lede: 'Una marca que empieza por el producto y avanza con criterio, no con ruido de escaparate.',
  panel: {
    eyebrow: 'Posicionamiento',
    statement: 'Lo que debe notarse en la pieza, no solo en el escaparate.',
  },
  body: 'Piezas con carácter para el día a día: proporción contenida, materiales con presencia y un acabado que se nota al usarlas.',
  kicker: 'Criterio',
  quote: 'Criterio de producto antes que discurso de escaparate.',
  highlights: [
    {
      label: 'Catálogo',
      text: 'Selección reducida: cada referencia tiene que merecer su sitio.',
    },
    {
      label: 'Taller',
      text: 'Fabricación artesanal con control de proporción, cierre y acabado.',
    },
    {
      label: 'Origen',
      text: madeInSpain ? `Hecho en ${madeInSpain}.` : 'Hecho en España.',
    },
  ] as const,
  signals: [
    {
      number: '01',
      label: 'Curaduría',
      meta: 'Selección',
      text: 'Catálogo reducido: cada referencia tiene que merecer su sitio.',
    },
    {
      number: '02',
      label: 'Proporción',
      meta: 'Integración',
      text: 'Presencia contenida que completa el conjunto sin dominarlo.',
    },
    {
      number: '03',
      label: 'Criterio',
      meta: 'Material / Uso',
      text: 'Piezas seleccionadas con atención al material, al ajuste y al uso real.',
    },
  ] as const,
  shortcuts: [
    { label: 'Historia de la marca', href: '/sobre' },
    { label: 'Ver colección', href: '/productos' },
    { label: 'Cuidado del cuero', href: '/cuidados' },
  ] as const,
  image: '/images/imagen-cinturon-kingbelt-6.avif',
  imageAlt: 'Manos ensamblando un cinturón de cuero marrón KingBelt con hebilla y remaches',
  imagePosition: 'center 42%',
  imageLabel: 'Material',
  imageCaption: 'Presencia contenida, sin teatralidad.',
  cta: { label: 'Conocer la marca', href: '/sobre' },
} as const;

export const categoriesSection = {
  enabled: false,
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
  cta: { label: 'Ver colección', href: '/productos' },
} as const;

export const standardsSection = {
  index: '04',
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
  image: '/images/imagen-cinturon-kingbelt-7.avif',
  imageAlt: 'Corte de cuero coñac con cuchilla y regla en el taller KingBelt',
  imageLabel: 'Detalle / cierre',
  imageCaption: 'Proporción, material y cierre en una sola pieza.',
} as const;

export const styleBanner = {
  eyebrow: 'En conjunto',
  title: 'El cinturón completa el look, no lo anuncia.',
  body: 'Proporción entre pantalón, calzado y cinturón. Presencia contenida para el armario masculino actual.',
  image: '/images/imagen-cinturon-kingbelt-16.avif',
  imageAlt: 'Cinturones de cuero marrón y negro KingBelt sobre piedra natural',
  imagePosition: 'center 38%',
} as const;

export const journalSection = {
  index: '05',
  eyebrow: 'Revista KingBelt',
  title: 'Lecturas que <em>acompañan</em> la compra.',
  body: 'Guías sobre medida, materiales y estilo. Contenido real para decidir con más contexto.',
  meta: '1 destacado · 4 lecturas',
  cta: { label: 'Ir a la revista', href: '/blog' },
} as const;

export const trustSection = {
  index: '06',
  eyebrow: 'Antes de elegir',
  title: 'Menos dudas, <em>más claridad.</em>',
  body: 'Todo lo que necesitas para elegir con criterio, antes de añadir al carrito.',
  meta: 'Atención · 3 puntos',
  cta: { label: 'Ir a contacto', href: '/contacto' },
  shortcuts: [
    { label: 'Guía de tallas', href: '/guia-de-tallas' },
    { label: 'Centro de ayuda', href: '/ayuda' },
  ],
  items: [
    {
      number: '01',
      title: 'Ayuda para elegir',
      text: 'Consulta la guía de tallas, el centro de ayuda o escríbenos antes de decidir.',
      meta: 'Guías',
      href: '/guia-de-tallas',
      linkLabel: 'Ver guía',
    },
    {
      number: '02',
      title: 'Información de producto',
      text: 'Material, color, categoría y precio visibles en cada referencia. Sin letra pequeña inventada.',
      meta: 'Ficha',
      href: '/productos',
      linkLabel: 'Ver colección',
    },
    {
      number: '03',
      title: 'Atención directa',
      text: 'Escríbenos con tu duda concreta por email o Instagram.',
      meta: 'Contacto',
      href: '/contacto',
      linkLabel: 'Contactar',
    },
  ],
} as const;

export const closingCta = {
  index: '07',
  eyebrow: 'KingBelt',
  title: 'Descubre la colección <em>o conoce la marca.</em>',
  description:
    'Revisa la selección o escríbenos si necesitas orientación antes de elegir.',
  primary: { label: 'Ver colección', href: '/productos' },
  secondary: { label: 'Contactar', href: '/contacto' },
  backgroundImage: '/images/imagen-cinturon-kingbelt-9.avif',
  backgroundAlt: '',
  backgroundPosition: 'center 60%',
} as const;
