import { businessFacts, confirmed } from '@config/business';

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

/** Muestra enlaces a documentos en borrador en navegación pública (fase interna). */
export const showDraftLegalInNav = true;

export const legalDocuments = {
  avisoLegal: {
    slug: 'aviso-legal',
    href: '/aviso-legal',
    navLabel: 'Aviso legal',
    title: 'Aviso legal — KingBelt',
    description: 'Información legal del titular del sitio web KingBelt. Documento pendiente de validación.',
    status: 'draft',
    version: '0.1',
    sections: [
      { id: 'titular', title: 'Titular del sitio web' },
      { id: 'denominacion', title: 'Denominación social' },
      { id: 'identificacion-fiscal', title: 'Identificación fiscal' },
      { id: 'domicilio', title: 'Domicilio' },
      { id: 'contacto', title: 'Contacto' },
      { id: 'datos-registrales', title: 'Datos registrales' },
      { id: 'actividad', title: 'Actividad' },
      { id: 'condiciones-uso', title: 'Condiciones de uso' },
      { id: 'propiedad-intelectual', title: 'Propiedad intelectual e industrial' },
      { id: 'enlaces-externos', title: 'Enlaces externos' },
      { id: 'responsabilidad', title: 'Responsabilidad' },
      { id: 'legislacion', title: 'Legislación aplicable' },
      { id: 'jurisdiccion', title: 'Jurisdicción' },
    ],
  },
  privacidad: {
    slug: 'privacidad',
    href: '/privacidad',
    navLabel: 'Privacidad',
    title: 'Política de privacidad — KingBelt',
    description: 'Información sobre el tratamiento de datos personales en KingBelt. Documento pendiente de validación.',
    status: 'draft',
    version: '0.1',
    sections: [
      { id: 'responsable', title: 'Responsable del tratamiento' },
      { id: 'datos-tratados', title: 'Datos que tratamos' },
      { id: 'finalidades', title: 'Finalidades del tratamiento' },
      { id: 'bases-juridicas', title: 'Bases jurídicas' },
      { id: 'conservacion', title: 'Plazo de conservación' },
      { id: 'destinatarios', title: 'Destinatarios' },
      { id: 'encargados', title: 'Encargados del tratamiento' },
      { id: 'transferencias', title: 'Transferencias internacionales' },
      { id: 'derechos', title: 'Derechos de las personas interesadas' },
      { id: 'ejercicio-derechos', title: 'Procedimiento para ejercer los derechos' },
      { id: 'reclamacion-aepd', title: 'Reclamación ante la AEPD' },
      { id: 'menores', title: 'Menores de edad' },
      { id: 'seguridad', title: 'Medidas de seguridad' },
      { id: 'modificaciones', title: 'Modificaciones de la política' },
    ],
  },
  cookies: {
    slug: 'cookies',
    href: '/cookies',
    navLabel: 'Cookies',
    title: 'Política de cookies y tecnologías — KingBelt',
    description: 'Información sobre cookies y almacenamiento local utilizados en KingBelt.',
    status: 'draft',
    version: '0.1',
    sections: [
      { id: 'que-son', title: 'Qué son las cookies y el almacenamiento local' },
      { id: 'tecnologias-actuales', title: 'Tecnologías utilizadas actualmente' },
      { id: 'recursos-externos', title: 'Recursos externos' },
      { id: 'gestion', title: 'Cómo gestionar las preferencias' },
      { id: 'cambios-futuros', title: 'Cambios previstos' },
      { id: 'contacto', title: 'Contacto' },
    ],
  },
  condiciones: {
    slug: 'condiciones',
    href: '/condiciones',
    navLabel: 'Condiciones',
    title: 'Condiciones generales de compra — KingBelt',
    description: 'Condiciones contractuales de compra en KingBelt. Documento pendiente de validación.',
    status: 'draft',
    version: '0.1',
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
    navLabel: 'Envíos y devoluciones',
    title: 'Envíos y devoluciones — KingBelt',
    description: 'Política de envíos, cambios y devoluciones. Documento pendiente de validación.',
    status: 'draft',
    version: '0.1',
    sections: [
      { id: 'zonas', title: 'Zonas de envío' },
      { id: 'preparacion', title: 'Preparación del pedido' },
      { id: 'transporte', title: 'Transporte' },
      { id: 'costes', title: 'Costes de envío' },
      { id: 'seguimiento', title: 'Seguimiento' },
      { id: 'incidencias', title: 'Incidencias' },
      { id: 'cambios', title: 'Cambios' },
      { id: 'devoluciones', title: 'Devoluciones' },
      { id: 'desistimiento', title: 'Derecho de desistimiento' },
      { id: 'excepciones', title: 'Excepciones' },
      { id: 'estado-producto', title: 'Estado del producto' },
      { id: 'reembolsos', title: 'Reembolsos' },
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

type LegalDocumentKey = keyof typeof legalDocuments;
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

export const visibleLegalNavItems = legalNavItems.filter(
  (item) => item.status === 'published' || (item.status === 'draft' && showDraftLegalInNav)
);

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

interface CookieTechnology {
  name: string;
  type: 'localStorage' | 'sessionStorage' | 'cookie';
  purpose: string;
  duration: string;
  provider: string;
}

/** Solo tecnologías actualmente demostrables en el código. */
export const currentTechnologies: CookieTechnology[] = [
  {
    name: 'kingbelt-cart-v4',
    type: 'localStorage',
    purpose: 'Conservar las líneas del carrito local (identificador de variante y cantidad) entre visitas.',
    duration: 'Hasta que el usuario borre los datos del sitio o se migre a una versión posterior.',
    provider: 'KingBelt (primera parte)',
  },
];

interface ExternalResource {
  name: string;
  domains: string[];
  purpose: string;
  cookieNote: string;
}

export const externalResources: ExternalResource[] = [
  {
    name: 'Fontshare (API)',
    domains: ['api.fontshare.com'],
    purpose: 'Carga de la tipografía Satoshi.',
    cookieNote: 'No se declaran cookies desde la configuración del sitio; debe verificarse en el entorno de producción.',
  },
  {
    name: 'Google Fonts',
    domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    purpose: 'Carga de la tipografía Bitter.',
    cookieNote: 'No se declaran cookies desde la configuración del sitio; debe verificarse en el entorno de producción.',
  },
];

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
