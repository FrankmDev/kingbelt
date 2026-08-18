import { describe, expect, test } from 'bun:test';
import { resolveColorSwatch } from '../src/commerce/domain/color-swatch.ts';

describe('resolveColorSwatch', () => {
  test('mapea los colores canónicos de KingBelt', () => {
    expect(resolveColorSwatch('Cuero')).toBe('#54332F');
    expect(resolveColorSwatch('Marrón')).toBe('#372E2E');
    expect(resolveColorSwatch('Negro')).toBe('#0B0A07');
    expect(resolveColorSwatch('Marino')).toBe('#131B23');
    expect(resolveColorSwatch('Taupe')).toBe('#80685D');
  });

  test('prioriza el canon sobre el swatch de origen', () => {
    expect(resolveColorSwatch('Negro', '#111111')).toBe('#0B0A07');
  });

  test('resuelve combinaciones con negro y marrón', () => {
    expect(resolveColorSwatch('Negro / marrón')).toContain('#0B0A07');
    expect(resolveColorSwatch('Negro / marrón')).toContain('#372E2E');
  });
});
