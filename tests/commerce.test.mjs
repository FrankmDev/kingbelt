import { describe, expect, test } from 'bun:test';
import { localCollections, localProducts } from '../src/data/catalog.ts';
import { addToCart, emptyCart, restoreCart, updateLineQuantity } from '../src/lib/commerce/cart-operations.ts';
import { filterProductSummaries, getCollectionFacets, normalizeFilterValue } from '../src/lib/commerce/catalog-filters.ts';
import { validateCatalog } from '../src/lib/commerce/catalog-validator.ts';
import { getSafeCheckoutUrl } from '../src/lib/commerce/checkout.ts';
import { createLocalCatalogProvider } from '../src/lib/commerce/local-catalog.ts';
import { createLocalCommerceProvider } from '../src/lib/commerce/local-provider.ts';
import {
  LOCAL_CART_STORAGE_KEY,
  persistCart,
  readPersistedCart,
} from '../src/lib/commerce/local-cart-storage.ts';
import { moneyFromDecimal, moneyFromMajor } from '../src/lib/commerce/money.ts';
import { toProductSummary } from '../src/lib/commerce/product-mapper.ts';
import {
  calculatePriceRange,
  getCompatibleOptionValues,
  getFirstAvailableVariant,
  getMaxSelectableQuantity,
  getVariantBySelectedOptions,
  reconcileSelectedOptions,
} from '../src/lib/commerce/product-variants.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const collectionRef = { id: 'collection:test', handle: 'test', title: 'Test' };
const placeholderImage = {
  url: '/image.jpg',
  altText: 'Imagen de prueba',
  width: 960,
  height: 1200,
  placeholder: true,
};

const variant = (id, sku, color, size, price = 8900, availableForSale = true, quantityAvailable = 10) => ({
  id,
  sku,
  selectedOptions: [{ name: 'Color', value: color }, { name: 'Talla', value: size }],
  price: { amountMinor: price, currency: 'EUR' },
  availableForSale,
  ...(quantityAvailable === null ? {} : { quantityAvailable }),
  image: placeholderImage,
});

const makeProduct = ({ id = 'product:test', handle = 'producto-test', reference = 'KB-TEST', variants, productType = 'Piel lisa' }) => {
  const colors = [...new Set(variants.map((item) => item.selectedOptions.find((option) => option.name === 'Color').value))]
    .map((value) => ({ value, swatch: '#111111' }));
  const sizes = [...new Set(variants.map((item) => item.selectedOptions.find((option) => option.name === 'Talla').value))]
    .map((value) => ({ value }));
  return {
    id,
    handle,
    title: 'Producto de prueba',
    reference,
    description: 'Descripción de prueba.',
    shortDescription: 'Resumen de prueba.',
    vendor: 'KingBelt',
    productType,
    primaryCollection: collectionRef,
    collections: [collectionRef],
    options: [
      { id: `${id}:color`, name: 'Color', values: colors },
      { id: `${id}:size`, name: 'Talla', values: sizes },
    ],
    variants,
    primaryImage: placeholderImage,
    gallery: [placeholderImage],
    specifications: [],
    priceRange: calculatePriceRange(variants),
    availableForSale: variants.some((item) => item.availableForSale),
    colors,
    seo: {},
  };
};

const asymmetricProduct = makeProduct({
  variants: [
    variant('variant:black-100', 'SKU-BLACK-100', 'Negro', '100', 8900, false, 0),
    variant('variant:black-95', 'SKU-BLACK-95', 'Negro', '95', 8900, true, 3),
    variant('variant:brown-95', 'SKU-BROWN-95', 'Marrón', '95', 9500, true, null),
  ],
});

const findLocalVariant = (handle, color, size) => {
  const product = localProducts.find((item) => item.handle === handle);
  return product?.variants.find((item) =>
    item.selectedOptions.some((option) => option.name === 'Color' && option.value === color) &&
    item.selectedOptions.some((option) => option.name === 'Talla' && option.value === size)
  );
};

