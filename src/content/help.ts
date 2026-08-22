import { legalDocuments, type DocumentStatus } from './legal';
import type { FAQItem } from './faq';
import type { IconName } from '../components/ui/icon-paths';

interface HelpNavItem {
  label: string;
  href: string;
  description: string;
  priority: 'primary' | 'secondary';
  icon?: IconName;
}

const isPublishedStatus = (status: DocumentStatus): boolean => status === 'published';

const isPublishedLegalHref = (href: string): boolean => {
  const document = Object.values(legalDocuments).find((item) => item.href === href);
  return !document || isPublishedStatus(document.status);
};

const allHelpNavItems: HelpNavItem[] = [
  {
    label: 'Guía de tallas',
    href: '/guia-de-tallas',
    description: 'Cómo medir antes de elegir y qué información consultar por modelo.',
    priority: 'primary',
    icon: 'ruler',
  },
  {
    label: 'Envíos',
    href: '/envios-y-devoluciones',
    description: 'Plazos, seguimiento e incidencias de los pedidos.',
    priority: 'primary',
    icon: 'truck',
  },
  {
    label: 'Devoluciones',
    href: '/devoluciones',
    description: 'Plazo de 30 días, desistimiento, gastos de devolución y reembolsos.',
    priority: 'secondary',
    icon: 'rotate-ccw',
  },
  {
    label: 'Cuidados',
    href: '/cuidados',
    description: 'Recomendaciones generales para conservar cuero y herrajes.',
    priority: 'secondary',
    icon: 'shield-check',
  },
  {
    label: 'Preguntas frecuentes',
    href: '/contacto#preguntas-frecuentes',
    description: 'Respuestas a dudas habituales sobre producto y atención.',
    priority: 'secondary',
    icon: 'search',
  },
  {
    label: 'Contacto',
    href: '/contacto',
    description: 'Escríbenos con tu consulta concreta.',
    priority: 'secondary',
    icon: 'mail',
  },
];

export const helpNavItems = allHelpNavItems.filter((item) => isPublishedLegalHref(item.href));

export const helpFooterNav = [
  { label: 'Centro de ayuda', href: '/ayuda' },
  { label: 'Guía de tallas', href: '/guia-de-tallas' },
  { label: 'Cuidados', href: '/cuidados' },
  { label: 'Envíos', href: '/envios-y-devoluciones' },
  { label: 'Devoluciones', href: '/devoluciones' },
  { label: 'Contacto', href: '/contacto' },
].filter((item) => isPublishedLegalHref(item.href));

export const sizeGuideMethods = [
  {
    id: 'belt',
    title: 'Medir un cinturón que ya utilizas',
    steps: [
      'Extiende el cinturón sobre una superficie plana, con la hebilla desabrochada.',
      'Identifica el agujero que utilizas habitualmente.',
      'Mide la distancia desde el extremo interior de la hebilla hasta el centro de ese agujero.',
      'Anota la medida en centímetros. La equivalencia con la talla KingBelt dependerá del modelo.',
    ],
  },
  {
    id: 'body',
    title: 'Medir la zona donde llevarás el cinturón',
    steps: [
      'Coloca una cinta métrica flexible sobre la cintura o la cadera, según cómo lleves el pantalón.',
      'La medida debe quedar cómoda, sin apretar ni dejar holgura excesiva.',
      'Toma la lectura en centímetros y repite una segunda vez para verificar.',
      'Consulta la ficha del modelo: el punto de referencia puede variar entre piezas.',
    ],
  },
] as const;

export const sizeGuideMistakes = [
  {
    title: 'Medir con el cinturón puesto',
    text: 'La curvatura del cuerpo altera la lectura. Siempre mide con el cinturón extendido o con cinta métrica plana.',
  },
  {
    title: 'Confundir cintura con talla de pantalón',
    text: 'La talla de pantalón no siempre coincide con la medida del cinturón. Cada marca y cada modelo pueden variar.',
  },
  {
    title: 'No verificar el modelo',
    text: 'No todos los modelos comparten el mismo sistema de tallaje. Revisa la ficha del producto antes de decidir.',
  },
  {
    title: 'Redondear sin criterio',
    text: 'Si la medida queda entre dos tallas, consulta antes de comprar. La recomendación puede depender del modelo y del ajuste deseado.',
  },
] as const;

