import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BUSINESS_FACT_CLASSIFICATION,
  OPTIONAL_PUBLIC_CLAIM_FACTS,
  REQUIRED_LAUNCH_BUSINESS_FACTS,
  REQUIRED_LAUNCH_DOCUMENTS,
  evaluateLegalReadiness,
  getCompletedLegalSectionIds,
  legalReadinessRequirements,
  manualLaunchDecisions,
} from '../src/config/legal-readiness.ts';
import { businessFacts, confirmed, toTelHref } from '../src/config/business.ts';
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

const completeCompletion = Object.fromEntries(
  Object.keys(legalDocuments).map((key) => [
    key,
    new Set(legalDocuments[key].sections.map((section) => section.id)),
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
  completedSectionIds: completeCompletion,
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
    expect(confirmed(businessFacts.tradeName)).toBe('KingBelt');
    expect(confirmed(businessFacts.taxId)).toBe('B42696716');
    expect(confirmed(businessFacts.phone)).toBe('965 43 01 51');
    expect(confirmed(businessFacts.email)).toBe('hola@kingbelt.com');
    expect(confirmed(businessFacts.address)).toContain('Bueno e Hijos SL');
    expect(confirmed(businessFacts.address)).toContain('Avinguda de Novelda, 143');
    expect(confirmed(businessFacts.registeredAddress)).toContain('Avenida de Novelda, 143, bajo');
    expect(confirmed(businessFacts.legalBases)).toBeTruthy();
    expect(toTelHref(businessFacts.phone.value)).toBe('tel:+34965430151');
  });

  test('un hecho pending no se publica', () => {
    expect(confirmed(businessFacts.madeInSpain)).toBeUndefined();
    expect(confirmed(businessFacts.freeShipping)).toBeUndefined();
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
    expect(legalReadinessRequirements.envios.requiredFacts).toContain('returnAddress');
    expect(legalReadinessRequirements.devoluciones.requiredFacts).toContain('returnPolicy');
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
        completedSectionIds: {
          ...completeCompletion,
          envios: new Set(['contacto']),
        },
      })
    );
    expect(report.ok).toBe(false);
    expect(report.publishedPendingSections[0]?.document).toBe('envios');
    expect(report.publishedPendingSections[0]?.sectionIds).toContain('zonas');
  });

  test('draft e inactive no aparecen en el footer; published sí', () => {
    expect(visibleLegalNavItems.map((item) => item.href).sort()).toEqual([
      '/aviso-legal',
      '/condiciones',
      '/cookies',
      '/privacidad',
    ]);
    expect(legalFooterNav.map((item) => item.href).sort()).toEqual([
      '/aviso-legal',
      '/condiciones',
      '/cookies',
      '/privacidad',
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
    expect(getLegalSitemapExcludedPaths()).toEqual(expect.arrayContaining(['/desistimiento']));
    expect(getLegalSitemapExcludedPaths()).not.toEqual(
      expect.arrayContaining(['/aviso-legal', '/privacidad', '/cookies', '/condiciones'])
    );
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
  test('pasa el gate de repositorio y deja la conciliación Shopify para Payment QA', () => {
    const report = runLegalPreflight();
    expect(report.ok).toBe(true);
    expect(report.pendingRequiredFacts).toEqual([]);
    expect(report.draftRequiredDocuments).toEqual([]);
    expect(report.unresolvedManualDecisions).toEqual([]);
    expect(report.paymentQaManualDecisions).toEqual(['shopifyPolicyReconciliation']);
    expect(report.incompletePrivacyFirstLayer).toBe(false);
    expect(report.optionalPendingFacts).toEqual(
      expect.arrayContaining(['madeInSpain', 'packagingIncluded', 'freeShipping', 'responseTime'])
    );
    expect(getCompletedLegalSectionIds('avisoLegal').has('informacion-general')).toBe(true);
    expect(getCompletedLegalSectionIds('condiciones').has('identidad')).toBe(true);

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
