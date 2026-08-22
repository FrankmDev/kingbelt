/**
 * Contrato de readiness legal/comercial: fail-closed, sin publicar borradores.
 * Distingue hechos obligatorios, claims opcionales y decisiones manuales.
 */
import {
  businessFacts,
  confirmed,
  type BusinessFactKey,
  type BusinessFacts,
} from './business';
import { flattenLegalBlocks, flattenLegalBodySections, legalBodies } from '../content/legal-bodies';
import { helpFooterNav } from '../content/help';
import {
  currentTechnologies,
  externalResources,
  getLegalSitemapExcludedPaths,
  legalCta,
  legalDocuments,
  legalFooterNav,
  legalPages,
  legalStaticSectionCopy,
  privacyFirstLayer,
  type DocumentStatus,
  type LegalDocument,
  type LegalDocumentKey,
} from '../content/legal';

export const REQUIRED_LAUNCH_DOCUMENTS = [
  'avisoLegal',
  'privacidad',
  'cookies',
  'condiciones',
  'envios',
  'devoluciones',
] as const satisfies readonly LegalDocumentKey[];

export type RequiredLaunchDocumentKey = (typeof REQUIRED_LAUNCH_DOCUMENTS)[number];

export const legalReadinessRequirements = {
  avisoLegal: {
    requiredFacts: [
      'legalName',
      'tradeName',
      'taxId',
      'address',
      'registeredAddress',
      'email',
      'phone',
      'registryData',
      'activity',
      'jurisdiction',
    ],
  },
  privacidad: {
    requiredFacts: [
      'dataController',
      'processingPurposes',
      'legalBases',
      'retentionPeriod',
      'recipients',
      'internationalTransfers',
      'email',
    ],
  },
  cookies: {
    requiredFacts: ['cookiesAndTechnologies', 'email'],
  },
  condiciones: {
    requiredFacts: [
      'legalName',
      'tradeName',
      'taxId',
      'address',
      'email',
      'phone',
      'taxPolicy',
      'paymentMethods',
      'salesTerritory',
      'carriers',
      'shippingCosts',
      'deliveryTime',
      'returnPolicy',
      'returnAddress',
      'warranty',
      'jurisdiction',
    ],
  },
  envios: {
    requiredFacts: [
      'salesTerritory',
      'preparationTime',
      'carriers',
      'shippingCosts',
      'deliveryTime',
      'returnPolicy',
      'returnAddress',
      'email',
    ],
  },
  devoluciones: {
    requiredFacts: ['returnPolicy', 'returnAddress', 'warranty', 'email', 'phone'],
  },
} as const satisfies Record<
  RequiredLaunchDocumentKey,
  { requiredFacts: readonly BusinessFactKey[] }
>;

const uniqueKeys = (keys: readonly BusinessFactKey[]): BusinessFactKey[] => [...new Set(keys)];

export const REQUIRED_LAUNCH_BUSINESS_FACTS = uniqueKeys(
  REQUIRED_LAUNCH_DOCUMENTS.flatMap((key) => legalReadinessRequirements[key].requiredFacts)
);

export const OPTIONAL_PUBLIC_CLAIM_FACTS = [
  'madeInSpain',
  'packagingIncluded',
  'freeShipping',
  'responseTime',
] as const satisfies readonly BusinessFactKey[];

export type BusinessFactClassification = 'required' | 'optional' | 'manual';

export const BUSINESS_FACT_CLASSIFICATION: Record<BusinessFactKey, BusinessFactClassification> = {
  legalName: 'required',
  tradeName: 'required',
  taxId: 'required',
  address: 'required',
  registeredAddress: 'required',
  email: 'required',
  phone: 'required',
  registryData: 'required',
  activity: 'required',
  salesTerritory: 'required',
  taxPolicy: 'required',
  paymentMethods: 'required',
  carriers: 'required',
  shippingCosts: 'required',
  preparationTime: 'required',
  deliveryTime: 'required',
  returnPolicy: 'required',
  returnAddress: 'required',
  warranty: 'required',
  jurisdiction: 'required',
  dataController: 'required',
  processingPurposes: 'required',
  legalBases: 'required',
  retentionPeriod: 'required',
  recipients: 'required',
  internationalTransfers: 'required',
  cookiesAndTechnologies: 'required',
  madeInSpain: 'optional',
  packagingIncluded: 'optional',
  freeShipping: 'optional',
  responseTime: 'optional',
};