describe('dinero y precios', () => {
  test('convierte decimales a unidades mínimas de forma segura', () => {
    expect(moneyFromMajor(10.01)).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(moneyFromDecimal('10.01')).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(moneyFromDecimal('10.1')).toEqual({ amountMinor: 1010, currency: 'EUR' });
    expect(() => moneyFromDecimal('10.001')).toThrow();
  });

  test('calcula precio único y rango de variantes', () => {
    const single = calculatePriceRange([
      variant('v1', 'S1', 'Negro', '95'),
      variant('v2', 'S2', 'Negro', '100'),
    ]);
    expect(single.min.amountMinor).toBe(8900);
    expect(single.max.amountMinor).toBe(8900);
    expect(asymmetricProduct.priceRange).toEqual({
      min: { amountMinor: 8900, currency: 'EUR' },
      max: { amountMinor: 9500, currency: 'EUR' },
    });
  });
});

describe('variantes reales', () => {
  test('resuelve una combinación válida y rechaza una inexistente', () => {
    expect(getVariantBySelectedOptions(asymmetricProduct, [
      { name: 'Color', value: 'Negro' },
      { name: 'Talla', value: '95' },
    ])?.id).toBe('variant:black-95');
    expect(getVariantBySelectedOptions(asymmetricProduct, [
      { name: 'Color', value: 'Marrón' },
      { name: 'Talla', value: '100' },
    ])).toBeUndefined();
  });

  test('distingue agotado de stock desconocido y calcula máximos', () => {
    expect(getMaxSelectableQuantity(asymmetricProduct.variants[0])).toBe(0);
    expect(asymmetricProduct.variants[0].availableForSale).toBe(false);
    expect(getMaxSelectableQuantity(asymmetricProduct.variants[2])).toBe(99);
  });

  test('elige la primera variante disponible', () => {
    expect(getFirstAvailableVariant(asymmetricProduct)?.id).toBe('variant:black-95');
  });

  test('un cambio de color invalida una talla incompatible', () => {
    const reconciled = reconcileSelectedOptions(asymmetricProduct, [
      { name: 'Color', value: 'Marrón' },
      { name: 'Talla', value: '100' },
    ], 'Color');
    expect(reconciled).toEqual([{ name: 'Color', value: 'Marrón' }]);
    expect(getCompatibleOptionValues(asymmetricProduct, reconciled, 'Talla')).toEqual(['95']);
  });
});

describe('carrito por identidad de variante', () => {
  const atlasVariant = findLocalVariant('cinturon-atlas', 'Negro', '85');
  const limitedVariant = findLocalVariant('cinturon-bandera', 'Marrón / detalle tricolor', '85');
  const soldOutVariant = findLocalVariant('cinturon-garaje', 'Negro / acero', '85');

  test('rechaza IDs manipulados y variantes agotadas', () => {
    expect(addToCart(emptyCart(), { variantId: 'javascript:alert(1)', quantity: 1 }).error?.code).toBe('not_found');
    expect(addToCart(emptyCart(), { variantId: soldOutVariant.id, quantity: 1 }).error?.code).toBe('out_of_stock');
  });

  test('resuelve la variante por ID y ajusta una cantidad al stock', () => {
    const added = addToCart(emptyCart(), { variantId: limitedVariant.id, quantity: 1 });
    expect(added.success).toBe(true);
    expect(added.cart.lines[0].variantId).toBe(limitedVariant.id);
    const updated = updateLineQuantity(added.cart, added.cart.lines[0].id, 3);
    expect(updated.success).toBe(true);
    expect(updated.adjustedQuantity).toBe(2);
  });

  test('restaura una línea únicamente por ID de variante', () => {
    const cart = restoreCart([{ variantId: atlasVariant.id, quantity: 2 }]);
    expect(cart.lines[0].variantId).toBe(atlasVariant.id);
    expect(cart.lines[0].product.reference).toBe('KB-VESTIR-001');
  });
});

