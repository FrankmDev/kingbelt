import { describe, expect, test } from 'bun:test';
import { demoCollections, demoProducts } from '../src/demo-catalog.ts';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import { filterProductSummaries, getCollectionFacets, matchesCatalogSelection, matchesPriceRange, normalizeFilterValue, parseCatalogFilterParams, serializeCatalogFilterParams, toFilterableProduct, COLLECTION_PRICE_RANGES } from '../src/commerce/domain/catalog-filters.ts';
import {
  assertValidCatalog,
  CatalogValidationError,
  SHOPIFY_MAX_PRODUCT_OPTIONS,
  SHOPIFY_MAX_PRODUCT_VARIANTS,
  validateCatalog,
} from '../src/commerce/application/catalog-validation.ts';
import { COLOR_GALLERY_IMAGE_COUNT } from '../src/commerce/domain/catalog.ts';
import { getSafeCheckoutUrl } from '../src/commerce/application/checkout.ts';
import {
  createDemoCatalogAdapter,
  demoCartCatalog,
} from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';
import { createDemoCartAdapter } from '../src/commerce/infrastructure/demo/demo-cart-adapter.ts';
import {
  LOCAL_CART_STORAGE_KEY,
  persistCart,
  readPersistedCart,
} from '../src/commerce/infrastructure/demo/cart-storage.ts';
import { getVariantAvailability } from '../src/commerce/domain/inventory.ts';
import { moneyFromDecimal, moneyFromMajor, moneyToDecimal, multiplyMoney, sumMoney } from '../src/commerce/domain/money.ts';
import { getProductGalleryImages, getVariantGallery, getVariantImage, getColorGalleries } from '../src/commerce/domain/product-media.ts';
import { toCollectionReference, toProductSummary } from '../src/commerce/domain/product-mappers.ts';
import {
  calculatePriceRange,
  getCompatibleOptionValues,
  getFirstAvailableVariant,
  getMaxSelectableQuantity,
  getVariantBySelectedOptions,
  reconcileSelectedOptions,
} from '../src/commerce/domain/variants.ts';

const { addToCart, restoreCart, updateLineQuantity } = createCartService(demoCartCatalog);

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const collection = {
  id: 'collection:test',
  handle: 'test',
  title: 'Test',
  description: 'Colección de prueba.',
};
const collectionRef = toCollectionReference(collection);
const colorOptionId = 'option:color';
const sizeOptionId = 'option:size';
const colorId = (label) => `color:${label}`;
const sizeId = (label) => `size:${label}`;

const productImage = (id) => ({
  id,
  url: '/images/brand/cinturones-en-taller.jpg',
  altText: 'Imagen de prueba',
  width: 960,
  height: 1200,
});

const variant = ({
  id,
  sku,
  color,
  size,
  price = 8_900,
  salesStatus = 'active',
  quantity = 10,
  inventoryPolicy = 'deny',
  quantityRule = { minimum: 1, increment: 1 },
  compareAtPrice,
  imageId = 'image:test',
}) => ({
  id,
  sku,
  optionValues: [
    { optionId: colorOptionId, valueId: colorId(color) },
    { optionId: sizeOptionId, valueId: sizeId(size) },
  ],
  price: { amountMinor: price, currency: 'EUR' },
  ...(compareAtPrice ? { compareAtPrice: { amountMinor: compareAtPrice, currency: 'EUR' } } : {}),
  salesStatus,
  inventory: quantity === null ? { kind: 'unknown' } : { kind: 'known', quantity },
  inventoryPolicy,
  quantityRule,
  imageId,
});

const labelFromId = (valueId) => valueId.slice(valueId.indexOf(':') + 1);

const makeProduct = ({
  id = 'product:test',
  handle = 'producto-test',
  reference = 'KB-TEST',
  variants,
  productType = 'Piel lisa',
  collectionId = collection.id,
}) => {
  const colors = [...new Set(variants.map((item) =>
    labelFromId(item.optionValues.find((option) => option.optionId === colorOptionId).valueId)
  ))].map((label) => ({ id: colorId(label), label, swatch: '#111111' }));
  const sizes = [...new Set(variants.map((item) =>
    labelFromId(item.optionValues.find((option) => option.optionId === sizeOptionId).valueId)
  ))].map((label) => ({ id: sizeId(label), label }));
  const galleries = colors.map((color) => ({
    color,
    images: Array.from({ length: 3 }, (_, index) => productImage(`${id}:image:${color.id}:${index}`)),
  }));
  const primaryImageByColor = new Map(galleries.map(({ color, images }) => [color.id, images[0].id]));
  const normalizedVariants = variants.map((item) => {
    const selectedColor = item.optionValues.find((option) => option.optionId === colorOptionId)?.valueId;
    return { ...item, imageId: primaryImageByColor.get(selectedColor) };
  });
  const images = galleries.flatMap((gallery) => gallery.images);
  return {
    id,
    handle,
    title: 'Producto de prueba',
    reference,
    description: 'Descripción de prueba.',
    summary: 'Resumen de prueba.',
    vendor: 'KingBelt',
    productType,
    category: { id: 'category:belts', name: 'Cinturones' },
    publicationStatus: 'published',
    primaryCollectionId: collectionId,
    collectionIds: [collectionId],
    options: [
      { id: colorOptionId, name: 'Color', purpose: 'color', values: colors },
      { id: sizeOptionId, name: 'Talla', purpose: 'size', values: sizes },
    ],
    variants: normalizedVariants,
    images,
    primaryImageId: images[0].id,
    mediaGroups: galleries.map(({ color, images: galleryImages }) => ({
      id: `${id}:media:${color.id}`,
      optionValueId: color.id,
      imageIds: galleryImages.map((image) => image.id),
    })),
    specifications: [],
  };
};

