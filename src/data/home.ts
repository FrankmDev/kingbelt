export const hero = {
  badge: 'Hecho en España',
  meta: 'Cuero · Herraje · Proporción',
  titleLines: [
    { text: 'Cinturones', variant: 'plain' as const },
    { text: 'de cuero', variant: 'light' as const },
    { text: 'con criterio.', variant: 'em' as const },
  ],
  description:
    'Piezas masculinas producidas en España para el uso diario. Proporción clara, materiales con cuerpo y un acabado que se nota al abrochar.',
  collection: {
    eyebrow: 'Colección',
    meta: '3 líneas',
  },
  index: '01',
  primaryCta: { label: 'Ver colección', href: '#coleccion' },
  secondaryCta: { label: 'Sobre KingBelt', href: '/sobre' },
} as const;

export const brandStatement = {
  index: '02',
  eyebrow: 'Sobre KingBelt',
  meta: 'Marca · España',
  lede: 'Una marca que empieza por el producto y avanza con criterio, no con ruido de escaparate.',
  title: 'Accesorios masculinos con criterio, <em>no con etiqueta.</em>',
  titleLines: [
    { text: 'Accesorios masculinos', variant: 'plain' as const },
    { text: 'con criterio,', variant: 'plain' as const },
    { text: 'no con etiqueta.', variant: 'em' as const },
  ],
  quote: {
    eyebrow: 'Origen',
    ref: 'España · Producción local',
    lines: [
      { text: 'Hecho en España.', variant: 'plain' as const },
      { text: 'Cuero y herraje con criterio, no con etiqueta.', variant: 'em' as const },
    ],
    proofs: ['Producción nacional', 'Materiales con cuerpo', 'Acabado verificable'] as const,
    note: 'Origen claro. Calidad que se nota al usarlo.',
  },
  paragraphs: [
    'KingBelt selecciona piezas con carácter pensadas para integrarse en el día a día: proporción contenida, materiales con presencia y un acabado que no pide protagonismo en exceso.',
    'No seguimos tendencias por inercia. Buscamos objetos que mantengan sentido más allá de una estética pasajera y que funcionen igual en la ciudad que en la carretera.',
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
      label: 'Origen',
      text: 'Piezas pensadas y producidas en España, con trazabilidad clara.',
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
  eyebrow: 'Colección',
  title: 'Tres líneas, <em>un mismo criterio.</em>',
  body: 'Entrada al catálogo por uso y estilo. Cada categoría agrupa piezas con la misma lógica de proporción y acabado.',
  meta: '3 categorías',
} as const;

export const featuredSection = {
  eyebrow: 'Selección',
  title: 'Piezas para empezar <em>a mirar.</em>',
  body: 'Una muestra de la colección KingBelt. Imagen, nombre, color y precio — sin ruido comercial de más.',
  meta: '4 referencias',
  cta: { label: 'Ver colección', href: '#coleccion' },
} as const;

export const standardsSection = {
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
  image: '/image.jpg',
  imageAlt: 'Conjunto masculino con cinturón de cuero, pantalón y calzado',
  imagePosition: 'center 38%',
} as const;

export const journalSection = {
  eyebrow: 'Revista KingBelt',
  title: 'Lecturas que <em>acompañan</em> la compra.',
  body: 'Guías sobre medida, materiales y estilo. Contenido real para decidir con más contexto.',
  cta: { label: 'Ir a la revista', href: '/blog' },
} as const;

export const trustSection = {
  eyebrow: 'Antes de elegir',
  title: 'Menos dudas, <em>más claridad.</em>',
  items: [
    {
      title: 'Ayuda para elegir',
      text: 'Consulta medida, ancho y combinación desde Contacto o Instagram antes de decidir.',
    },
    {
      title: 'Información de producto',
      text: 'Material, color, categoría y precio visibles en cada referencia. Sin letra pequeña inventada.',
    },
    {
      title: 'Atención directa',
      text: 'Escríbenos con tu duda concreta. Respondemos por email o Instagram, sin formularios intermedios innecesarios.',
    },
  ],
} as const;

export const closingCta = {
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