export const sizeGuideFaqs: FAQItem[] = [
  {
    question: '¿Qué hago si mi medida queda entre dos tallas?',
    answer:
      'Depende del modelo y del ajuste que busques. Consulta la ficha del producto o escríbenos con la medida exacta y el modelo que te interesa antes de comprar.',
    category: 'Tallaje',
    icon: 'ruler',
  },
  {
    question: '¿Todos los modelos comparten el mismo tallaje?',
    answer:
      'No necesariamente. Cada referencia puede tener su propia tabla de equivalencias. Revisa la guía de tallas del modelo concreto cuando esté disponible.',
    category: 'Tallaje',
    icon: 'search',
  },
  {
    question: '¿Cómo puedo pedir ayuda para elegir talla?',
    answer:
      'Escríbenos por email o Instagram con el modelo que te interesa, tu medida en centímetros y, si puedes, una foto del cinturón que usas actualmente con la medida indicada.',
    category: 'Atención',
    icon: 'mail',
  },
  {
    question: '¿Qué información debo enviar al consultar?',
    answer:
      'Indica el modelo o la referencia, tu medida en centímetros, el método que has utilizado (cinturón existente o medida corporal) y cualquier preferencia de ajuste.',
    category: 'Atención',
    icon: 'paper-plane',
  },
];

export const careSections = [
  {
    id: 'limpieza',
    title: 'Limpieza habitual',
    content:
      'Retira el polvo y la suciedad superficial con un paño suave y seco. Evita frotar con fuerza sobre costuras o zonas de desgaste. Las instrucciones específicas por material se publicarán en cada ficha de producto cuando estén confirmadas.',
  },
  {
    id: 'humedad',
    title: 'Humedad',
    content:
      'El contacto prolongado con agua puede afectar al cuero y a los herrajes. Si la pieza se moja, sécalo con un paño absorbente sin aplicar calor directo. La resistencia al agua depende del material y del tratamiento de cada modelo.',
  },
  {
    id: 'secado',
    title: 'Secado',
    content:
      'Deja secar la pieza a temperatura ambiente, lejos de radiadores, secadores o luz solar directa. El calor intenso puede endurecer o deformar el cuero.',
  },
  {
    id: 'almacenamiento',
    title: 'Almacenamiento',
    content:
      'Guarda el cinturón enrollado o colgado de forma que no quede doblado en ángulos pronunciados. Un lugar seco y con ventilación suficiente ayuda a conservar la forma.',
  },
  {
    id: 'herrajes',
    title: 'Hebillas y herrajes',
    content:
      'Revisa periódicamente que los remaches y el mecanismo de cierre funcionen con suavidad. Si detectas oxidación o holgura, consulta antes de aplicar productos que no estén indicados para el material.',
  },
  {
    id: 'desgaste',
    title: 'Señales de desgaste',
    content:
      'El cuero adquiere pátina con el uso: cambios de tono, marcas suaves y flexión en la zona del agujero central son habituales. Grietas profundas, roturas en costuras o deformación estructural indican que conviene valorar reparación o sustitución.',
  },
  {
    id: 'evitar',
    title: 'Prácticas que deben evitarse',
    content:
      'No utilices disolventes, lejía, colonia ni productos agresivos sin confirmación para el material concreto. Evita dejar la pieza en el coche, cerca de fuentes de calor o expuesta de forma continuada a la humedad.',
  },
  {
    id: 'consulta',
    title: 'Cuándo consultar a KingBelt',
    content:
      'Si tienes dudas sobre el cuidado de un modelo concreto, el estado de la pieza o si un producto necesita atención, escríbenos con la referencia y una descripción del problema.',
  },
] as const;

