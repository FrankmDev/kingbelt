import { describe, expect, test } from 'bun:test';
import {
  getLegalRobots,
  isSitemapExcluded,
  legalDocuments,
  legalNavItems,
} from '../src/data/legal.ts';

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
  });

  test('excluye rutas internas y documentos no publicados con o sin barra final', () => {
    for (const pathname of [
      '/404',
      '/carrito/',
      '/style-museum',
      '/aviso-legal/',
      '/envios-y-devoluciones',
      '/desistimiento/',
    ]) {
      expect(isSitemapExcluded(pathname)).toBe(true);
    }

    expect(isSitemapExcluded('/')).toBe(false);
    expect(isSitemapExcluded('/ayuda/')).toBe(false);
    expect(isSitemapExcluded('/guia-de-tallas')).toBe(false);
  });
});