const asymmetricProduct = makeProduct({
  variants: [
    variant({ id: 'variant:black-100', sku: 'SKU-BLACK-100', color: 'Negro', size: '100', salesStatus: 'active', quantity: 0 }),
    variant({ id: 'variant:black-95', sku: 'SKU-BLACK-95', color: 'Negro', size: '95', quantity: 3 }),
    variant({ id: 'variant:brown-95', sku: 'SKU-BROWN-95', color: 'Marrón', size: '95', price: 9_500, quantity: null }),
  ],
});

const optionLabel = (product, variantValue, purpose) => {
  const option = product.options.find((item) => item.purpose === purpose);
  const selection = variantValue.optionValues.find((item) => item.optionId === option?.id);
  return option?.values.find((item) => item.id === selection?.valueId)?.label;
};

const findDemoVariant = (handle, color, size) => {
  const product = demoProducts.find((item) => item.handle === handle);
  return product?.variants.find((item) =>
    optionLabel(product, item, 'color') === color && optionLabel(product, item, 'size') === size
  );
};

describe('dinero y precios', () => {
  test('convierte decimales a unidades mínimas de forma segura', () => {
    expect(moneyFromMajor(10.01)).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(moneyFromDecimal('10.01')).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(moneyFromDecimal('10.1')).toEqual({ amountMinor: 1010, currency: 'EUR' });
    expect(moneyFromDecimal('100', 'JPY')).toEqual({ amountMinor: 100, currency: 'JPY' });
    expect(moneyFromDecimal('1.234', 'BHD')).toEqual({ amountMinor: 1_234, currency: 'BHD' });
    expect(moneyToDecimal({ amountMinor: 1_234, currency: 'BHD' })).toBe('1.234');
    expect(() => moneyFromDecimal('10.001')).toThrow();
    expect(() => moneyFromMajor(Number.MAX_SAFE_INTEGER)).toThrow();
    expect(() => multiplyMoney({ amountMinor: Number.MAX_SAFE_INTEGER, currency: 'EUR' }, 2)).toThrow();
    expect(() => sumMoney([
      { amountMinor: Number.MAX_SAFE_INTEGER, currency: 'EUR' },
      { amountMinor: 1, currency: 'EUR' },
    ])).toThrow();
    expect(() => sumMoney([
      { amountMinor: 100, currency: 'EUR' },
      { amountMinor: 100, currency: 'USD' },
    ])).toThrow();
  });

  test('calcula precios variables sin almacenar un rango redundante en Product', () => {
    expect(calculatePriceRange(asymmetricProduct.variants)).toEqual({
      min: { amountMinor: 8_900, currency: 'EUR' },
      max: { amountMinor: 9_500, currency: 'EUR' },
    });
    expect('priceRange' in asymmetricProduct).toBe(false);
    expect(() => calculatePriceRange([
      asymmetricProduct.variants[0],
      { ...asymmetricProduct.variants[1], price: { amountMinor: 8_900, currency: 'USD' } },
    ])).toThrow();
  });
});

describe('variantes reales y opciones dispersas', () => {
  test('resuelve una combinación declarada y no genera una inexistente', () => {
    expect(getVariantBySelectedOptions(asymmetricProduct, [
      { optionId: colorOptionId, valueId: colorId('Negro') },
      { optionId: sizeOptionId, valueId: sizeId('95') },
    ])?.id).toBe('variant:black-95');
    expect(getVariantBySelectedOptions(asymmetricProduct, [
      { optionId: colorOptionId, valueId: colorId('Marrón') },
      { optionId: sizeOptionId, valueId: sizeId('100') },
    ])).toBeUndefined();
  });

  test('distingue combinación inexistente, agotada, stock desconocido y venta sin stock', () => {
    const soldOut = asymmetricProduct.variants[0];
    const unknown = asymmetricProduct.variants[2];
    const backorder = {
      ...soldOut,
      id: 'variant:backorder',
      sku: 'SKU-BACKORDER',
      inventoryPolicy: 'continue',
    };
    expect(getVariantAvailability(soldOut)).toMatchObject({ status: 'out_of_stock', maxQuantity: 0, quantityKnown: true, backorder: false });
    expect(getVariantAvailability(unknown)).toMatchObject({ status: 'available', maxQuantity: 99, quantityKnown: false });
    expect(getVariantAvailability(backorder)).toMatchObject({ status: 'available', maxQuantity: 99, quantityKnown: true, backorder: true });
    expect(getMaxSelectableQuantity(backorder)).toBe(99);
  });

  test('un cambio de color invalida una talla incompatible sin ocultar variantes agotadas', () => {
    const reconciled = reconcileSelectedOptions(asymmetricProduct, [
      { optionId: colorOptionId, valueId: colorId('Marrón') },
      { optionId: sizeOptionId, valueId: sizeId('100') },
    ], colorOptionId);
    expect(reconciled).toEqual([{ optionId: colorOptionId, valueId: colorId('Marrón') }]);
    expect(getCompatibleOptionValues(asymmetricProduct, reconciled, sizeOptionId)).toEqual([sizeId('95')]);
    expect(getCompatibleOptionValues(asymmetricProduct, [
      { optionId: colorOptionId, valueId: colorId('Negro') },
    ], sizeOptionId)).toContain(sizeId('100'));
  });

  test('elige la primera variante realmente comprable', () => {
    expect(getFirstAvailableVariant(asymmetricProduct)?.id).toBe('variant:black-95');
  });

  test('soporta un producto de variante única sin opciones visibles', () => {
    const product = structuredClone(asymmetricProduct);
    product.options = [];
    product.mediaGroups = [];
    product.variants = [{
      ...product.variants[1],
      id: 'variant:single',
      sku: 'SKU-SINGLE',
      optionValues: [],
    }];
    expect(getVariantBySelectedOptions(product, [])?.id).toBe('variant:single');
    expect(validateCatalog([product], [collection])).toEqual([]);
  });
});