export const helpHub = {
  hero: {
    eyebrow: 'Ayuda',
    title: 'Todo para comprar con <em>claridad</em>.',
    description:
      'Información útil antes y después de comprar: tallaje, cuidados, envíos y atención cuando la necesites.',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Detalle de cinturón de cuero marrón oscuro',
    imagePosition: 'center 48%',
    meta: 'KingBelt · Ayuda',
  },
  primary: {
    index: '01',
    eyebrow: 'Accesos principales',
    meta: 'Empieza aquí',
    title: 'Lo esencial antes y después de comprar.',
    body: 'Guía de tallas y políticas de envío: los dos puntos que más consultan antes de decidir.',
  },
  resources: {
    index: '02',
    eyebrow: 'También puede interesarte',
    meta: 'Otros recursos',
    title: 'Más información útil.',
    body: 'Cuidados del cuero, preguntas frecuentes y contacto directo.',
  },
  guide: {
    index: '03',
    eyebrow: 'Qué encontrarás',
    meta: 'Centro de ayuda',
    title: 'Información operativa, sin rodeos.',
    body:
      'Esta sección reúne lo que necesitas para elegir bien, conservar las piezas y resolver dudas habituales.',
    image: {
      src: '/images/blog/cinturon-negro.jpg',
      alt: 'Cinturón negro de vestir sobre fondo neutro',
      label: 'Producto',
      caption: 'Material, ajuste y atención en un solo lugar.',
    },
    phases: [
      {
        label: 'Antes de comprar',
        title: 'Medir y elegir con criterio',
        text:
          'Consulta la guía de tallas y las fichas de producto. La equivalencia depende del modelo y del punto de medición.',
      },
      {
        label: 'Después de comprar',
        title: 'Envíos, cambios y atención',
        text:
          'Consulta plazos, seguimiento e incidencias en la política de envíos. Las devoluciones y el desistimiento están en su propia página.',
      },
    ],
  },
  cta: {
    eyebrow: '¿Necesitas más ayuda?',
    title: 'Escríbenos con tu consulta',
    description:
      'Cuanto más concreto sea el contexto — modelo, medida o duda — más fácil será orientar la respuesta.',
    buttonLabel: 'Ir a contacto',
    buttonHref: '/contacto',
    image: '/images/blog/cinturon-marron.jpg',
    imagePosition: 'center 40%',
  },
} as const;

export const sizeGuidePage = {
  hero: {
    eyebrow: 'Ayuda',
    title: 'Mide antes de <em>elegir</em>.',
    description:
      'Un cinturón debe ajustarse con comodidad en el agujero central. La equivalencia final depende del modelo.',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro de vestir sobre fondo neutro',
    imagePosition: 'center 58%',
    meta: 'KingBelt · Guía de tallas',
  },
  intro: {
    index: '01',
    eyebrow: 'Antes de comprar',
    meta: 'Criterio',
    title: 'Por qué medir reduce errores.',
    body:
      'La talla correcta depende del modelo, del ancho y del punto de referencia de cada referencia. Toma la medida y contrástala con la ficha del producto.',
    image: {
      src: '/images/brand/cinturones-en-taller.jpg',
      alt: 'Persona sujetando varios cinturones de cuero en un taller',
      label: 'Ajuste',
      caption: 'El agujero central debe quedar cómodo, con margen a ambos extremos.',
    },
  },
  methods: {
    index: '02',
    eyebrow: 'Métodos',
    meta: 'Dos lecturas',
    title: 'Dos formas de tomar la medida.',
    body: 'Utiliza el método que te resulte más fiable. En ambos casos, verifica el resultado con la ficha del modelo.',
  },
  diagram: {
    index: '03',
    eyebrow: 'Referencia',
    meta: 'Conceptual',
    title: 'De la hebilla al agujero que usas.',
    body:
      'El diagrama muestra el recorrido de la medida. No sustituye las equivalencias del modelo concreto.',
  },
  table: {
    index: '04',
    eyebrow: 'Equivalencias',
    meta: 'Por modelo',
    title: 'Tabla de tallas.',
    body: 'Las medidas definitivas se publicarán por referencia cuando estén confirmadas.',
  },
  mistakes: {
    index: '05',
    eyebrow: 'Errores habituales',
    meta: 'Evitar',
    title: 'Lecturas que suelen fallar.',
    body: 'La curvatura del cuerpo, la talla de pantalón o redondear sin criterio alteran el resultado.',
  },
  faq: {
    index: '06',
    eyebrow: 'Preguntas frecuentes',
    meta: 'Tallaje',
    title: 'Dudas sobre la medida.',
    body: 'Si tu caso queda entre dos tallas o el modelo no comparte sistema, escríbenos con la medida exacta.',
  },
} as const;

