import { describe, expect, test } from 'bun:test';
import { imagePolicy } from '../src/config/images.ts';
import {
  buildCardSource,
  buildImageSrcset,
  buildOptimizedImageUrl,
  buildSlideSource,
  buildThumbnailUrl,
} from '../src/shared/image-source.ts';

const LOCAL_URL = '/images/productos/cinturon-atlas.jpg';
const REMOTE_URL = 'https://cdn.shopify.com/s/files/1/0000/0000/files/atlas.jpg';

describe('política de transformación de imágenes', () => {
  test('solo transforma el CDN exacto observado en el catálogo Shopify', () => {
    expect(imagePolicy.transformableHosts).toEqual(['cdn.shopify.com']);
  });

  test('conserva local y transforma Shopify con parámetros deterministas', () => {
    expect(buildOptimizedImageUrl(LOCAL_URL, 480)).toBe(LOCAL_URL);
    expect(buildOptimizedImageUrl(REMOTE_URL, 480)).toContain('width=480');
    expect(buildOptimizedImageUrl(REMOTE_URL, 480)).toContain('height=600');
    expect(buildThumbnailUrl(REMOTE_URL)).toContain('width=240');
  });

  test('genera srcset solo cuando el host es transformable', () => {
    expect(buildImageSrcset(LOCAL_URL)).toBeNull();
    expect(buildImageSrcset(REMOTE_URL)).toContain('1280w');
  });

  test('el source de slide usa las capacidades del CDN Shopify', () => {
    const source = buildSlideSource(REMOTE_URL, '(min-width: 64rem) 28rem, (min-width: 48rem) 22rem, 100vw');
    expect(source.src).toContain('width=1280');
    expect(source.srcset).toContain('480w');
    expect(source.sizes).toBe('(min-width: 64rem) 28rem, (min-width: 48rem) 22rem, 100vw');
  });

  test('el source de tarjeta cae a una única src sin srcset ni sizes', () => {
    const source = buildCardSource(LOCAL_URL, '100vw');
    expect(source.src).toBe(LOCAL_URL);
    expect(source.srcset).toBeNull();
    expect(source.sizes).toBeNull();
  });
});