describe('medios canónicos por color y variante', () => {
  test('cada color demo resuelve su galería de tres imágenes sin duplicar objetos en variantes', () => {
    const product = demoProducts.find((item) => item.handle === 'cinturon-atlas');
    const black = findDemoVariant('cinturon-atlas', 'Negro', '85');
    const brown = findDemoVariant('cinturon-atlas', 'Marrón', '85');
    const blackGallery = getVariantGallery(product, black);
    const brownGallery = getVariantGallery(product, brown);
    expect(blackGallery).toHaveLength(3);
    expect(brownGallery).toHaveLength(3);
    expect(blackGallery[0].id).not.toBe(brownGallery[0].id);
    expect(getVariantImage(product, black)?.id).toBe(black.imageId);
    expect('image' in black).toBe(false);
    expect(getProductGalleryImages(product).map((image) => image.id)).toEqual(
      product.mediaGroups.flatMap((group) => group.imageIds)
    );
    expect(getColorGalleries(product)).toHaveLength(product.mediaGroups.length);
    expect(getColorGalleries(product)[0].images).toHaveLength(3);
  });

  test('ordena la ficha por mediaGroups aunque Product.images llegue en otro orden', () => {
    const product = structuredClone(asymmetricProduct);
    product.images = [...product.images].reverse();
    expect(getProductGalleryImages(product)[0].id).toBe(product.mediaGroups[0].imageIds[0]);
    expect(getProductGalleryImages(product).map((image) => image.id)).toEqual(
      product.mediaGroups.flatMap((group) => group.imageIds)
    );
  });

  test('rechaza una imagen de variante ajena a la galería de su color', () => {
    const product = structuredClone(asymmetricProduct);
    const independent = productImage('image:variant-specific');
    product.images.push(independent);
    product.variants[0].imageId = independent.id;
    expect(getVariantGallery(product, product.variants[0])[0].id).toBe(independent.id);
    expect(validateCatalog([product], [collection]).map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['variant_color_image_mismatch'])
    );
  });

  test('rechaza galerías de color vacías o sin relación con la variante', () => {
    const invalid = structuredClone(asymmetricProduct);
    invalid.mediaGroups[0].imageIds = [];
    invalid.mediaGroups[1].imageIds[0] = invalid.images[0].id;
    const codes = validateCatalog([invalid], [collection]).map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining([
      'empty_media_group',
      'variant_color_image_mismatch',
    ]));
  });

  test('exige exactamente COLOR_GALLERY_IMAGE_COUNT imágenes por galería de color', () => {
    const tooFew = structuredClone(asymmetricProduct);
    tooFew.mediaGroups[0].imageIds = tooFew.mediaGroups[0].imageIds.slice(0, 2);
    expect(validateCatalog([tooFew], [collection]).map((entry) => entry.code))
      .toContain('invalid_color_gallery_cardinality');

    const tooMany = structuredClone(asymmetricProduct);
    const extra = productImage('image:extra');
    tooMany.images.push(extra);
    tooMany.mediaGroups[0].imageIds.push(extra.id);
    expect(validateCatalog([tooMany], [collection]).map((entry) => entry.code))
      .toContain('invalid_color_gallery_cardinality');

    expect(asymmetricProduct.mediaGroups[0].imageIds).toHaveLength(COLOR_GALLERY_IMAGE_COUNT);
    expect(validateCatalog([asymmetricProduct], [collection]).map((entry) => entry.code))
      .not.toContain('invalid_color_gallery_cardinality');
  });
});