export interface ManualLaunchDecision {
  id: string;
  resolved: boolean;
  summary: string;
  /** Si es false, el fallo se reporta para Payment QA y no bloquea legal:preflight. */
  blocksLegalPreflight?: boolean;
}

/**
 * Decisiones que un humano debe registrar en esta fuente.
 * `resolved: false` bloquea el preflight. No interpreta la validez jurídica.
 */
export const manualLaunchDecisions: readonly ManualLaunchDecision[] = [
  {
    id: 'withdrawalMechanism',
    resolved: true,
    summary:
      'El mecanismo publicado es la Política de devoluciones: comunicación a contabilidad@cintuelx.com y modelo de desistimiento. /desistimiento permanece inactive y no es la vía operativa.',
  },
  {
    id: 'shopifyPolicyReconciliation',
    resolved: false,
    blocksLegalPreflight: false,
    summary:
      'SHOPIFY POLICY CONTENT REQUIRED MANUALLY. Astro policy content must be reconciled with Shopify Admin before Payment QA.',
  },
  {
    id: 'addressLegalFunction',
    resolved: true,
    summary:
      'Domicilio social: Avenida de Novelda, 143, bajo, Elche (Aviso Legal → registeredAddress). Dirección de devoluciones: Carrús/Polígono (Política de devoluciones → returnAddress). Texto empresarial «Bueno e Hijos SL…» conservado en address sin función jurídica propia.',
  },
  {
    id: 'dataControllerIdentity',
    resolved: true,
    summary: 'La política de privacidad identifica a CintuElx S.L. como responsable del tratamiento.',
  },
];

const FACT_DEPENDENT_SECTIONS: Record<LegalDocumentKey, Partial<Record<string, readonly BusinessFactKey[]>>> = {
  avisoLegal: {},
  privacidad: {},
  cookies: {},
  condiciones: {
    identidad: ['legalName', 'tradeName', 'taxId', 'address', 'email', 'phone'],
    precios: ['taxPolicy'],
    pagos: ['paymentMethods'],
    entrega: ['deliveryTime', 'salesTerritory'],
    envio: ['carriers', 'shippingCosts'],
    desistimiento: ['returnPolicy'],
    devoluciones: ['returnPolicy', 'returnAddress'],
    conformidad: ['warranty'],
    'ley-aplicable': ['jurisdiction'],
    'resolucion-conflictos': ['jurisdiction'],
  },
  envios: {},
  devoluciones: {},
  desistimiento: {},
};

const STATIC_COMPLETED_SECTIONS: Record<LegalDocumentKey, readonly string[]> = {
  avisoLegal: [
    'informacion-general',
    'objeto',
    'condiciones-acceso',
    'propiedad-intelectual',
    'marca',
    'contenidos',
    'disponibilidad',
    'seguridad',
    'enlaces-terceros',
    'enlaces-hacia',
    'responsabilidad-usuario',
    'responsabilidad-kingbelt',
    'comercio-electronico',
    'proteccion-datos',
    'cookies',
    'proveedores',
    'comunicaciones',
    'modificacion',
    'legislacion',
    'contacto',
  ],
  privacidad: [
    'informacion-personal',
    'fuentes',
    'usos',
    'divulgacion',
    'shopify',
    'sitios-terceros',
    'menores',
    'seguridad-retencion',
    'derechos',
    'reclamaciones',
    'transferencias',
    'cambios',
    'contacto',
  ],
  cookies: [
    'que-son',
    'tecnologias-actuales',
    'recursos-externos',
    'gestion',
    'actualizacion',
    'contacto',
  ],
  condiciones: ['objeto', 'productos', 'proceso-compra', 'idioma', 'atencion', 'propiedad-intelectual'],
  envios: [
    'vendedor',
    'zonas',
    'gastos',
    'preparacion',
    'plazos',
    'computo',
    'seguimiento',
    'direccion',
    'entrega',
    'ausencia',
    'retrasos',
    'perdido',
    'danado',
    'incorrecto',
    'riesgo',
    'divididos',
    'aduanas',
    'modificaciones',
    'devoluciones',
    'fuerza-mayor',
    'relacion',
    'contacto',
  ],
  devoluciones: [
    'plazo',
    'estado',
    'solicitar',
    'gastos',
    'danados',
    'excepciones',
    'rebajados',
    'cambios',
    'reembolsos',
    'modelo',
    'derechos',
    'contacto',
  ],
  desistimiento: ['proceso', 'datos-pedido', 'identificacion', 'declaracion', 'confirmacion'],
};

