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
  test('la lista de hosts transformables está vacía por defecto', () => {
    expect(imagePolicy.transformableHosts).toEqual([]);
  });

  test('devuelve la URL original sin tocar mientras no haya CDN autorizado', () => {
    expect(buildOptimizedImageUrl(LOCAL_URL, 480)).toBe(LOCAL_URL);
    expect(buildOptimizedImageUrl(REMOTE_URL, 480)).toBe(REMOTE_URL);
    expect(buildThumbnailUrl(REMOTE_URL)).toBe(REMOTE_URL);
  });

  test('no genera srcset cuando el host no es transformable', () => {
    expect(buildImageSrcset(LOCAL_URL)).toBeNull();
    expect(buildImageSrcset(REMOTE_URL)).toBeNull();
  });

  test('el source de slide cae a una única src sin srcset ni sizes', () => {
    const source = buildSlideSource(REMOTE_URL, '(min-width: 48rem) 52vw, 100vw');
    expect(source.src).toBe(REMOTE_URL);
    expect(source.srcset).toBeNull();
    expect(source.sizes).toBeNull();
  });

  test('el source de tarjeta cae a una única src sin srcset ni sizes', () => {
    const source = buildCardSource(LOCAL_URL, '100vw');
    expect(source.src).toBe(LOCAL_URL);
    expect(source.srcset).toBeNull();
    expect(source.sizes).toBeNull();
  });
});