describe('carrito por identidad exacta de variante', () => {
  const atlasVariant = findDemoVariant('cinturon-atlas', 'Negro', '85');
  const limitedVariant = findDemoVariant('cinturon-bandera', 'Marrón / detalle tricolor', '85');
  const soldOutVariant = findDemoVariant('cinturon-garaje', 'Negro / acero', '85');

  test('rechaza IDs manipulados y diferencia variante agotada de inexistente', () => {
    expect(addToCart(emptyCart(), { variantId: 'javascript:alert(1)', quantity: 1 }).error?.code).toBe('not_found');
    expect(addToCart(emptyCart(), { variantId: soldOutVariant.id, quantity: 1 }).error?.code).toBe('out_of_stock');
  });

  test('resuelve variante y precio por ID y ajusta cantidad al inventario', () => {
    const added = addToCart(emptyCart(), { variantId: limitedVariant.id, quantity: 1 });
    expect(added.success).toBe(true);
    expect(added.cart.lines[0].variantId).toBe(limitedVariant.id);
    expect(added.cart.lines[0].product.unitPrice).toEqual(limitedVariant.price);
    const updated = updateLineQuantity(added.cart, added.cart.lines[0].id, 3);
    expect(updated.success).toBe(true);
    expect(updated.adjustedQuantity).toBe(2);
  });

  test('restaura una línea únicamente por ID de variante', () => {
    const cart = restoreCart([{ variantId: atlasVariant.id, quantity: 2 }]);
    expect(cart.lines[0].variantId).toBe(atlasVariant.id);
    expect(cart.lines[0].product.reference).toBe('5003/40');
  });
});

describe('persistencia no autoritativa y migración', () => {
  const atlasVariant = findDemoVariant('cinturon-atlas', 'Negro', '85');

  test('persiste solo variantId y cantidad', () => {
    const storage = new MemoryStorage();
    const result = addToCart(emptyCart(), { variantId: atlasVariant.id, quantity: 1 });
    persistCart(storage, result.cart);
    const raw = storage.getItem(LOCAL_CART_STORAGE_KEY);
    expect(raw).toContain(`"variantId":"${atlasVariant.id}"`);
    expect(raw).not.toContain('unitPrice');
    expect(raw).not.toContain('Cinturón Atlas');
    expect(raw).not.toContain('sku');
    expect(readPersistedCart(storage).source).toBe('current');
  });

  test('migra productId + color + size sin confiar en otros datos guardados', async () => {
    const storage = new MemoryStorage();
    storage.setItem('kingbelt-cart-v3', JSON.stringify({
      version: 3,
      lines: [{ productId: 'kb-vestir-001', color: 'Negro', size: '85', quantity: 1, price: 1 }],
    }));
    const cart = await createDemoCartAdapter({ storage }).initialize();
    expect(cart.lines[0].variantId).toBe(atlasVariant.id);
    expect(cart.lines[0].product.title).toBe('Cinturón Atlas');
    expect(cart.lines[0].product.unitPrice.amountMinor).toBe(8_900);
    expect(storage.getItem(LOCAL_CART_STORAGE_KEY)).toContain('variantId');
  });

  test('descarta líneas antiguas irresolubles y payloads inválidos', async () => {
    const storage = new MemoryStorage();
    storage.setItem('kingbelt-cart-v3', JSON.stringify({
      version: 3,
      lines: [{ productId: 'kb-vestir-001', color: 'Marrón inexistente', size: '85', quantity: 1 }],
    }));
    const cart = await createDemoCartAdapter({ storage }).initialize();
    expect(cart.lines).toHaveLength(0);
    expect(cart.globalNotice).toContain('se ha retirado');

    storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify({ version: 4, lines: [{ variantId: atlasVariant.id, quantity: 100 }] }));
    expect(readPersistedCart(storage).source).toBe('invalid');
  });
});

