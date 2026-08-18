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
      colorGalleries: [{
        optionValueId: '</style><img src=x onerror=alert(1)>',
        images: [{ id: 'img-1', url: '/a.jpg', altText: 'A', width: 1, height: 1 }],
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
      colorGalleries: [
        {
          optionValueId: 'color-"negro"',
          images: [
            { id: 'img-1', url: '/a.jpg', altText: 'A', width: 1, height: 1 },
            { id: 'img-2', url: '/b.jpg', altText: 'B', width: 1, height: 1 },
          ],
        },
      ],
    });

    expect(rules).toContain('product-gallery--cinturon\\:demo');
    expect(rules).toContain('[data-gallery-set="color-\\"negro\\""]');
    expect(rules).not.toContain('color-"negro"');
  });

  test('genera reglas de visibilidad para cada slide', () => {
    const rules = buildProductGalleryRules({
      idPrefix: 'atlas',
      colorGalleries: [
        {
          optionValueId: 'color-negro',
          images: [{ id: 'img-1', url: '/a.jpg', altText: 'A', width: 1, height: 1 }],
        },
        {
          optionValueId: 'color-marron',
          images: [{ id: 'img-2', url: '/b.jpg', altText: 'B', width: 1, height: 1 }],
        },
      ],
    });

    expect(rules).toContain('.product-gallery__slide{opacity:0;visibility:hidden}');
    expect(rules).toContain(
      '.product-gallery--atlas:has(#gallery-atlas-set-1-1:checked) [data-gallery-set="color-negro"] .product-gallery__stage .product-gallery__slide:nth-child(1){opacity:1;visibility:visible}'
    );
    expect(rules).toContain(
      '.product-gallery--atlas [data-gallery-set="color-negro"]:not(:has(.product-gallery__input:checked)) .product-gallery__stage .product-gallery__slide:first-child{opacity:1;visibility:visible}'
    );
    expect(rules).not.toContain(
      '.product-gallery--atlas:has(#gallery-atlas-set-1-1:checked) .product-gallery--atlas [data-gallery-set'
    );
  });
});