export const PUBLISHED_PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /pendiente de validación/i,
  /se completará/i,
  /antes de activar/i,
  /(?:en |durante la )fase de preparación/i,
  /fase de desarrollo/i,
  /fase interna/i,
  /revisión pendiente/i,
  /vista interna/i,
  /aún no operativo/i,
  /cuando Shopify esté configurado/i,
  /Pendiente de confirmación antes de publicar/i,
  /no constituye asesoramiento legal/i,
];

export interface LegalReadinessInput {
  facts: BusinessFacts;
  documents: Record<LegalDocumentKey, LegalDocument>;
  completedSectionIds: Record<LegalDocumentKey, ReadonlySet<string>>;
  contentByDocument: Partial<Record<LegalDocumentKey, string>>;
  publicNavHrefs: readonly string[];
  sitemapExcludedPaths: readonly string[];
  manualDecisions?: readonly ManualLaunchDecision[];
}

export interface LegalReadinessReport {
  ok: boolean;
  pendingRequiredFacts: BusinessFactKey[];
  optionalPendingFacts: BusinessFactKey[];
  draftRequiredDocuments: LegalDocumentKey[];
  inactiveRequiredDocuments: LegalDocumentKey[];
  publishedPlaceholders: Array<{ document: LegalDocumentKey; match: string }>;
  publishedPendingSections: Array<{ document: LegalDocumentKey; sectionIds: string[] }>;
  draftInPublicNav: string[];
  unpublishedMissingFromSitemapExclusion: string[];
  publishedExcludedFromSitemap: string[];
  unresolvedManualDecisions: string[];
  paymentQaManualDecisions: string[];
  incompletePrivacyFirstLayer: boolean;
}

const isConfirmed = (facts: BusinessFacts, key: BusinessFactKey): boolean =>
  confirmed(facts[key]) !== undefined;

export const getCompletedLegalSectionIds = (
  documentKey: LegalDocumentKey,
  facts: BusinessFacts = businessFacts
): Set<string> => {
  const body = legalBodies[documentKey as keyof typeof legalBodies];
  if (body) return new Set(Object.keys(body.sections));

  const completed = new Set<string>(STATIC_COMPLETED_SECTIONS[documentKey] ?? []);
  const dependent = FACT_DEPENDENT_SECTIONS[documentKey] ?? {};
  for (const [sectionId, requiredFacts] of Object.entries(dependent)) {
    if (requiredFacts?.every((key) => isConfirmed(facts, key))) {
      completed.add(sectionId);
    }
  }
  return completed;
};

export const getAllCompletedLegalSectionIds = (
  facts: BusinessFacts = businessFacts
): Record<LegalDocumentKey, Set<string>> => {
  const keys = Object.keys(legalDocuments) as LegalDocumentKey[];
  return Object.fromEntries(keys.map((key) => [key, getCompletedLegalSectionIds(key, facts)])) as Record<
    LegalDocumentKey,
    Set<string>
  >;
};

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
};

export const collectLegalDocumentContent = (
  key: LegalDocumentKey,
  documents: Record<LegalDocumentKey, LegalDocument> = legalDocuments
): string => {
  const document = documents[key];
  const parts = [
    document.title,
    document.description,
    document.navLabel,
    ...collectStrings(key in legalPages ? legalPages[key as keyof typeof legalPages] : undefined),
    ...collectStrings(legalStaticSectionCopy[key]),
    ...collectStrings(legalCta),
    ...collectStrings(flattenLegalBodySections(legalBodies)[key]),
    ...collectStrings(
      legalBodies[key as keyof typeof legalBodies]?.intro
        ? flattenLegalBlocks(legalBodies[key as keyof typeof legalBodies].intro ?? [])
        : undefined
    ),
  ];
  if (key === 'privacidad') parts.push(...collectStrings(privacyFirstLayer()));
  if (key === 'cookies') {
    parts.push(...collectStrings(currentTechnologies), ...collectStrings(externalResources));
  }
  return parts.filter(Boolean).join('\n');
};

export const collectAllLegalDocumentContent = (
  documents: Record<LegalDocumentKey, LegalDocument> = legalDocuments
): Record<LegalDocumentKey, string> => {
  const keys = Object.keys(documents) as LegalDocumentKey[];
  return Object.fromEntries(keys.map((key) => [key, collectLegalDocumentContent(key, documents)])) as Record<
    LegalDocumentKey,
    string
  >;
};