describe('validación exhaustiva de catálogo', () => {
  test('el catálogo local normalizado no tiene errores', () => {
    expect(validateCatalog(demoProducts, demoCollections)).toEqual([]);
  });

  test('exige una colección principal existente y asignada al producto', () => {
    const emptyPrimary = structuredClone(asymmetricProduct);
    emptyPrimary.primaryCollectionId = '';
    const emptyCodes = validateCatalog([emptyPrimary], [collection]).map((entry) => entry.code);
    expect(emptyCodes).toEqual(expect.arrayContaining([
      'invalid_primary_collection',
      'primary_collection_not_assigned',
      'unknown_primary_collection',
    ]));

    const unassigned = structuredClone(asymmetricProduct);
    unassigned.primaryCollectionId = 'collection:otra';
    const unassignedCodes = validateCatalog([unassigned], [collection]).map((entry) => entry.code);
    expect(unassignedCodes).toEqual(expect.arrayContaining([
      'primary_collection_not_assigned',
      'unknown_primary_collection',
    ]));

    const other = { ...collection, id: 'collection:otra', handle: 'otra' };
    const assignedButUnknown = structuredClone(asymmetricProduct);
    assignedButUnknown.collectionIds = [collection.id, other.id];
    assignedButUnknown.primaryCollectionId = other.id;
    const unknownCodes = validateCatalog([assignedButUnknown], [collection]).map((entry) => entry.code);
    expect(unknownCodes).toContain('unknown_primary_collection');
    expect(unknownCodes).toContain('unknown_product_collection');
  });

  test('detecta identidades, combinaciones, SKU y referencias duplicadas', () => {
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
        variant({ id: 'variant:sku-a', sku: 'SKU-DUP', color: 'Negro', size: '95' }),
        variant({ id: 'variant:sku-b', sku: 'SKU-DUP', color: 'Negro', size: '100' }),
      ],
    });
    const duplicateHandle = makeProduct({
      id: 'product:handle-2',
      handle: productWithDuplicateSku.handle,
      reference: productWithDuplicateSku.reference,
      variants: [variant({ id: 'variant:handle', sku: 'SKU-HANDLE', color: 'Negro', size: '95' })],
    });
    duplicateHandle.variants[0].id = duplicateHandle.id;
    const codes = validateCatalog(
      [productWithCombination, productWithDuplicateSku, duplicateHandle],
      [collection]
    ).map((entry) => entry.code);
    expect(codes).toContain('duplicate_option_combination');
    expect(codes).toContain('duplicate_sku');
    expect(codes).toContain('duplicate_product_handle');
    expect(codes).toContain('duplicate_product_reference');
    expect(codes).toContain('product_variant_identity_collision');
  });

  test('rechaza SKU vacío y duplicados entre productos distintos', () => {
    const missing = makeProduct({
      variants: [variant({ id: 'variant:missing-sku', sku: '', color: 'Negro', size: '95' })],
    });
    expect(validateCatalog([missing], [collection]).map((entry) => entry.code)).toContain('invalid_sku');

    const first = makeProduct({
      id: 'product:sku-a',
      handle: 'producto-sku-a',
      reference: 'KB-SKU-A',
      variants: [variant({ id: 'variant:sku-cross-a', sku: 'SKU-SHARED', color: 'Negro', size: '95' })],
    });
    const second = makeProduct({
      id: 'product:sku-b',
      handle: 'producto-sku-b',
      reference: 'KB-SKU-B',
      variants: [variant({ id: 'variant:sku-cross-b', sku: 'sku-shared', color: 'Negro', size: '95' })],
    });
    expect(validateCatalog([first, second], [collection]).map((entry) => entry.code)).toContain('duplicate_sku');

    const distinct = makeProduct({
      id: 'product:sku-ok',
      handle: 'producto-sku-ok',
      reference: 'KB-SKU-OK',
      variants: [
        variant({ id: 'variant:sku-ok-a', sku: 'SKU-OK-A', color: 'Negro', size: '95' }),
        variant({ id: 'variant:sku-ok-b', sku: 'SKU-OK-B', color: 'Negro', size: '100' }),
      ],
    });
    const distinctCodes = validateCatalog([distinct], [collection]).map((entry) => entry.code);
    expect(distinctCodes).not.toContain('duplicate_sku');
    expect(distinctCodes).not.toContain('invalid_sku');
  });

  test('detecta opciones incompletas, medios rotos, inventario, precio, peso y moneda inválidos', () => {
    const invalid = structuredClone(asymmetricProduct);
    invalid.variants[0].optionValues.pop();
    invalid.variants[0].imageId = 'image:missing';
    invalid.variants[0].inventory.quantity = -1;
    invalid.variants[0].quantityRule.maximum = 0;
    invalid.variants[0].compareAtPrice = { amountMinor: 1, currency: 'USD' };
    invalid.variants[0].weight = { value: 0, unit: 'stone' };
    invalid.images[0].url = 'javascript:alert(1)';
    invalid.images[0].width = -10;
    invalid.mediaGroups[0].imageIds.push('image:missing');
    invalid.collectionIds.push('collection:missing');
    const codes = validateCatalog([invalid], [collection]).map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining([
      'incomplete_variant_options',
      'variant_unknown_image',
      'invalid_inventory_quantity',
      'invalid_quantity_maximum',
      'unsupported_currency',
      'compare_price_currency_mismatch',
      'invalid_compare_price',
      'invalid_weight',
      'invalid_weight_unit',
      'invalid_image_url',
      'invalid_image_width',
      'media_group_unknown_image',
      'unknown_product_collection',
    ]));
    expect(() => assertValidCatalog([invalid], [collection])).toThrow(CatalogValidationError);
  });

  test('los campos SEO opcionales conservan fallback y una relación de color parcial falla', () => {
    const safe = structuredClone(asymmetricProduct);
    delete safe.seo;
    safe.mediaGroups = [];
    safe.variants.forEach((item) => delete item.imageId);
    expect(getVariantImage(safe, safe.variants[0])?.id).toBe(safe.primaryImageId);
    expect(getVariantGallery(safe, safe.variants[0])).toEqual(safe.images);
    expect(validateCatalog([safe], [collection]).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'missing_color_media_group',
        'missing_variant_color_image',
      ])
    );
  });

  test('aplica los límites vigentes de tres opciones y 2.048 variantes por producto', () => {
    const tooManyOptions = structuredClone(asymmetricProduct);
    tooManyOptions.options.push(
      { id: 'option:finish', name: 'Acabado', values: [{ id: 'finish:mate', label: 'Mate' }] },
      { id: 'option:edge', name: 'Canto', values: [{ id: 'edge:tonal', label: 'Tonal' }] },
    );
    expect(tooManyOptions.options).toHaveLength(SHOPIFY_MAX_PRODUCT_OPTIONS + 1);
    expect(validateCatalog([tooManyOptions], [collection]).map((entry) => entry.code))
      .toContain('too_many_product_options');

    const variants = Array.from({ length: SHOPIFY_MAX_PRODUCT_VARIANTS + 1 }, (_, index) =>
      variant({
        id: `variant:limit:${index}`,
        sku: `SKU-LIMIT-${index}`,
        color: 'Negro',
        size: String(index),
      })
    );
    const tooManyVariants = makeProduct({
      id: 'product:variant-limit',
      handle: 'producto-limite-variantes',
      reference: 'KB-LIMIT',
      variants,
    });
    expect(validateCatalog([tooManyVariants], [collection]).map((entry) => entry.code))
      .toContain('too_many_product_variants');
    expect(validateCatalog([
      makeProduct({
        id: 'product:variant-limit-ok',
        handle: 'producto-limite-variantes-ok',
        reference: 'KB-LIMIT-OK',
        variants: variants.slice(0, SHOPIFY_MAX_PRODUCT_VARIANTS),
      }),
    ], [collection]).map((entry) => entry.code)).not.toContain('too_many_product_variants');
  });

  test('rechaza más de una opción color o más de una opción talla', () => {
    const twoColors = structuredClone(asymmetricProduct);
    twoColors.options = [
      ...twoColors.options,
      {
        id: 'option:color-extra',
        name: 'Tono',
        purpose: 'color',
        values: [{ id: 'color:extra', label: 'Extra', swatch: '#222222' }],
      },
    ];
    expect(validateCatalog([twoColors], [collection]).map((entry) => entry.code))
      .toContain('duplicate_option_purpose');

    const twoSizes = structuredClone(asymmetricProduct);
    twoSizes.options = [
      ...twoSizes.options,
      {
        id: 'option:size-extra',
        name: 'Largo',
        purpose: 'size',
        values: [{ id: 'size:extra', label: '110' }],
      },
    ];
    expect(validateCatalog([twoSizes], [collection]).map((entry) => entry.code))
      .toContain('duplicate_option_purpose');
  });

  test('rechaza reglas de cantidad parciales o distintas de la política 1/1', () => {
    const unsupported = structuredClone(asymmetricProduct);
    unsupported.variants[0].quantityRule = { minimum: 2, increment: 2, maximum: 10 };
    const unsupportedCodes = validateCatalog([unsupported], [collection]).map((entry) => entry.code);
    expect(unsupportedCodes).toEqual(expect.arrayContaining([
      'unsupported_quantity_minimum',
      'unsupported_quantity_increment',
    ]));

    const partial = structuredClone(asymmetricProduct);
    delete partial.variants[0].quantityRule;
    delete partial.category;
    const partialCodes = validateCatalog([partial], [collection]).map((entry) => entry.code);
    expect(partialCodes).toEqual(expect.arrayContaining([
      'missing_quantity_rule',
      'invalid_product_category',
    ]));
    expect(validateCatalog([], []).map((entry) => entry.code)).toEqual(['empty_catalog', 'empty_catalog']);
  });
});

