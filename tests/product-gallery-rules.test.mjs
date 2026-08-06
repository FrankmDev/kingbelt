import { describe, expect, test } from 'bun:test';
import { buildProductGalleryRules } from '../src/components/product/build-product-gallery-rules.ts';
import {
  escapeCssAttributeValue,
  escapeCssIdentifier,
  escapeStyleElementContent,
} from '../src/shared/css/css-identifier.ts';

describe('utilidades CSS de build', () => {
  test('escapa identificadores y valores de atributo para selectores generados', () => {
    expect(escapeCssIdentifier('cinturon-atlas')).toBe('cinturon-atlas');
    expect(escapeCssIdentifier('foo:bar')).toBe('foo\\:bar');
    expect(escapeCssAttributeValue('value"break')).toBe('value\\"break');
    expect(escapeStyleElementContent('</style><script>alert(1)</script>')).not.toContain('<');
  });

  test('no permite cerrar el style con identificadores manipulados', () => {
    const rules = buildProductGalleryRules({
      idPrefix: 'demo',
      images: [{ id: 'img-1', url: '/a.jpg', altText: 'A', width: 1, height: 1 }],
      mediaGroups: [{
        id: '</style><script>alert(1)</script>',
        optionValueId: '</style><img src=x onerror=alert(1)>',
        imageIds: ['img-1'],
      }],
    });

    expect(rules).not.toContain('<');
    expect(rules).not.toContain('>');
    expect(rules).not.toContain('</style>');
  });
});

describe('reglas CSS de galería de producto', () => {
  test('genera selectores escapados para ids con caracteres especiales', () => {
    const rules = buildProductGalleryRules({
      idPrefix: 'cinturon:demo',
      images: [
        { id: 'img-1', url: '/a.jpg', altText: 'A', width: 1, height: 1 },
        { id: 'img-2', url: '/b.jpg', altText: 'B', width: 1, height: 1 },
      ],
      mediaGroups: [
        {
          id: 'group-"a"',
          optionValueId: 'color-"negro"',
          imageIds: ['img-1'],
        },
      ],
    });

    expect(rules).toContain('product-gallery--cinturon\\:demo');
    expect(rules).toContain('[value="color-\\"negro\\""]');
    expect(rules).toContain('[data-gallery-media-group="group-\\"a\\""]');
    expect(rules).not.toContain('color-"negro"');
  });
});
