import type { FAQItem } from '../components/common/faq/types';
import type { IconName } from '../components/ui/icon-paths';

export interface HelpNavItem {
  label: string;
  href: string;
  description: string;
  priority: 'primary' | 'secondary';
  icon?: IconName;
}

export const helpNavItems: HelpNavItem[] = [
  {
    label: 'Guía de tallas',
    href: '/guia-de-tallas',
    description: 'Cómo medir antes de elegir y qué información consultar por modelo.',
    priority: 'primary',
    icon: 'ruler',
  },
  {
    label: 'Envíos y devoluciones',
    href: '/envios-y-devoluciones',
    description: 'Políticas de envío, cambios y devoluciones cuando estén confirmadas.',
    priority: 'primary',
    icon: 'truck',
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

export const helpFooterNav = [
  { label: 'Centro de ayuda', href: '/ayuda' },
  { label: 'Guía de tallas', href: '/guia-de-tallas' },
  { label: 'Cuidados', href: '/cuidados' },
  { label: 'Envíos y devoluciones', href: '/envios-y-devoluciones' },
  { label: 'Contacto', href: '/contacto' },
] as const;

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

export const helpMeta = {
  ayuda: {
    title: 'Centro de ayuda — KingBelt',
    description:
      'Guías de tallas, cuidados, envíos y respuestas a dudas habituales sobre producto y atención en KingBelt.',
  },
  sizeGuide: {
    title: 'Guía de tallas — KingBelt',
    description:
      'Cómo medir antes de elegir cinturón: métodos, equivalencias por modelo y preguntas frecuentes sobre tallaje.',
  },
  care: {
    title: 'Cuidados del cuero — KingBelt',
    description:
      'Recomendaciones generales para conservar cinturones de cuero y herrajes. Instrucciones específicas por producto cuando estén disponibles.',
  },
  shipping: {
    title: 'Envíos y devoluciones — KingBelt',
    description:
      'Información sobre envíos, cambios y devoluciones. Documento pendiente de validación por la empresa.',
  },
} as const;
