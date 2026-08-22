import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BUSINESS_FACT_CLASSIFICATION,
  OPTIONAL_PUBLIC_CLAIM_FACTS,
  REQUIRED_LAUNCH_BUSINESS_FACTS,
  REQUIRED_LAUNCH_DOCUMENTS,
  evaluateLegalReadiness,
  getLegalSectionReadiness,
  hasMeaningfulLegalContent,
  legalReadinessRequirements,
  manualLaunchDecisions,
} from '../src/config/legal-readiness.ts';
import { businessFacts, confirmed, toTelHref } from '../src/config/business.ts';
import { site } from '../src/config/site.ts';
import {
  currentTechnologies,
  getLegalRobots,
  getLegalSitemapExcludedPaths,
  legalDocuments,
  legalFooterNav,
  visibleLegalNavItems,
} from '../src/content/legal.ts';
import { helpFooterNav } from '../src/content/help.ts';
import { isSitemapExcluded } from '../src/config/sitemap.ts';
import { LOCAL_CART_STORAGE_KEY } from '../src/commerce/infrastructure/demo/cart-storage.ts';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../src/session-storage-config.ts';
import {
  runLegalPreflight,
  runLegalPreflightCli,
} from '../scripts/legal-preflight.ts';

const root = resolve(import.meta.dir, '..');

const pendingFact = { status: 'pending', notes: 'test' };
const confirmedFact = (value) => ({
  status: 'confirmed',
  value,
  source: 'test',
});

const cloneDocuments = (overrides = {}) => {
  const documents = structuredClone(legalDocuments);
  for (const [key, value] of Object.entries(overrides)) {
    documents[key] = { ...documents[key], ...value };
  }
  return documents;
};

const allConfirmedFacts = Object.fromEntries(
  Object.keys(businessFacts).map((key) => [key, confirmedFact(`confirmed-${key}`)])
);

const completeSectionReadiness = Object.fromEntries(
  Object.keys(legalDocuments).map((key) => [
    key,
    Object.fromEntries(legalDocuments[key].sections.map((section) => [
      section.id,
      { status: 'complete', content: `Contenido significativo de ${section.id}.` },
    ])),
  ])
);

const publishedDocuments = () => {
  const documents = structuredClone(legalDocuments);
  for (const key of Object.keys(documents)) {
    documents[key].status = key === 'desistimiento' ? 'inactive' : 'published';
    documents[key].description = 'Documento vigente.';
  }
  for (const key of REQUIRED_LAUNCH_DOCUMENTS) {
    documents[key].status = 'published';
    documents[key].description = 'Documento vigente.';
  }
  return documents;
};

const passingInput = (overrides = {}) => ({
  facts: allConfirmedFacts,
  documents: publishedDocuments(),
  sectionReadiness: completeSectionReadiness,
  contentByDocument: Object.fromEntries(
    REQUIRED_LAUNCH_DOCUMENTS.map((key) => [key, 'Texto definitivo sin marcadores.'])
  ),
  publicNavHrefs: REQUIRED_LAUNCH_DOCUMENTS.map((key) => publishedDocuments()[key].href),
  sitemapExcludedPaths: ['/desistimiento'],
  manualDecisions: manualLaunchDecisions.map((decision) => ({ ...decision, resolved: true })),
  ...overrides,
});

describe('hechos empresariales confirmados', () => {
  test('devuelve la identidad empresarial confirmada', () => {
    expect(confirmed(businessFacts.legalName)).toBe('CintuElx S.L.');
    expect(confirmed(businessFacts.tradeName)).toBe('Kingbelt');
    expect(confirmed(businessFacts.taxId)).toBe('B42696716');
    expect(confirmed(businessFacts.phone)).toBe('965 43 01 51');
    expect(confirmed(businessFacts.email)).toBe('contabilidad@cintuelx.com');
    expect(site.contact.email).toBe(confirmed(businessFacts.email));
    expect(confirmed(businessFacts.address)).toContain('Avenida de Novelda, 143, bajo');
    expect(confirmed(businessFacts.address)).toContain('03206 Elche (Alicante)');
    expect(confirmed(businessFacts.website)).toBe('https://kingbelt.com');
    expect(confirmed(businessFacts.registeredAddress)).toBe(confirmed(businessFacts.address));
    expect(confirmed(businessFacts.registryData)).toContain('hoja A-168894');
    expect(confirmed(businessFacts.legalBases)).toContain('Ejecución contractual');
    expect(confirmed(businessFacts.returnAddress)).toBeUndefined();
    expect(toTelHref(businessFacts.phone.value)).toBe('tel:+34965430151');
  });

  test('un hecho pending no se publica', () => {
    expect(confirmed(businessFacts.madeInSpain)).toBeUndefined();
    expect(confirmed(businessFacts.freeShipping)).toBe('Envíos gratuitos');
    expect(confirmed(pendingFact)).toBeUndefined();
  });

  test('distingue hechos obligatorios y claims opcionales', () => {
    expect(BUSINESS_FACT_CLASSIFICATION.legalName).toBe('required');
    expect(BUSINESS_FACT_CLASSIFICATION.madeInSpain).toBe('optional');
    expect(REQUIRED_LAUNCH_BUSINESS_FACTS).toContain('taxId');
    expect(REQUIRED_LAUNCH_BUSINESS_FACTS).toContain('registeredAddress');
    expect(REQUIRED_LAUNCH_BUSINESS_FACTS).not.toContain('freeShipping');
    expect(OPTIONAL_PUBLIC_CLAIM_FACTS).toContain('freeShipping');
    expect(legalReadinessRequirements.avisoLegal.requiredFacts).toContain('legalName');
    expect(legalReadinessRequirements.privacidad.requiredFacts).toContain('dataController');
    expect(legalReadinessRequirements.envios.requiredFacts).not.toContain('returnAddress');
    expect(legalReadinessRequirements.devoluciones.requiredFacts).toContain('returnPolicy');
    expect(BUSINESS_FACT_CLASSIFICATION.returnAddress).toBe('manual');
  });
});

