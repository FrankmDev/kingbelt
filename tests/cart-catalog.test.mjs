import { describe, expect, test } from 'bun:test';
import { demoCollections, demoProducts } from '../src/demo-catalog.ts';
import {
  createCartCatalog,
  parseCartCatalogSnapshot,
  toCartCatalogSnapshot,
} from '../src/commerce/application/cart-catalog.ts';
import { createDemoCartAdapter } from '../src/commerce/infrastructure/demo/demo-cart-adapter.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const shopifyVariantId = 'gid://shopify/ProductVariant/5568';

const shopifySnapshot = () => {
  const product = structuredClone(demoProducts[0]);
  product.variants[0].id = shopifyVariantId;
  return toCartCatalogSnapshot([product], demoCollections);
};

describe('snapshot de catálogo para el carrito', () => {
  test('reconstruye las variantes del catálogo publicado', () => {
    const variant = demoProducts[0].variants[0];
    const catalog = parseCartCatalogSnapshot(toCartCatalogSnapshot(demoProducts, demoCollections));

    expect(catalog?.getVariant(variant.id)?.product.handle).toBe(demoProducts[0].handle);
    expect(catalog?.getVariant(variant.id)?.variant.sku).toBe(variant.sku);
  });

  test('rechaza un payload incompleto o corrupto', () => {
    expect(parseCartCatalogSnapshot(null)).toBeUndefined();
    expect(parseCartCatalogSnapshot({ products: [], collections: [{ id: 'x' }] })).toBeUndefined();
    expect(parseCartCatalogSnapshot({
      collections: demoCollections.map(({ id, handle, title }) => ({ id, handle, title })),
      products: [{ id: 'product:x', variants: [] }],
    })).toBeUndefined();
  });

  test('resuelve un ID de variante Shopify tras cargar el snapshot', async () => {
    const adapter = createDemoCartAdapter({
      storage: new MemoryStorage(),
      loadPublishedCatalog: async () => shopifySnapshot(),
    });

    await adapter.initialize();
    const result = await adapter.addItem({ variantId: shopifyVariantId, quantity: 1 });

    expect(result.success).toBe(true);
    expect(result.cart.lines[0]?.variantId).toBe(shopifyVariantId);
  });

  test('no inventa catálogo si el snapshot no carga y el ID no está en la demo', async () => {
    const adapter = createDemoCartAdapter({
      storage: new MemoryStorage(),
      loadPublishedCatalog: async () => ({ products: 'invalid' }),
    });

    await adapter.initialize();
    const missing = await adapter.addItem({ variantId: shopifyVariantId, quantity: 1 });
    const demoVariant = demoProducts[0].variants[0];
    const fallback = await adapter.addItem({ variantId: demoVariant.id, quantity: 1 });

    expect(missing.success).toBe(false);
    expect(missing.error?.code).toBe('not_found');
    expect(fallback.success).toBe(true);
  });

  test('el catálogo inyectado no se sustituye por la demo', () => {
    const product = structuredClone(demoProducts[0]);
    product.variants[0].id = shopifyVariantId;
    const catalog = createCartCatalog([product], demoCollections);

    expect(catalog.getVariant(shopifyVariantId)?.variant.id).toBe(shopifyVariantId);
    expect(catalog.getVariant(demoProducts[0].variants[0].id)).toBeUndefined();
  });
});