describe('persistencia no autoritativa y migración', () => {
  const atlasVariant = findLocalVariant('cinturon-atlas', 'Negro', '85');

  test('persiste solo variantId y cantidad', () => {
    const storage = new MemoryStorage();
    const result = addToCart(emptyCart(), { variantId: atlasVariant.id, quantity: 1 });
    persistCart(storage, result.cart);
    const raw = storage.getItem(LOCAL_CART_STORAGE_KEY);
    expect(raw).toContain(`"variantId":"${atlasVariant.id}"`);
    expect(raw).not.toContain('unitPrice');
    expect(raw).not.toContain('Cinturón Atlas');
    expect(raw).not.toContain('color');
    expect(readPersistedCart(storage).source).toBe('current');
  });

  test('migra productId + color + size sin confiar en datos guardados', async () => {
    const storage = new MemoryStorage();
    storage.setItem('kingbelt-cart-v3', JSON.stringify({
      version: 3,
      lines: [{ productId: 'kb-vestir-001', color: 'Negro', size: '85', quantity: 1, price: 1 }],
    }));
    const cart = await createLocalCommerceProvider({ storage }).initialize();
    expect(cart.lines[0].variantId).toBe(atlasVariant.id);
    expect(cart.lines[0].product.title).toBe('Cinturón Atlas');
    expect(cart.lines[0].product.unitPrice.amountMinor).toBe(8900);
    expect(storage.getItem(LOCAL_CART_STORAGE_KEY)).toContain('variantId');
  });

  test('descarta y notifica una línea antigua que no puede migrarse', async () => {
    const storage = new MemoryStorage();
    storage.setItem('kingbelt-cart-v3', JSON.stringify({
      version: 3,
      lines: [{ productId: 'kb-vestir-001', color: 'Marrón inexistente', size: '85', quantity: 1 }],
    }));
    const cart = await createLocalCommerceProvider({ storage }).initialize();
    expect(cart.lines).toHaveLength(0);
    expect(cart.globalNotice).toContain('no pudo migrarse');
  });

  test('descarta payloads sobredimensionados o cantidades inválidas', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify({ version: 4, lines: [{ variantId: atlasVariant.id, quantity: 100 }] }));
    expect(readPersistedCart(storage).source).toBe('current');
    expect(readPersistedCart(storage).discardedCount).toBe(1);
  });
});

describe('validación de catálogo', () => {
  test('el catálogo local no tiene errores', () => {
    expect(validateCatalog(localProducts, localCollections)).toEqual([]);
  });

  test('detecta SKU, handle y combinación de opciones duplicados', () => {
    const duplicateCombination = {
      ...asymmetricProduct.variants[1],
      id: 'variant:duplicate-combination',
      sku: 'SKU-UNIQUE-COMBINATION',
    };
    const productWithCombination = makeProduct({ variants: [...asymmetricProduct.variants, duplicateCombination] });
    const productWithDuplicateSku = makeProduct({
      id: 'product:sku',
      handle: 'producto-sku',
      reference: 'KB-SKU',
      variants: [
        variant('variant:sku-a', 'SKU-DUP', 'Negro', '95'),
        variant('variant:sku-b', 'SKU-DUP', 'Negro', '100'),
      ],
    });
    const duplicateHandle = makeProduct({
      id: 'product:handle-2',
      handle: productWithDuplicateSku.handle,
      reference: 'KB-HANDLE-2',
      variants: [variant('variant:handle', 'SKU-HANDLE', 'Negro', '95')],
    });
    const codes = validateCatalog([productWithCombination, productWithDuplicateSku, duplicateHandle], []).map((issue) => issue.code);
    expect(codes).toContain('duplicate_option_combination');
    expect(codes).toContain('duplicate_sku');
    expect(codes).toContain('duplicate_product_handle');
  });
});

describe('filtros normalizados', () => {
  test('filtra por tipo, color y rango y normaliza acentos/mayúsculas', () => {
    const summaries = localProducts.map(toProductSummary);
    const result = filterProductSummaries(summaries, {
      productTypes: ['EDICION'],
      colors: ['MARRON / DETALLE TRICOLOR'],
      priceRange: 'gt-90',
    });
    expect(result.map((product) => product.handle)).toContain('cinturon-bandera');
    expect(normalizeFilterValue('  Coñac  ')).toBe('conac');
    expect(getCollectionFacets(result).colors.length).toBeGreaterThan(0);
  });
});

describe('redirección de checkout', () => {
  test('solo permite HTTPS y un host exacto declarado por el proveedor', () => {
    expect(getSafeCheckoutUrl({ status: 'idle', url: 'https://checkout.example.com/cart/1', allowedHosts: ['checkout.example.com'] })?.hostname).toBe('checkout.example.com');
    expect(getSafeCheckoutUrl({ status: 'idle', url: 'https://checkout.example.com.evil.test/cart/1', allowedHosts: ['checkout.example.com'] })).toBeNull();
    expect(getSafeCheckoutUrl({ status: 'idle', url: 'http://checkout.example.com/cart/1', allowedHosts: ['checkout.example.com'] })).toBeNull();
  });
});