describe('legal readiness gate', () => {
  test('un hecho requerido pending bloquea el lanzamiento e identifica la clave', () => {
    const report = evaluateLegalReadiness(
      passingInput({
        facts: { ...allConfirmedFacts, registryData: pendingFact },
      })
    );
    expect(report.ok).toBe(false);
    expect(report.pendingRequiredFacts).toContain('registryData');
  });

  test('un documento requerido en draft bloquea', () => {
    const documents = publishedDocuments();
    documents.condiciones.status = 'draft';
    const report = evaluateLegalReadiness(passingInput({ documents }));
    expect(report.ok).toBe(false);
    expect(report.draftRequiredDocuments).toContain('condiciones');
  });

  test('un documento requerido inactive bloquea', () => {
    const documents = publishedDocuments();
    documents.envios.status = 'inactive';
    const report = evaluateLegalReadiness(passingInput({ documents }));
    expect(report.ok).toBe(false);
    expect(report.inactiveRequiredDocuments).toContain('envios');
  });

  test('una decisión de Payment QA no bloquea el legal preflight', () => {
    const report = evaluateLegalReadiness(
      passingInput({
        manualDecisions: [
          {
            id: 'shopifyPolicyReconciliation',
            resolved: false,
            blocksLegalPreflight: false,
            summary: 'Admin',
          },
        ],
      })
    );
    expect(report.ok).toBe(true);
    expect(report.unresolvedManualDecisions).toEqual([]);
    expect(report.paymentQaManualDecisions).toEqual(['shopifyPolicyReconciliation']);
  });

  test('requisitos confirmados, published y sin placeholders pasan ese documento', () => {
    const report = evaluateLegalReadiness(passingInput());
    expect(report.draftRequiredDocuments).toEqual([]);
    expect(report.publishedPlaceholders).toEqual([]);
    expect(report.publishedPendingSections).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test.each([
    ['', 'vacío'],
    ['   ', 'whitespace'],
  ])('published con contenido %s en una sección complete bloquea', (content) => {
    const sectionReadiness = structuredClone(completeSectionReadiness);
    sectionReadiness.avisoLegal['informacion-general'].content = content;
    const report = evaluateLegalReadiness(passingInput({ sectionReadiness }));
    expect(report.ok).toBe(false);
    expect(report.publishedEmptySections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        document: 'avisoLegal',
        sectionIds: expect.arrayContaining(['informacion-general']),
      }),
    ]));
  });

  test.each(['TODO', 'TBD', '[INSERTAR DOMICILIO]'])('published con marcador %s bloquea', (marker) => {
    const report = evaluateLegalReadiness(passingInput({
      contentByDocument: {
        ...passingInput().contentByDocument,
        avisoLegal: `Texto definitivo. ${marker}`,
      },
    }));
    expect(report.ok).toBe(false);
    expect(report.publishedPlaceholders.some((item) => item.document === 'avisoLegal')).toBe(true);
  });

  test('la palabra española "todo" no se confunde con el marcador técnico TODO', () => {
    const report = evaluateLegalReadiness(passingInput({
      contentByDocument: {
        ...passingInput().contentByDocument,
        avisoLegal: 'Texto definitivo aplicable a todo consumidor.',
      },
    }));
    expect(report.ok).toBe(true);
  });

  test('published con placeholder bloquea', () => {
    const report = evaluateLegalReadiness(
      passingInput({
        contentByDocument: {
          avisoLegal: 'Documento pendiente de validación.',
          privacidad: 'Texto definitivo.',
          cookies: 'Texto definitivo.',
          condiciones: 'Texto definitivo.',
          envios: 'Texto definitivo.',
          devoluciones: 'Texto definitivo.',
        },
      })
    );
    expect(report.ok).toBe(false);
    expect(report.publishedPlaceholders.some((item) => item.document === 'avisoLegal')).toBe(true);
  });

  test('published con sección pending bloquea', () => {
    const report = evaluateLegalReadiness(
      passingInput({
        sectionReadiness: {
          ...completeSectionReadiness,
          envios: {
            ...completeSectionReadiness.envios,
            zonas: { status: 'pending', content: null },
          },
        },
      })
    );
    expect(report.ok).toBe(false);
    expect(report.publishedPendingSections[0]?.document).toBe('envios');
    expect(report.publishedPendingSections[0]?.sectionIds).toContain('zonas');
  });

  test('published aparece en navegación; draft e inactive quedan fuera', () => {
    expect(visibleLegalNavItems.map((item) => item.href)).toEqual([
      '/aviso-legal',
      '/privacidad',
      '/cookies',
      '/condiciones',
    ]);
    expect(legalFooterNav.map((item) => item.href)).toEqual([
      '/aviso-legal',
      '/privacidad',
      '/cookies',
      '/condiciones',
    ]);
    expect(helpFooterNav.map((item) => item.href)).toContain('/envios-y-devoluciones');
    expect(helpFooterNav.map((item) => item.href)).toContain('/devoluciones');

    const publishedNav = evaluateLegalReadiness(
      passingInput({
        publicNavHrefs: ['/aviso-legal', '/envios-y-devoluciones'],
      })
    );
    expect(publishedNav.draftInPublicNav).toEqual([]);

    const draftNav = evaluateLegalReadiness(
      passingInput({
        publicNavHrefs: ['/aviso-legal', legalDocuments.condiciones.href],
        documents: cloneDocuments({ condiciones: { status: 'draft' } }),
      })
    );
    expect(draftNav.draftInPublicNav).toContain('/condiciones');
  });

  test('no existe showDraftLegalInNav', () => {
    const legalSource = readFileSync(join(root, 'src/content/legal.ts'), 'utf8');
    const navSource = readFileSync(join(root, 'src/config/navigation.ts'), 'utf8');
    expect(legalSource).not.toContain('showDraftLegalInNav');
    expect(navSource).not.toContain('showDraftLegalInNav');
  });
});