describe('filtros y proyecciones de grid', () => {
  test('filtra datos normalizados y el resumen nunca incluye variantes', () => {
    const collectionById = new Map(demoCollections.map((item) => [item.id, item]));
    const summaries = demoProducts.map((product) =>
      toProductSummary(product, toCollectionReference(collectionById.get(product.primaryCollectionId)))
    );
    const result = filterProductSummaries(summaries, {
      productTypes: ['EDICION'],
      colors: ['MARRON / DETALLE TRICOLOR'],
      priceRange: 'gt-90',
    });
    expect(result.map((product) => product.handle)).toContain('cinturon-bandera');
    expect(normalizeFilterValue('  Coñac  ')).toBe('conac');
    expect(getCollectionFacets(result).colors.length).toBeGreaterThan(0);
    expect(JSON.stringify(summaries)).not.toContain('"variants"');
    expect(JSON.stringify(summaries)).not.toContain('"sku"');
  });
});

describe('filtros: rangos de precio sin solape', () => {
  test('los límites de 80 € y 90 € son disjuntos y un precio cae en un único rango', () => {
    expect(matchesPriceRange(7_999, 'lt-80')).toBe(true);
    expect(matchesPriceRange(7_999, '80-90')).toBe(false);
    expect(matchesPriceRange(8_000, 'lt-80')).toBe(false);
    expect(matchesPriceRange(8_000, '80-90')).toBe(true);
    expect(matchesPriceRange(8_000, 'gt-90')).toBe(false);
    expect(matchesPriceRange(9_000, '80-90')).toBe(true);
    expect(matchesPriceRange(9_000, 'gt-90')).toBe(false);
    expect(matchesPriceRange(9_001, '80-90')).toBe(false);
    expect(matchesPriceRange(9_001, 'gt-90')).toBe(true);
    expect(matchesPriceRange(5_000)).toBe(true);
    expect(matchesPriceRange(5_000, 'rango-inexistente')).toBe(true);
  });

  test('cada producto de la demo cae en exactamente un rango y los contadores suman el total', () => {
    const collectionById = new Map(demoCollections.map((item) => [item.id, item]));
    const summaries = demoProducts.map((product) =>
      toProductSummary(product, toCollectionReference(collectionById.get(product.primaryCollectionId)))
    );
    const facetCounts = getCollectionFacets(summaries).priceRanges;
    const counted = new Map(COLLECTION_PRICE_RANGES.map((range) => [range.id, 0]));
    summaries.forEach((product) => {
      const matches = COLLECTION_PRICE_RANGES.filter((range) =>
        matchesPriceRange(product.priceRange.min.amountMinor, range.id)
      );
      expect(matches).toHaveLength(1);
      counted.set(matches[0].id, counted.get(matches[0].id) + 1);
    });
    COLLECTION_PRICE_RANGES.forEach((range) => {
      expect(facetCounts.find((item) => item.id === range.id)?.count).toBe(counted.get(range.id));
    });
    expect(facetCounts.reduce((sum, item) => sum + item.count, 0)).toBe(summaries.length);
  });
});