export const carePage = {
  hero: {
    eyebrow: 'Ayuda',
    title: 'Conservar el cuero, <em>sin recetas genéricas</em>.',
    description:
      'Recomendaciones generales para cinturones y herrajes. Las instrucciones específicas se publicarán por producto.',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón de cuero marrón sobre fondo neutro',
    imagePosition: 'center 42%',
    meta: 'KingBelt · Cuidados',
  },
  intro: {
    index: '01',
    eyebrow: 'Alcance',
    meta: 'General',
    title: 'Una guía, no una ficha de material.',
    body:
      'La composición, el curtido, los tratamientos y la durabilidad concreta de cada pieza se indicarán en su ficha cuando estén confirmados.',
    image: {
      src: '/images/blog/cinturon-marron-oscuro.jpg',
      alt: 'Detalle de cinturón de cuero marrón oscuro',
      label: 'Material',
      caption: 'Aplica solo lo confirmado para el modelo que tienes.',
    },
    note: {
      label: 'Instrucciones por producto',
      text:
        'Cuando un modelo requiera cuidados específicos —productos compatibles, impermeabilidad o reparación—, la información aparecerá en su ficha. Hasta entonces, aplica solo las recomendaciones generales de esta guía.',
    },
  },
  chapters: [
    {
      id: 'diario',
      index: '02',
      eyebrow: 'Uso diario',
      meta: 'Conservación',
      title: 'Hábitos que alargan la pieza.',
      body: 'Limpieza, humedad, secado y almacenamiento: lo que más influye en el día a día.',
      tone: 'light',
      itemIds: ['limpieza', 'humedad', 'secado', 'almacenamiento'],
    },
    {
      id: 'material',
      index: '03',
      eyebrow: 'Material y herrajes',
      meta: 'Revisión',
      title: 'Qué vigilar con el tiempo.',
      body: 'Hebillas, pátina, prácticas a evitar y cuándo conviene consultar.',
      tone: 'dark',
      itemIds: ['herrajes', 'desgaste', 'evitar', 'consulta'],
    },
  ],
} as const;

export const shippingPage = {
  hero: {
    eyebrow: 'Ayuda',
    title: 'Preparación, transporte y <em>entrega</em>.',
    description:
      'Condiciones de envío, plazos, seguimiento e incidencias de los pedidos KingBelt.',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Persona sujetando varios cinturones de cuero en un taller',
    imagePosition: 'center 48%',
    meta: 'KingBelt · Envíos',
  },
  section: {
    index: '01',
    eyebrow: 'Documento',
    meta: 'Vigente',
    title: 'Cómo llega el pedido.',
    body: 'Zonas, gastos, plazos, seguimiento y qué ocurre si hay una incidencia en el transporte.',
  },
} as const;

export const helpMeta = {
  ayuda: {
    title: 'Centro de ayuda — KingBelt',
    description:
      'Guías de tallas, cuidados, envíos y respuestas a dudas habituales sobre producto y atención en KingBelt.',
    indexable: true,
  },
  sizeGuide: {
    path: '/guia-de-tallas',
    title: 'Guía de tallas — KingBelt',
    description:
      'Cómo medir antes de elegir cinturón: métodos, equivalencias por modelo y preguntas frecuentes sobre tallaje.',
    indexable: false,
  },
  care: {
    title: 'Cuidados del cuero — KingBelt',
    description:
      'Recomendaciones generales para conservar cinturones de cuero y herrajes. Instrucciones específicas por producto cuando estén disponibles.',
    indexable: true,
  },
  shipping: {
    title: 'Política de envíos — KingBelt',
    description:
      'Preparación, expedición, plazos, seguimiento e incidencias de los pedidos realizados en KingBelt.',
    indexable: true,
  },
} as const;

export const getHelpRobots = (
  meta: { indexable: boolean }
): 'noindex,follow' | undefined => (meta.indexable ? undefined : 'noindex,follow');

export const getHelpSitemapExcludedPaths = (): string[] =>
  Object.values(helpMeta)
    .filter((entry): entry is typeof entry & { path: string } =>
      'path' in entry && !entry.indexable)
    .map((entry) => entry.path);
