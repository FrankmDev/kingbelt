import { describe, expect, test } from 'bun:test';
import {
  getLegalRobots,
  getLegalSitemapExcludedPaths,
  legalDocuments,
  legalFooterNav,
  legalNavItems,
  visibleLegalNavItems,
} from '../src/content/legal.ts';
import { isSitemapExcluded } from '../src/config/sitemap.ts';

describe('registro legal', () => {
  test('deriva navegación y robots desde el estado de cada documento', () => {
    expect(legalNavItems.map((item) => item.href)).toEqual([
      legalDocuments.avisoLegal.href,
      legalDocuments.privacidad.href,
      legalDocuments.cookies.href,
      legalDocuments.condiciones.href,
    ]);
    expect(getLegalRobots({ status: 'draft' })).toBe('noindex,follow');
    expect(getLegalRobots({ status: 'inactive' })).toBe('noindex,nofollow');
    expect(getLegalRobots({ status: 'published' })).toBeUndefined();
    expect(visibleLegalNavItems.map((item) => item.href)).toEqual([
      legalDocuments.avisoLegal.href,
      legalDocuments.privacidad.href,
      legalDocuments.cookies.href,
      legalDocuments.condiciones.href,
    ]);
    expect(legalFooterNav.map((item) => item.href)).toEqual([
      legalDocuments.avisoLegal.href,
      legalDocuments.privacidad.href,
      legalDocuments.cookies.href,
      legalDocuments.condiciones.href,
    ]);
    expect(legalDocuments.cookies.status).toBe('published');
    expect(legalDocuments.condiciones.status).toBe('published');
    expect(legalDocuments.desistimiento.status).toBe('inactive');
  });

  test('excluye rutas internas y documentos no publicados con o sin barra final', () => {
    for (const pathname of ['/404', '/carrito/', '/desistimiento/']) {
      expect(isSitemapExcluded(pathname)).toBe(true);
    }

    expect(isSitemapExcluded('/')).toBe(false);
    expect(isSitemapExcluded('/ayuda/')).toBe(false);
    expect(isSitemapExcluded('/guia-de-tallas')).toBe(true);
    expect(isSitemapExcluded('/aviso-legal')).toBe(false);
    expect(isSitemapExcluded('/privacidad')).toBe(false);
    expect(isSitemapExcluded('/envios-y-devoluciones')).toBe(false);
    expect(isSitemapExcluded('/devoluciones')).toBe(false);
    expect(isSitemapExcluded('/condiciones')).toBe(false);
    expect(getLegalSitemapExcludedPaths()).toContain('/desistimiento');
    expect(getLegalSitemapExcludedPaths()).not.toContain('/cookies');
    expect(getLegalSitemapExcludedPaths()).not.toContain('/condiciones');
    expect(getLegalSitemapExcludedPaths()).not.toContain('/aviso-legal');
  });
});