describe('filtros: disponibilidad y selección por URL', () => {
  const summariesOf = () => {
    const collectionById = new Map(demoCollections.map((item) => [item.id, item]));
    return demoProducts.map((product) =>
      toProductSummary(product, toCollectionReference(collectionById.get(product.primaryCollectionId)))
    );
  };

  test('el filtro de disponibilidad excluye agotados y no disponibles con el mismo predicado', () => {
    const summaries = summariesOf();
    const available = filterProductSummaries(summaries, { availableOnly: true });
    expect(available.some((product) => product.handle === 'cinturon-garaje')).toBe(false);
    expect(available.some((product) => product.handle === 'cinturon-huella')).toBe(false);
    expect(available.some((product) => product.handle === 'cinturon-bandera')).toBe(true);
    expect(getCollectionFacets(summaries).availability[0].count).toBe(available.length);
    expect(getCollectionFacets(summaries).availability[0].value).toBe('Disponibles');
  });

  test('el índice de catálogo filtra por handle de colección principal', () => {
    const summaries = summariesOf();
    const vestir = filterProductSummaries(summaries, { collectionHandle: 'vestir' });
    expect(vestir.length).toBeGreaterThan(0);
    expect(vestir.length).toBeLessThan(summaries.length);
    expect(vestir.every((product) => product.primaryCollection.handle === 'vestir')).toBe(true);
  });

  test('el predicado comparte el contrato mínimo que consume el navegador', () => {
    const summary = summariesOf().find((product) => product.handle === 'cinturon-atlas');
    const model = toFilterableProduct(summary);
    expect(matchesCatalogSelection(model, { productTypes: ['piel lisa'] })).toBe(true);
    expect(matchesCatalogSelection(model, { productTypes: ['trenzado'] })).toBe(false);
    expect(matchesCatalogSelection(model, { colors: ['negro'] })).toBe(true);
    expect(matchesCatalogSelection(model, { priceRange: '80-90' })).toBe(true);
    expect(matchesCatalogSelection(model, { availableOnly: true })).toBe(true);
    expect(matchesCatalogSelection(model, { collectionHandle: 'vestir' })).toBe(true);
    expect(matchesCatalogSelection(model, { collectionHandle: 'sport' })).toBe(false);
  });

  test('la selección viaja por la URL normalizada y vuelve intacta', () => {
    const params = serializeCatalogFilterParams({
      productTypes: ['Piel lisa'],
      colors: ['Coñac', 'Negro'],
      priceRange: '80-90',
      availableOnly: true,
    });
    expect(params.toString()).toContain('tipo=piel+lisa');
    expect(params.toString()).toContain('color=conac');
    expect(params.toString()).toContain('disponible=1');
    expect(parseCatalogFilterParams(params)).toEqual({
      productTypes: ['piel lisa'],
      colors: ['conac', 'negro'],
      priceRange: '80-90',
      availableOnly: true,
    });
    expect(serializeCatalogFilterParams({}).toString()).toBe('');
    expect(serializeCatalogFilterParams({ productTypes: [], colors: [] }).toString()).toBe('');
    expect(serializeCatalogFilterParams({ collectionHandle: 'Vestir' }).toString()).toBe('categoria=vestir');
    expect(parseCatalogFilterParams('?categoria=vestir').collectionHandle).toBe('vestir');
  });

  test('un id de rango inválido en la URL se descarta como «sin filtro»', () => {
    expect(parseCatalogFilterParams('?precio=gt-999&tipo=algo').priceRange).toBeUndefined();
    expect(parseCatalogFilterParams('?precio=gt-999&tipo=algo').productTypes).toEqual(['algo']);
  });
});


describe('redirección de checkout', () => {
  test('solo permite HTTPS y un host exacto declarado por el proveedor', () => {
    expect(getSafeCheckoutUrl({ status: 'ready', url: 'https://checkout.example.com/cart/1', allowedHosts: ['checkout.example.com'] })?.hostname).toBe('checkout.example.com');
    expect(getSafeCheckoutUrl({ status: 'ready', url: 'https://checkout.example.com.evil.test/cart/1', allowedHosts: ['checkout.example.com'] })).toBeNull();
    expect(getSafeCheckoutUrl({ status: 'ready', url: 'http://checkout.example.com/cart/1', allowedHosts: ['checkout.example.com'] })).toBeNull();
  });
});