const buildSyntheticCatalog = () => {
  const syntheticCollection = {
    id: 'collection:scale',
    handle: 'escala',
    title: 'Escala',
    description: 'Colección sintética no renderizada.',
    image: placeholderImage,
    productHandles: [],
  };
  let remainingGroupIndex = 0;
  const products = Array.from({ length: 70 }, (_, productIndex) => {
    const groupCount = productIndex < 62 ? 4 : 3;
    const variants = [];
    for (let colorIndex = 0; colorIndex < groupCount; colorIndex += 1) {
      const sizeCount = productIndex === 0 ? 19 : remainingGroupIndex++ < 149 ? 6 : 5;
      for (let sizeIndex = 0; sizeIndex < sizeCount; sizeIndex += 1) {
        variants.push(variant(
          `scale:variant:${productIndex}:${colorIndex}:${sizeIndex}`,
          `SCALE-${productIndex}-${colorIndex}-${sizeIndex}`,
          `Color ${colorIndex}`,
          `Talla ${sizeIndex}`,
          5000 + ((productIndex + colorIndex + sizeIndex) % 7) * 100,
          true,
          20
        ));
      }
    }
    const product = makeProduct({
      id: `scale:product:${productIndex}`,
      handle: `producto-escala-${productIndex}`,
      reference: `SCALE-${productIndex}`,
      variants,
      productType: productIndex % 2 === 0 ? 'Tipo par' : 'Tipo impar',
    });
    product.primaryCollection = { id: syntheticCollection.id, handle: syntheticCollection.handle, title: syntheticCollection.title };
    product.collections = [product.primaryCollection];
    syntheticCollection.productHandles.push(product.handle);
    return product;
  });
  return { products, collections: [syntheticCollection] };
};

describe('catálogo sintético de escala prevista', () => {
  test('opera con 70 productos, 272 grupos, 1.565 variantes y máximo 76', async () => {
    const source = buildSyntheticCatalog();
    const variants = source.products.flatMap((product) => product.variants);
    const colorGroups = new Set(variants.map((item) => {
      const productId = item.id.split(':').slice(0, 4).join(':');
      const color = item.selectedOptions.find((option) => option.name === 'Color').value;
      return `${productId}|${color}`;
    }));
    expect(source.products).toHaveLength(70);
    expect(colorGroups.size).toBe(272);
    expect(variants).toHaveLength(1565);
    expect(Math.max(...source.products.map((product) => product.variants.length))).toBe(76);
    expect(new Set(source.products.map((product) => product.id)).size).toBe(70);
    expect(new Set(variants.map((item) => item.id)).size).toBe(1565);
    expect(new Set(variants.map((item) => item.sku)).size).toBe(1565);
    expect(validateCatalog(source.products, source.collections)).toEqual([]);

    const provider = createLocalCatalogProvider({ products: source.products, collections: source.collections });
    expect((await provider.getProductHandles())).toHaveLength(70);
    const resolved = await provider.getProductByHandle('producto-escala-0');
    expect(resolved.variants).toHaveLength(76);
    expect(getVariantBySelectedOptions(resolved, resolved.variants[0].selectedOptions)?.id).toBe(resolved.variants[0].id);
    expect(getVariantBySelectedOptions(resolved, [{ name: 'Color', value: 'inexistente' }, { name: 'Talla', value: 'Talla 0' }])).toBeUndefined();
    expect(resolved.priceRange.min.amountMinor).toBeLessThan(resolved.priceRange.max.amountMinor);

    const page = await provider.getCollectionByHandle('escala');
    expect(page.products).toHaveLength(70);
    expect(page.products.every((summary) => !('variants' in summary))).toBe(true);
    expect(JSON.stringify(page.products)).not.toContain('"variants"');
    expect(filterProductSummaries(page.products, { productTypes: ['tipo par'], colors: ['color 0'] }).length).toBe(35);
  });
});