describe('robots, sitemap y tecnologías', () => {
  test('robots sigue el estado del documento', () => {
    expect(getLegalRobots({ status: 'draft' })).toBe('noindex,follow');
    expect(getLegalRobots({ status: 'inactive' })).toBe('noindex,nofollow');
    expect(getLegalRobots({ status: 'published' })).toBeUndefined();
  });

  test('documentos no publicados quedan fuera del sitemap; published no por esta regla', () => {
    expect(getLegalSitemapExcludedPaths()).toEqual(['/desistimiento']);
    expect(isSitemapExcluded('/aviso-legal')).toBe(false);
    expect(isSitemapExcluded('/desistimiento')).toBe(true);

    const published = publishedDocuments();
    const excluded = Object.values(published)
      .filter((document) => document.status !== 'published')
      .map((document) => document.href.replace(/\/+$/, ''));
    expect(excluded).toContain('/desistimiento');
    expect(excluded).not.toContain('/aviso-legal');
  });

  test('el inventario de tecnologías refleja cookie de sesión y localStorage demo', () => {
    expect(currentTechnologies.some((tech) => tech.name === SESSION_COOKIE_NAME && tech.type === 'cookie')).toBe(
      true
    );
    expect(currentTechnologies.some((tech) => tech.name === LOCAL_CART_STORAGE_KEY && tech.type === 'localStorage')).toBe(
      true
    );
    const session = currentTechnologies.find((tech) => tech.name === SESSION_COOKIE_NAME);
    expect(session?.duration).toContain(String(SESSION_TTL_SECONDS));
    expect(session?.duration).not.toMatch(/localStorage/i);
  });
});

describe('legal:preflight sobre el repositorio actual', () => {
  test('pasa con facts confirmados, documentos definitivos y claims opcionales aún pendientes', () => {
    const report = runLegalPreflight();
    expect(report.ok).toBe(true);
    expect(report.pendingRequiredFacts).toEqual([]);
    expect(report.draftRequiredDocuments).toEqual([]);
    expect(report.unresolvedManualDecisions).toEqual([]);
    expect(report.paymentQaManualDecisions).toEqual(['shopifyPolicyReconciliation']);
    expect(report.incompletePrivacyFirstLayer).toBe(false);
    expect(report.optionalPendingFacts).toEqual(
      expect.arrayContaining(['madeInSpain', 'packagingIncluded', 'responseTime'])
    );
    expect(report.optionalPendingFacts).not.toContain('freeShipping');
    expect(getLegalSectionReadiness('avisoLegal')['informacion-general'].status).toBe('complete');
    expect(hasMeaningfulLegalContent(getLegalSectionReadiness('avisoLegal')['informacion-general'].content)).toBe(true);

    const io = {
      stdout: { chunks: [], write(chunk) { this.chunks.push(String(chunk)); return true; } },
      stderr: { chunks: [], write(chunk) { this.chunks.push(String(chunk)); return true; } },
    };
    expect(runLegalPreflightCli(io)).toBe(0);
    const output = io.stdout.chunks.join('');
    expect(output).toContain('Legal preflight passed');
    expect(output).toContain('shopifyPolicyReconciliation');
    expect(output).not.toContain('at ');
  });
});
