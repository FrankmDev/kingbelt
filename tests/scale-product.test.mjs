import { describe, expect, test } from 'bun:test';
import { validateCatalog } from '../src/commerce/application/catalog-validation.ts';
import { getVariantAvailability } from '../src/commerce/domain/inventory.ts';
import { getVariantGallery } from '../src/commerce/domain/product-media.ts';
import { toCompactPublicBuyBoxPayload } from '../src/commerce/domain/product-mappers.ts';
import { getVariantBySelectedOptions } from '../src/commerce/domain/variants.ts';
import { scaleProduct } from './fixtures/scale-product.ts';

const scaleCollection = {
  id: 'scale:collection',
  handle: 'escala',
  title: 'Escala',
  description: 'Colección técnica aislada.',
};

describe('ficha máxima renderizable', () => {
  test('conserva 76 variantes declaradas sin crear combinaciones inexistentes', () => {
    expect(validateCatalog([scaleProduct], [scaleCollection])).toEqual([]);
    expect(scaleProduct.variants).toHaveLength(76);

    const valid = getVariantBySelectedOptions(scaleProduct, [
      { optionId: 'scale:option:color', valueId: 'scale:color:0' },
      { optionId: 'scale:option:size', valueId: 'scale:size:85' },
    ]);
    const missing = getVariantBySelectedOptions(scaleProduct, [
      { optionId: 'scale:option:color', valueId: 'scale:color:0' },
      { optionId: 'scale:option:size', valueId: 'scale:size:80' },
    ]);

    expect(valid).toBeDefined();
    expect(missing).toBeUndefined();
    expect(getVariantGallery(scaleProduct, valid)).toHaveLength(3);
    expect(getVariantAvailability(valid)).toMatchObject({
      purchasable: true,
      minimum: 1,
      increment: 1,
    });
  });

  test('la proyección pública compacta omite datos administrativos y repetidos', () => {
    const payload = toCompactPublicBuyBoxPayload(scaleProduct);
    const serialized = JSON.stringify(payload);

    expect(payload.o).toEqual(['scale:option:color', 'scale:option:size']);
    expect(payload.v).toHaveLength(76);
    expect(payload.v.every((variant) => variant.length === 11)).toBe(true);
    expect(serialized).not.toMatch(/sku|inventory|vendor|title|name|description|cost/i);
    expect(new Set(payload.v.map((variant) => variant[2])).size).toBeGreaterThan(1);
    expect(new Set(payload.v.map((variant) => variant[4])).size).toBe(4);
    expect(new Set(payload.v.map((variant) => variant[5]).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
  });
});