const findPlaceholder = (text: string): string | undefined => {
  for (const pattern of PUBLISHED_PLACEHOLDER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return undefined;
};

const normalizePath = (pathname: string): string =>
  pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

export const evaluateLegalReadiness = (input: LegalReadinessInput): LegalReadinessReport => {
  const pendingRequiredFacts = REQUIRED_LAUNCH_BUSINESS_FACTS.filter(
    (key) => !isConfirmed(input.facts, key)
  );
  const optionalPendingFacts = OPTIONAL_PUBLIC_CLAIM_FACTS.filter(
    (key) => !isConfirmed(input.facts, key)
  ) as BusinessFactKey[];

  const draftRequiredDocuments: LegalDocumentKey[] = [];
  const inactiveRequiredDocuments: LegalDocumentKey[] = [];
  const publishedPlaceholders: LegalReadinessReport['publishedPlaceholders'] = [];
  const publishedPendingSections: LegalReadinessReport['publishedPendingSections'] = [];

  for (const key of REQUIRED_LAUNCH_DOCUMENTS) {
    const document = input.documents[key];
    const status: DocumentStatus = document.status;
    if (status === 'draft') draftRequiredDocuments.push(key);
    if (status === 'inactive') inactiveRequiredDocuments.push(key);
    if (status !== 'published') continue;

    const content = input.contentByDocument[key] ?? '';
    const placeholder = findPlaceholder(content);
    if (placeholder) publishedPlaceholders.push({ document: key, match: placeholder });

    const completed = input.completedSectionIds[key] ?? new Set<string>();
    const pendingIds = document.sections
      .map((section) => section.id)
      .filter((id) => !completed.has(id));
    if (pendingIds.length > 0) {
      publishedPendingSections.push({ document: key, sectionIds: pendingIds });
    }
  }

  const unpublishedHrefs = Object.values(input.documents)
    .filter((document) => document.status !== 'published')
    .map((document) => normalizePath(document.href));

  const draftInPublicNav = input.publicNavHrefs
    .map(normalizePath)
    .filter((href) => unpublishedHrefs.includes(href));

  const excluded = new Set(input.sitemapExcludedPaths.map(normalizePath));
  const unpublishedMissingFromSitemapExclusion = unpublishedHrefs.filter((href) => !excluded.has(href));
  const publishedExcludedFromSitemap = Object.values(input.documents)
    .filter((document) => document.status === 'published')
    .map((document) => normalizePath(document.href))
    .filter((href) => excluded.has(href));

  const unresolvedDecisions = (input.manualDecisions ?? manualLaunchDecisions).filter(
    (decision) => !decision.resolved
  );
  const unresolvedManualDecisions = unresolvedDecisions
    .filter((decision) => decision.blocksLegalPreflight !== false)
    .map((decision) => decision.id);
  const paymentQaManualDecisions = unresolvedDecisions
    .filter((decision) => decision.blocksLegalPreflight === false)
    .map((decision) => decision.id);

  const incompletePrivacyFirstLayer = !(
    confirmed(input.facts.dataController)
    && confirmed(input.facts.processingPurposes)
    && confirmed(input.facts.legalBases)
  );

  const ok =
    pendingRequiredFacts.length === 0
    && draftRequiredDocuments.length === 0
    && inactiveRequiredDocuments.length === 0
    && publishedPlaceholders.length === 0
    && publishedPendingSections.length === 0
    && draftInPublicNav.length === 0
    && unpublishedMissingFromSitemapExclusion.length === 0
    && publishedExcludedFromSitemap.length === 0
    && unresolvedManualDecisions.length === 0
    && !incompletePrivacyFirstLayer;

  return {
    ok,
    pendingRequiredFacts,
    optionalPendingFacts,
    draftRequiredDocuments,
    inactiveRequiredDocuments,
    publishedPlaceholders,
    publishedPendingSections,
    draftInPublicNav,
    unpublishedMissingFromSitemapExclusion,
    publishedExcludedFromSitemap,
    unresolvedManualDecisions,
    paymentQaManualDecisions,
    incompletePrivacyFirstLayer,
  };
};

export const currentLegalPublicNavHrefs = (): string[] => [
  ...legalFooterNav.map((item) => item.href),
  ...helpFooterNav.map((item) => item.href),
];

export const evaluateCurrentLegalReadiness = (): LegalReadinessReport =>
  evaluateLegalReadiness({
    facts: businessFacts,
    documents: legalDocuments,
    completedSectionIds: getAllCompletedLegalSectionIds(businessFacts),
    contentByDocument: collectAllLegalDocumentContent(),
    publicNavHrefs: currentLegalPublicNavHrefs(),
    sitemapExcludedPaths: getLegalSitemapExcludedPaths(),
    manualDecisions: manualLaunchDecisions,
  });