const buildSyntheticCatalog = () => {
  const syntheticCollection = {
    id: 'collection:scale',
    handle: 'escala',
    title: 'Escala',
    description: 'Colección sintética no renderizada.',
    image: productImage('collection:scale:image'),
  };
  let remainingGroupIndex = 0;
  const products = Array.from({ length: 70 }, (_, productIndex) => {
    const groupCount = productIndex < 62 ? 4 : 3;
    const variants = [];
    for (let colorIndex = 0; colorIndex < groupCount; colorIndex += 1) {
      const sizeCount = productIndex === 0 ? 19 : remainingGroupIndex++ < 149 ? 6 : 5;
      for (let sizeIndex = 0; sizeIndex < sizeCount; sizeIndex += 1) {
        variants.push(variant({
          id: `scale:variant:${productIndex}:${colorIndex}:${sizeIndex}`,
          sku: `SCALE-${productIndex}-${colorIndex}-${sizeIndex}`,
          color: `Color ${colorIndex}`,
          size: `Talla ${sizeIndex}`,
          price: 5_000 + ((productIndex + colorIndex + sizeIndex) % 7) * 100,
          quantity: 20,
        }));
      }
    }
    const product = makeProduct({
      id: `scale:product:${productIndex}`,
      handle: `producto-escala-${productIndex}`,
      reference: `SCALE-${productIndex}`,
      variants,
      productType: productIndex % 2 === 0 ? 'Tipo par' : 'Tipo impar',
      collectionId: syntheticCollection.id,
    });
    const colorValues = product.options.find((option) => option.purpose === 'color').values;
    const images = colorValues.flatMap((color) => Array.from({ length: 3 }, (_, imageIndex) => ({
      ...productImage(`${product.id}:image:${color.id}:${imageIndex}`),
      altText: `${color.label}, vista ${imageIndex + 1}`,
    })));
    product.images = images;
    product.primaryImageId = images[0].id;
    product.mediaGroups = colorValues.map((color) => ({
      id: `${product.id}:media:${color.id}`,
      optionValueId: color.id,
      imageIds: images.filter((image) => image.id.includes(`:image:${color.id}:`)).map((image) => image.id),
    }));
    product.variants = product.variants.map((item) => ({
      ...item,
      imageId: product.mediaGroups.find((group) =>
        item.optionValues.some((selection) => selection.valueId === group.optionValueId)
      ).imageIds[0],
    }));
    return product;
  });
  return { products, collections: [syntheticCollection] };
};

describe('dimensiones de imagen obligatorias', () => {
  test('todos los productos demo declaran width y height positivos para reservar layout', () => {
    for (const product of demoProducts) {
      for (const image of product.images) {
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
      }
    }
  });
});

describe('catálogo sintético de escala prevista', () => {
  test('opera con 70 productos, 272 colores, 816 imágenes y 1.565 variantes', async () => {
    const source = buildSyntheticCatalog();
    const variants = source.products.flatMap((product) => product.variants);
    const colorGroups = source.products.flatMap((product) => product.mediaGroups);
    expect(source.products).toHaveLength(70);
    expect(colorGroups).toHaveLength(272);
    expect(source.products.flatMap((product) => product.images)).toHaveLength(816);
    expect(variants).toHaveLength(1_565);
    expect(Math.max(...source.products.map((product) => product.variants.length))).toBe(76);
    expect(new Set(source.products.map((product) => product.id)).size).toBe(70);
    expect(new Set(variants.map((item) => item.id)).size).toBe(1_565);
    expect(new Set(variants.map((item) => item.sku)).size).toBe(1_565);
    expect(validateCatalog(source.products, source.collections)).toEqual([]);

    const provider = createDemoCatalogAdapter(source);
    expect(await provider.getProductHandles()).toHaveLength(70);
    const resolved = await provider.getProductByHandle('producto-escala-0');
    expect(resolved.variants).toHaveLength(76);
    expect(getVariantBySelectedOptions(resolved, resolved.variants[0].optionValues)?.id).toBe(resolved.variants[0].id);
    expect(getVariantBySelectedOptions(resolved, [
      { optionId: colorOptionId, valueId: colorId('inexistente') },
      { optionId: sizeOptionId, valueId: sizeId('Talla 0') },
    ])).toBeUndefined();
    expect(calculatePriceRange(resolved.variants).min.amountMinor).toBeLessThan(calculatePriceRange(resolved.variants).max.amountMinor);

    const page = await provider.getCollectionByHandle('escala');
    expect(page.products).toHaveLength(70);
    expect(await provider.getProductSummaries()).toHaveLength(70);
    expect(page.products.every((summary) => !('variants' in summary))).toBe(true);
    expect(JSON.stringify(page.products)).not.toContain('"variants"');
    expect(filterProductSummaries(page.products, { productTypes: ['tipo par'], colors: ['color 0'] })).toHaveLength(35);
  });
});
