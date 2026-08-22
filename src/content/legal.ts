import { businessFacts, confirmed } from '@config/business';
import { flattenLegalBodySections, legalBodies } from './legal-bodies';

export { currentTechnologies, externalResources } from './legal-technologies';

export type DocumentStatus = 'draft' | 'inactive' | 'published';

interface LegalNavItem {
  label: string;
  href: string;
  status: DocumentStatus;
}

interface LegalSection {
  id: string;
  title: string;
}

export interface LegalDocument {
  slug: string;
  href: string;
  navLabel: string;
  title: string;
  description: string;
  status: DocumentStatus;
  updatedAt?: string;
  version?: string;
  sections: LegalSection[];
}

export const legalDocuments = {
  avisoLegal: {
    slug: 'aviso-legal',
    href: '/aviso-legal',
    navLabel: 'Aviso legal',
    title: 'Aviso legal — KingBelt',
    description:
      'Identificación del titular del sitio web KingBelt, condiciones de uso, propiedad intelectual y responsabilidad.',
    status: 'published',
    updatedAt: '18 de agosto de 2026',
    sections: [
      { id: 'informacion-general', title: 'Información general e identificación del titular' },
      { id: 'objeto', title: 'Objeto del sitio web' },
      { id: 'condiciones-acceso', title: 'Condiciones de acceso y utilización' },
      { id: 'propiedad-intelectual', title: 'Propiedad intelectual e industrial' },
      { id: 'marca', title: 'Marca y signos distintivos' },
      { id: 'contenidos', title: 'Contenidos e información del sitio web' },
      { id: 'disponibilidad', title: 'Disponibilidad del sitio web' },
      { id: 'seguridad', title: 'Seguridad' },
      { id: 'enlaces-terceros', title: 'Enlaces a sitios de terceros' },
      { id: 'enlaces-hacia', title: 'Enlaces hacia el sitio web de Kingbelt' },
      { id: 'responsabilidad-usuario', title: 'Responsabilidad del usuario' },
      { id: 'responsabilidad-kingbelt', title: 'Responsabilidad de Kingbelt' },
      { id: 'comercio-electronico', title: 'Comercio electrónico' },
      { id: 'proteccion-datos', title: 'Protección de datos personales' },
      { id: 'cookies', title: 'Cookies y tecnologías similares' },
      { id: 'proveedores', title: 'Proveedores tecnológicos' },
      { id: 'comunicaciones', title: 'Comunicaciones comerciales' },
      { id: 'modificacion', title: 'Modificación del Aviso Legal' },
      { id: 'legislacion', title: 'Legislación aplicable' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  privacidad: {
    slug: 'privacidad',
    href: '/privacidad',
    navLabel: 'Privacidad',
    title: 'Política de privacidad — KingBelt',
    description:
      'Cómo recopilamos, utilizamos y divulgamos tu información personal cuando visitas o compras en KingBelt.',
    status: 'published',
    updatedAt: '22 de agosto de 2026',
    sections: [
      { id: 'informacion-personal', title: 'Información personal que recopilamos o tratamos' },
      { id: 'fuentes', title: 'Fuentes de información personal' },
      { id: 'usos', title: 'Cómo utilizamos su información personal' },
      { id: 'divulgacion', title: 'Cómo divulgamos la información personal' },
      { id: 'shopify', title: 'Relación con Shopify' },
      { id: 'sitios-terceros', title: 'Sitios web y enlaces de terceros' },
      { id: 'menores', title: 'Datos de menores' },
      { id: 'seguridad-retencion', title: 'Seguridad y retención de su información' },
      { id: 'derechos', title: 'Sus derechos y opciones' },
      { id: 'reclamaciones', title: 'Reclamaciones' },
      { id: 'transferencias', title: 'Transferencias internacionales' },
      { id: 'cambios', title: 'Cambios en esta Política de privacidad' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  cookies: {
    slug: 'cookies',
    href: '/cookies',
    navLabel: 'Cookies',
    title: 'Política de cookies y tecnologías — KingBelt',
    description: 'Información sobre cookies y almacenamiento local utilizados en KingBelt.',
    status: 'published',
    updatedAt: '22 de agosto de 2026',
    sections: [
      { id: 'que-son', title: 'Qué son las cookies y el almacenamiento local' },
      { id: 'tecnologias-actuales', title: 'Tecnologías utilizadas actualmente' },
      { id: 'recursos-externos', title: 'Recursos externos' },
      { id: 'gestion', title: 'Cómo gestionar las preferencias' },
      { id: 'actualizacion', title: 'Actualización de esta política' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  condiciones: {
    slug: 'condiciones',
    href: '/condiciones',
    navLabel: 'Condiciones',
    title: 'Condiciones generales de compra — KingBelt',
    description: 'Condiciones contractuales de compra en KingBelt, junto con las políticas de envíos y devoluciones.',
    status: 'published',
    updatedAt: '22 de agosto de 2026',
    sections: [
      { id: 'identidad', title: 'Identidad del vendedor' },
      { id: 'objeto', title: 'Objeto y ámbito' },
      { id: 'productos', title: 'Productos' },
      { id: 'proceso-compra', title: 'Proceso de compra' },
      { id: 'correccion-errores', title: 'Corrección de errores' },
      { id: 'idioma', title: 'Idioma' },
      { id: 'archivo-contrato', title: 'Archivo del contrato' },
      { id: 'precios', title: 'Precios e impuestos' },
      { id: 'disponibilidad', title: 'Disponibilidad' },
      { id: 'pagos', title: 'Pagos' },
      { id: 'confirmacion', title: 'Confirmación del pedido' },
      { id: 'entrega', title: 'Entrega' },
      { id: 'envio', title: 'Envío' },
      { id: 'desistimiento', title: 'Derecho de desistimiento' },
      { id: 'devoluciones', title: 'Devoluciones' },
      { id: 'excepciones', title: 'Excepciones' },
      { id: 'conformidad', title: 'Conformidad y garantía' },
      { id: 'atencion', title: 'Atención al cliente' },
      { id: 'propiedad-intelectual', title: 'Propiedad intelectual' },
      { id: 'fuerza-mayor', title: 'Fuerza mayor' },
      { id: 'ley-aplicable', title: 'Ley aplicable' },
      { id: 'resolucion-conflictos', title: 'Resolución de conflictos' },
    ],
  },
  envios: {
    slug: 'envios-y-devoluciones',
    href: '/envios-y-devoluciones',
    navLabel: 'Envíos',
    title: 'Política de envíos — KingBelt',
    description:
      'Preparación, expedición, plazos, seguimiento e incidencias de los pedidos realizados en KingBelt.',
    status: 'published',
    updatedAt: '18 de agosto de 2026',
    sections: [
      { id: 'vendedor', title: 'Datos del vendedor' },
      { id: 'zonas', title: 'Zonas de envío' },
      { id: 'gastos', title: 'Gastos de envío' },
      { id: 'preparacion', title: 'Preparación y procesamiento de pedidos' },
      { id: 'plazos', title: 'Plazos de entrega' },
      { id: 'computo', title: 'Cómputo de los plazos' },
      { id: 'seguimiento', title: 'Seguimiento del pedido' },
      { id: 'direccion', title: 'Dirección de entrega' },
      { id: 'entrega', title: 'Entrega del pedido' },
      { id: 'ausencia', title: 'Ausencia del destinatario' },
      { id: 'retrasos', title: 'Retrasos en la entrega' },
      { id: 'perdido', title: 'Pedido perdido durante el transporte' },
      { id: 'danado', title: 'Pedido dañado durante el transporte' },
      { id: 'incorrecto', title: 'Producto incorrecto o pedido incompleto' },
      { id: 'riesgo', title: 'Transmisión del riesgo' },
      { id: 'divididos', title: 'Envíos divididos' },
      { id: 'aduanas', title: 'Aduanas, impuestos y territorios con régimen fiscal especial' },
      { id: 'modificaciones', title: 'Modificaciones y cancelaciones de pedidos' },
      { id: 'devoluciones', title: 'Devoluciones' },
      { id: 'fuerza-mayor', title: 'Fuerza mayor y circunstancias extraordinarias' },
      { id: 'relacion', title: 'Relación con las Condiciones Generales' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  devoluciones: {
    slug: 'devoluciones',
    href: '/devoluciones',
    navLabel: 'Devoluciones',
    title: 'Política de devoluciones, desistimiento y reembolsos — KingBelt',
    description:
      'Plazo de 30 días, desistimiento, estado del producto, gastos de devolución y reembolsos en KingBelt.',
    status: 'published',
    updatedAt: '18 de agosto de 2026',
    sections: [
      { id: 'plazo', title: 'Plazo de devolución de 30 días' },
      { id: 'estado', title: 'Estado de los productos devueltos' },
      { id: 'solicitar', title: 'Cómo solicitar una devolución' },
      { id: 'gastos', title: 'Gastos de devolución' },
      { id: 'danados', title: 'Productos dañados, defectuosos o incorrectos' },
      { id: 'excepciones', title: 'Excepciones al derecho de desistimiento' },
      { id: 'rebajados', title: 'Productos rebajados y promociones' },
      { id: 'cambios', title: 'Cambios de talla, color o producto' },
      { id: 'reembolsos', title: 'Reembolsos' },
      { id: 'modelo', title: 'Modelo de comunicación de desistimiento' },
      { id: 'derechos', title: 'Derechos legales del consumidor' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  desistimiento: {
    slug: 'desistimiento',
    href: '/desistimiento',
    navLabel: 'Desistimiento',
    title: 'Formulario de desistimiento — KingBelt',
    description: 'Mecanismo de desistimiento. Vista interna de revisión, no operativa.',
    status: 'inactive',
    version: '0.1',
    sections: [
      { id: 'proceso', title: 'Proceso de desistimiento' },
      { id: 'datos-pedido', title: 'Datos del pedido' },
      { id: 'identificacion', title: 'Identificación del cliente' },
      { id: 'declaracion', title: 'Declaración' },
      { id: 'confirmacion', title: 'Confirmación' },
    ],
  },
} satisfies Record<string, LegalDocument>;

export const legalCta = {
  eyebrow: 'Consultas',
  title: '¿Tienes una duda sobre este documento?',
  description:
    'Si necesitas aclarar un apartado, escríbenos con el documento y el punto concreto.',
  buttonLabel: 'Ir a contacto',
  buttonHref: '/contacto',
  image: '/images/blog/cinturon-marron.jpg',
  imagePosition: 'center 40%',
} as const;

export const legalPages = {
  avisoLegal: {
    heading: 'Aviso legal',
    titleHtml: 'Información del <em>titular</em>.',
    lede: `Identificación de ${confirmed(businessFacts.legalName) ?? 'CintuElx S.L.'}, condiciones de uso del sitio y marco de responsabilidad.`,
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Persona sujetando varios cinturones de cuero en un taller',
    imagePosition: 'center 52%',
    meta: 'KingBelt · Aviso legal',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'Titular, uso del sitio y responsabilidad.',
      body: 'Quién opera KingBelt, cómo puede usarse este sitio y qué derechos y obligaciones rigen la navegación.',
    },
  },
  privacidad: {
    heading: 'Política de privacidad',
    titleHtml: 'Cómo tratamos tus <em>datos</em>.',
    lede: 'Información sobre la recopilación, el uso y la divulgación de tu información personal.',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro de vestir sobre fondo neutro',
    imagePosition: 'center 55%',
    meta: 'KingBelt · Privacidad',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'Tratamiento, derechos y ejercicio.',
      body: 'Qué información tratamos, con quién la compartimos y cómo puedes ejercer tus derechos.',
    },
  },
  cookies: {
    heading: 'Política de cookies y tecnologías',
    titleHtml: 'Tecnologías que usa este <em>sitio</em>.',
    lede: 'Información sobre el almacenamiento local y recursos externos utilizados actualmente.',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Detalle de cinturón de cuero marrón oscuro',
    imagePosition: 'center 48%',
    meta: 'KingBelt · Cookies',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'Solo lo demostrable en el código.',
      body: 'Cookie de sesión, almacenamiento de demostración y tipografías externas. Sin analítica ni marketing de primera parte.',
    },
  },
  condiciones: {
    heading: 'Condiciones generales de compra',
    titleHtml: 'Condiciones de <em>compra</em>.',
    lede: 'Identidad del vendedor, proceso de pedido y remisión a envíos, devoluciones y garantías.',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Persona sujetando varios cinturones de cuero en un taller',
    imagePosition: 'center 46%',
    meta: 'KingBelt · Condiciones',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'El contrato de compraventa.',
      body: 'Quién vende, cómo se formaliza el pedido y dónde están las reglas de envío, desistimiento y garantía.',
    },
  },
  desistimiento: {
    heading: 'Formulario de desistimiento',
    titleHtml: 'Desistimiento, <em>aún no operativo</em>.',
    lede: 'Vista interna de revisión. El mecanismo electrónico no está activo.',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro de vestir sobre fondo neutro',
    imagePosition: 'center 62%',
    meta: 'KingBelt · Desistimiento',
    section: {
      index: '01',
      eyebrow: 'Revisión interna',
      title: 'El proceso previsto, sin envío.',
      body: 'Esta ruta no permite presentar solicitudes. Servirá para comunicar el desistimiento cuando el ecommerce esté operativo.',
    },
  },
  envios: {
    heading: 'Política de envíos',
    titleHtml: 'Preparación, transporte y <em>entrega</em>.',
    lede: 'Condiciones de envío, plazos, seguimiento e incidencias de los pedidos KingBelt.',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Persona sujetando varios cinturones de cuero en un taller',
    imagePosition: 'center 48%',
    meta: 'KingBelt · Envíos',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'Cómo llega el pedido.',
      body: 'Zonas, gastos, plazos, seguimiento y qué ocurre si hay una incidencia en el transporte.',
    },
  },
  devoluciones: {
    heading: 'Devoluciones y reembolsos',
    titleHtml: '30 días para <em>devolver</em>.',
    lede: 'Desistimiento, estado del producto, gastos de devolución y reembolsos.',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón de cuero marrón sobre fondo neutro',
    imagePosition: 'center 42%',
    meta: 'KingBelt · Devoluciones',
    section: {
      index: '01',
      eyebrow: 'Documento',
      title: 'Cambios, desistimiento y reembolsos.',
      body: 'El plazo de 30 días, cómo solicitar una devolución y en qué casos KingBelt asume los gastos.',
    },
  },
} as const;

export type LegalDocumentKey = keyof typeof legalDocuments;
const allLegalDocuments: LegalDocument[] = Object.values(legalDocuments);

const legalNavigationOrder = [
  'avisoLegal',
  'privacidad',
  'cookies',
  'condiciones',
] as const satisfies readonly LegalDocumentKey[];

export const legalNavItems: LegalNavItem[] = legalNavigationOrder.map((key) => {
  const document = legalDocuments[key];
  return {
    label: document.navLabel,
    href: document.href,
    status: document.status,
  };
});

export const visibleLegalNavItems = legalNavItems.filter((item) => item.status === 'published');

export const legalFooterNav = visibleLegalNavItems.map(({ label, href }) => ({ label, href }));

export const getLegalRobots = (
  document: Pick<LegalDocument, 'status'>
): 'noindex,follow' | 'noindex,nofollow' | undefined => {
  if (document.status === 'published') return undefined;
  return document.status === 'inactive' ? 'noindex,nofollow' : 'noindex,follow';
};

const normalizePathname = (pathname: string): string =>
  pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

export const getLegalSitemapExcludedPaths = (): string[] =>
  allLegalDocuments
    .filter((document) => document.status !== 'published')
    .map((document) => normalizePathname(document.href));

/** Texto de primera capa de privacidad reutilizable (sin datos pendientes). */
export const privacyFirstLayer = (): {
  controller: string | null;
  purpose: string | null;
  legalBasis: string | null;
  recipients: string | null;
  rights: string;
} => ({
  controller: confirmed(businessFacts.dataController) ?? null,
  purpose: confirmed(businessFacts.processingPurposes) ?? null,
  legalBasis: confirmed(businessFacts.legalBases) ?? null,
  recipients: confirmed(businessFacts.recipients) ?? null,
  rights:
    'Acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, cuando proceda. También puedes presentar reclamación ante la Agencia Española de Protección de Datos (AEPD).',
});

const filledLegalCopy = flattenLegalBodySections(legalBodies);

/** Cuerpos de apartado inspectables por el gate. Las páginas legales los renderizan. */
export const legalStaticSectionCopy: Partial<Record<LegalDocumentKey, Record<string, string>>> = filledLegalCopy;
