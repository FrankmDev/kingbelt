import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getVariantAvailability } from '../src/commerce/domain/inventory.ts';
import { getInitialColorValueId, getColorGalleries } from '../src/commerce/domain/product-media.ts';
import {
  expandCompactPublicBuyBoxPayload,
  isPublicBuyBoxPurchasable,
  parseProductOptionPurpose,
  toCompactPublicBuyBoxPayload,
  toPublicBuyBoxAvailability,
  toPublicBuyBoxOptions,
  toPublicBuyBoxVariant,
} from '../src/commerce/domain/product-mappers.ts';
import {
  applyProductBuyBoxSelection,
  getCompatibleOptionValues,
  getSelectedColorValueId,
  getVariantBySelectedOptions,
  reconcileSelectedOptions,
} from '../src/commerce/domain/variants.ts';

const root = resolve(import.meta.dir, '..');
const COLOR = 'option:color';
const SIZE = 'option:size';
const FINISH = 'option:finish';
const NEGRO = 'color:Negro';
const MARRON = 'color:Marrón';
const SIZE_90 = 'size:90';
const SIZE_100 = 'size:100';
const MATE = 'finish:Mate';
const BRILLO = 'finish:Brillo';

const image = (id) => ({
  id,
  url: `/images/${id}.jpg`,
  altText: id,
  width: 800,
  height: 1000,
});

const selectionKey = (selection) =>
  [...selection].map((item) => `${item.optionId}:${item.valueId}`).sort().join('|');

const optionValuesFor = (pairs) =>
  Object.entries(pairs).map(([optionId, valueId]) => ({ optionId, valueId }));

const makeVariant = ({
  id,
  sku = id,
  options,
  price = 8_900,
  compareAtPrice,
  quantity = 10,
  imageId,
}) => ({
  id,
  sku,
  optionValues: optionValuesFor(options),
  price: { amountMinor: price, currency: 'EUR' },
  ...(compareAtPrice ? { compareAtPrice: { amountMinor: compareAtPrice, currency: 'EUR' } } : {}),
  salesStatus: 'active',
  inventory: quantity === null ? { kind: 'unknown' } : { kind: 'known', quantity },
  inventoryPolicy: 'deny',
  quantityRule: { minimum: 1, increment: 1 },
  ...(imageId ? { imageId } : {}),
});

const colorOption = {
  id: COLOR,
  name: 'Color',
  purpose: 'color',
  values: [
    { id: NEGRO, label: 'Negro', swatch: '#111111' },
    { id: MARRON, label: 'Marrón', swatch: '#6b4a2b' },
  ],
};

const sizeOption = {
  id: SIZE,
  name: 'Talla',
  purpose: 'size',
  values: [
    { id: SIZE_90, label: '90' },
    { id: SIZE_100, label: '100' },
  ],
};

const finishOption = {
  id: FINISH,
  name: 'Acabado',
  values: [
    { id: MATE, label: 'Mate' },
    { id: BRILLO, label: 'Brillo' },
  ],
};

const withMedia = (product) => {
  const colors = product.options.find((option) => option.purpose === 'color')?.values ?? [];
  const galleries = colors.map((color) => ({
    color,
    images: [image(`${product.id}:${color.id}:0`), image(`${product.id}:${color.id}:1`), image(`${product.id}:${color.id}:2`)],
  }));
  const imageIdByColor = new Map(galleries.map(({ color, images }) => [color.id, images[0].id]));
  return {
    ...product,
    images: galleries.flatMap((gallery) => gallery.images),
    primaryImageId: galleries[0]?.images[0]?.id,
    mediaGroups: galleries.map(({ color, images }) => ({
      id: `${product.id}:media:${color.id}`,
      optionValueId: color.id,
      imageIds: images.map((item) => item.id),
    })),
    variants: product.variants.map((variant) => {
      const colorValueId = variant.optionValues.find((item) => item.optionId === COLOR)?.valueId;
      return { ...variant, imageId: imageIdByColor.get(colorValueId) ?? variant.imageId };
    }),
  };
};

const reorderProductOptions = (product, optionIds) => ({
  ...product,
  options: optionIds.map((id) => product.options.find((option) => option.id === id)),
  variants: product.variants.map((variant) => ({
    ...variant,
    optionValues: optionIds.map((optionId) =>
      variant.optionValues.find((selection) => selection.optionId === optionId)
    ),
  })),
});

const gridProduct = withMedia({
  id: 'product:grid',
  handle: 'cinturon-grid',
  title: 'Cinturón grid',
  options: [colorOption, sizeOption],
  variants: [
    makeVariant({ id: 'gid://shopify/ProductVariant/1', options: { [COLOR]: NEGRO, [SIZE]: SIZE_90 }, price: 8_900, quantity: 8 }),
    makeVariant({ id: 'gid://shopify/ProductVariant/2', options: { [COLOR]: NEGRO, [SIZE]: SIZE_100 }, price: 9_100, quantity: 2 }),
    makeVariant({ id: 'gid://shopify/ProductVariant/3', options: { [COLOR]: MARRON, [SIZE]: SIZE_90 }, price: 9_400, compareAtPrice: 10_900, quantity: 6 }),
    makeVariant({ id: 'gid://shopify/ProductVariant/4', options: { [COLOR]: MARRON, [SIZE]: SIZE_100 }, price: 9_700, quantity: 0 }),
  ],
});

const sizeFirstGrid = reorderProductOptions(gridProduct, [SIZE, COLOR]);
const asymmetric = withMedia({
  id: 'product:asymmetric',
  handle: 'cinturon-asimetrico',
  title: 'Cinturón asimétrico',
  options: [colorOption, sizeOption],
  variants: [
    makeVariant({ id: 'variant:black-90', options: { [COLOR]: NEGRO, [SIZE]: SIZE_90 }, quantity: 5 }),
    makeVariant({ id: 'variant:black-100', options: { [COLOR]: NEGRO, [SIZE]: SIZE_100 }, quantity: 2 }),
    makeVariant({ id: 'variant:brown-90', options: { [COLOR]: MARRON, [SIZE]: SIZE_90 }, quantity: 3 }),
  ],
});
const sizeFirstAsymmetric = reorderProductOptions(asymmetric, [SIZE, COLOR]);

const threeOptionProduct = withMedia({
  id: 'product:three',
  handle: 'cinturon-tres',
  title: 'Cinturón tres opciones',
  options: [colorOption, sizeOption, finishOption],
  variants: [
    makeVariant({ id: 'variant:n-90-mate', options: { [COLOR]: NEGRO, [SIZE]: SIZE_90, [FINISH]: MATE } }),
    makeVariant({ id: 'variant:n-90-brillo', options: { [COLOR]: NEGRO, [SIZE]: SIZE_90, [FINISH]: BRILLO } }),
    makeVariant({ id: 'variant:n-100-mate', options: { [COLOR]: NEGRO, [SIZE]: SIZE_100, [FINISH]: MATE } }),
    makeVariant({ id: 'variant:b-90-mate', options: { [COLOR]: MARRON, [SIZE]: SIZE_90, [FINISH]: MATE } }),
  ],
});

const colorOnly = withMedia({
  id: 'product:color-only',
  handle: 'cinturon-color',
  title: 'Solo color',
  options: [colorOption],
  variants: [
    makeVariant({ id: 'variant:only-black', options: { [COLOR]: NEGRO } }),
    makeVariant({ id: 'variant:only-brown', options: { [COLOR]: MARRON }, price: 9_200 }),
  ],
});

const sizeOnly = {
  id: 'product:size-only',
  handle: 'cinturon-talla',
  title: 'Solo talla',
  options: [sizeOption],
  images: [image('size-only-default')],
  primaryImageId: 'size-only-default',
  mediaGroups: [],
  variants: [
    makeVariant({ id: 'variant:only-90', options: { [SIZE]: SIZE_90 }, imageId: 'size-only-default' }),
    makeVariant({ id: 'variant:only-100', options: { [SIZE]: SIZE_100 }, imageId: 'size-only-default', price: 9_050 }),
  ],
};

const toClientPayload = (product) => {
  const compact = toCompactPublicBuyBoxPayload(product);
  const options = toPublicBuyBoxOptions(
    compact.o,
    product.options.map((option) => ({
      id: option.id,
      name: option.name,
      purpose: option.purpose,
      values: option.values.map((value) => ({ id: value.id, label: value.label })),
    }))
  );
  return {
    compact,
    options,
    variants: expandCompactPublicBuyBoxPayload(compact),
  };
};

const select = (pairs) => optionValuesFor(pairs);

const firstMatchingOptionValueId = (variant, options) =>
  variant?.optionValues.find((selection) =>
    options.some((option) =>
      option.id === selection.optionId && option.values.some((value) => value.id === selection.valueId)
    )
  )?.valueId;

const cartAddRequest = (product, selection) => {
  const variant = getVariantBySelectedOptions(product, selection);
  return variant
    ? { command: 'add', variantId: variant.id, quantity: 1 }
    : undefined;
};

const submitState = (product, selection, changedOptionId) => {
  const state = applyProductBuyBoxSelection(product, selection, changedOptionId);
  const complete = state.selection.length === product.options.length;
  const availability = state.selectedVariant
    ? toPublicBuyBoxAvailability(state.selectedVariant)
    : undefined;
  const purchasable = availability ? isPublicBuyBoxPurchasable(availability) : false;
  return {
    ...state,
    complete,
    availability,
    purchasable,
    submitDisabled: !purchasable,
    submitLabel: !complete
      ? 'Elige las opciones'
      : purchasable
        ? 'Añadir al carrito'
        : state.selectedVariant
          ? availability?.status === 'out_of_stock'
            ? 'Agotado'
            : 'No disponible'
          : 'Combinación no disponible',
  };
};

describe('propósito de opción en el contrato público', () => {
  test('solo acepta purpose color o size resuelto server-side', () => {
    expect(parseProductOptionPurpose('color')).toBe('color');
    expect(parseProductOptionPurpose('size')).toBe('size');
    expect(parseProductOptionPurpose('Color')).toBeUndefined();
    expect(parseProductOptionPurpose('Talla')).toBeUndefined();
    expect(parseProductOptionPurpose('talla')).toBeUndefined();
    expect(parseProductOptionPurpose('colour')).toBeUndefined();
    expect(parseProductOptionPurpose('acabado')).toBeUndefined();
  });

  test('reconstruye purpose desde el DOM serializado y no desde el nombre', () => {
    const options = toPublicBuyBoxOptions(
      [SIZE, COLOR],
      [
        { id: SIZE, name: 'Talla', purpose: 'size', values: [{ id: SIZE_100, label: '100' }] },
        { id: COLOR, name: 'Color', purpose: 'color', values: [{ id: MARRON, label: 'Marrón' }] },
      ]
    );
    expect(options?.map((option) => option.purpose)).toEqual(['size', 'color']);

    const unnamed = toPublicBuyBoxOptions(
      [COLOR],
      [{ id: COLOR, name: 'Color', values: [{ id: NEGRO, label: 'Negro' }] }]
    );
    expect(unnamed?.[0].purpose).toBeUndefined();
    expect(unnamed?.[0].name).toBe('Color');
  });

  test('el fieldset de ficha propaga data-product-option-purpose', () => {
    const source = readFileSync(join(root, 'src/components/product/ProductAddToCart.astro'), 'utf8');
    expect(source).toContain('data-product-option-purpose={option.purpose}');
    expect(source).toContain('option.purpose === \'color\'');
    expect(source).not.toContain('option.name === \'Color\'');
  });
});

describe('resolución exacta por optionId y valueId', () => {
  test('encuentra la variante exacta y no un match parcial', () => {
    expect(getVariantBySelectedOptions(gridProduct, select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 }))?.id)
      .toBe('gid://shopify/ProductVariant/2');
    expect(getVariantBySelectedOptions(gridProduct, select({ [COLOR]: MARRON }))).toBeUndefined();
    expect(getVariantBySelectedOptions(gridProduct, select({ [COLOR]: MARRON, [SIZE]: 'size:inexistente' })))
      .toBeUndefined();
  });

  test('el orden Color/Talla no cambia la identidad comercial', () => {
    const selection = select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 });
    expect(getVariantBySelectedOptions(gridProduct, selection)?.id).toBe('gid://shopify/ProductVariant/2');
    expect(getVariantBySelectedOptions(sizeFirstGrid, selection)?.id).toBe('gid://shopify/ProductVariant/2');
    expect(getVariantBySelectedOptions(sizeFirstGrid, select({ [COLOR]: MARRON, [SIZE]: SIZE_90 }))?.id)
      .toBe('gid://shopify/ProductVariant/3');
  });

  test('exige las tres opciones cuando existe una tercera', () => {
    expect(getVariantBySelectedOptions(threeOptionProduct, select({
      [COLOR]: NEGRO,
      [SIZE]: SIZE_90,
      [FINISH]: BRILLO,
    }))?.id).toBe('variant:n-90-brillo');
    expect(getVariantBySelectedOptions(threeOptionProduct, select({
      [COLOR]: NEGRO,
      [SIZE]: SIZE_90,
    }))).toBeUndefined();
    expect(getVariantBySelectedOptions(
      reorderProductOptions(threeOptionProduct, [FINISH, SIZE, COLOR]),
      select({ [COLOR]: MARRON, [SIZE]: SIZE_90, [FINISH]: MATE })
    )?.id).toBe('variant:b-90-mate');
  });

  test('una combinación inexistente no inventa variante', () => {
    expect(getVariantBySelectedOptions(asymmetric, select({ [COLOR]: MARRON, [SIZE]: SIZE_100 })))
      .toBeUndefined();
  });
});

describe('galería por purpose=color, nunca por posición', () => {
  test('Talla antes de Color no usa el valueId de talla como galería', () => {
    const variant = sizeFirstGrid.variants.find((item) => item.id === 'gid://shopify/ProductVariant/4');
    expect(variant.optionValues[0]).toEqual({ optionId: SIZE, valueId: SIZE_100 });
    expect(firstMatchingOptionValueId(variant, sizeFirstGrid.options)).toBe(SIZE_100);
    expect(getSelectedColorValueId(sizeFirstGrid, variant.optionValues)).toBe(MARRON);
    expect(applyProductBuyBoxSelection(sizeFirstGrid, variant.optionValues).colorValueId).toBe(MARRON);
  });

  test('cambiar color cambia la galería aunque falte talla', () => {
    const afterColor = applyProductBuyBoxSelection(
      asymmetric,
      select({ [COLOR]: MARRON, [SIZE]: SIZE_100 }),
      COLOR
    );
    expect(afterColor.colorValueId).toBe(MARRON);
    expect(afterColor.selectedVariant).toBeUndefined();
    expect(selectionKey(afterColor.selection)).toBe(`${COLOR}:${MARRON}`);
  });

  test('cambiar solo talla no cambia la galería', () => {
    const black90 = applyProductBuyBoxSelection(gridProduct, select({ [COLOR]: NEGRO, [SIZE]: SIZE_90 }));
    const black100 = applyProductBuyBoxSelection(
      gridProduct,
      select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 }),
      SIZE
    );
    expect(black90.colorValueId).toBe(NEGRO);
    expect(black100.colorValueId).toBe(NEGRO);
    expect(black90.selectedVariant.id).not.toBe(black100.selectedVariant.id);
  });

  test('sin opción color no hay gallery set', () => {
    const state = applyProductBuyBoxSelection(sizeOnly, select({ [SIZE]: SIZE_100 }));
    expect(state.colorValueId).toBeUndefined();
    expect(state.selectedVariant.id).toBe('variant:only-100');
  });

  test('dos opciones color no eligen la primera', () => {
    const invalid = {
      ...gridProduct,
      options: [colorOption, { ...colorOption, id: 'option:color-2', name: 'Tono' }],
    };
    expect(getSelectedColorValueId(invalid, select({ [COLOR]: MARRON }))).toBeUndefined();
  });

  test('la galería inicial semántica ignora que Talla vaya primero', () => {
    const variant = sizeFirstGrid.variants.find((item) => item.id === 'gid://shopify/ProductVariant/3');
    const galleries = getColorGalleries(sizeFirstGrid);
    expect(getInitialColorValueId(variant, galleries, sizeFirstGrid.options)).toBe(MARRON);
    expect(getInitialColorValueId(variant, galleries, sizeFirstGrid.options)).not.toBe(SIZE_90);
  });
});

describe('reconciliación y compatibilidad independientes del orden', () => {
  test('cambiar Color conserva Talla si sigue existiendo', () => {
    const kept = reconcileSelectedOptions(
      asymmetric,
      select({ [COLOR]: MARRON, [SIZE]: SIZE_90 }),
      COLOR
    );
    expect(selectionKey(kept)).toBe(selectionKey(select({ [COLOR]: MARRON, [SIZE]: SIZE_90 })));
  });

  test('cambiar Color elimina Talla incompatible y conserva el color nuevo', () => {
    const dropped = reconcileSelectedOptions(
      asymmetric,
      select({ [COLOR]: MARRON, [SIZE]: SIZE_100 }),
      COLOR
    );
    expect(dropped).toEqual([{ optionId: COLOR, valueId: MARRON }]);
    expect(getVariantBySelectedOptions(asymmetric, dropped)).toBeUndefined();
  });

  test('cambiar Talla conserva Color si sigue siendo compatible', () => {
    const kept = reconcileSelectedOptions(
      asymmetric,
      select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 }),
      SIZE
    );
    expect(selectionKey(kept)).toBe(selectionKey(select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 })));
  });

  test('la reconciliación no depende del orden de Shopify', () => {
    const selection = select({ [COLOR]: MARRON, [SIZE]: SIZE_100 });
    expect(selectionKey(reconcileSelectedOptions(asymmetric, selection, COLOR)))
      .toBe(selectionKey(reconcileSelectedOptions(sizeFirstAsymmetric, selection, COLOR)));
    expect(selectionKey(reconcileSelectedOptions(threeOptionProduct, select({
      [COLOR]: MARRON,
      [SIZE]: SIZE_100,
      [FINISH]: MATE,
    }), COLOR))).toBe(selectionKey(reconcileSelectedOptions(
      reorderProductOptions(threeOptionProduct, [FINISH, SIZE, COLOR]),
      select({ [COLOR]: MARRON, [SIZE]: SIZE_100, [FINISH]: MATE }),
      COLOR
    )));
  });

  test('la compatibilidad usa el resto de selecciones, no opciones anteriores', () => {
    const marron90 = select({ [COLOR]: MARRON, [SIZE]: SIZE_90 });
    expect(getCompatibleOptionValues(asymmetric, marron90, SIZE)).toEqual([SIZE_90]);
    expect(getCompatibleOptionValues(sizeFirstAsymmetric, marron90, SIZE)).toEqual([SIZE_90]);
    expect(getCompatibleOptionValues(asymmetric, select({ [COLOR]: NEGRO }), SIZE))
      .toEqual([SIZE_90, SIZE_100]);
    expect(getCompatibleOptionValues(sizeFirstAsymmetric, select({ [COLOR]: NEGRO }), SIZE))
      .toEqual([SIZE_90, SIZE_100]);
  });
});

describe('precio, disponibilidad e imagen de la variante exacta', () => {
  test('una selección incompleta no autoelige la primera variante del color', () => {
    const state = submitState(
      asymmetric,
      select({ [COLOR]: MARRON, [SIZE]: SIZE_100 }),
      COLOR
    );
    expect(state.selectedVariant).toBeUndefined();
    expect(state.submitDisabled).toBe(true);
    expect(state.submitLabel).toBe('Elige las opciones');
  });

  test('una combinación inexistente deshabilita el submit', () => {
    const state = submitState(asymmetric, select({ [COLOR]: MARRON, [SIZE]: SIZE_100 }));
    expect(state.selectedVariant).toBeUndefined();
    expect(state.submitDisabled).toBe(true);
    expect(state.submitLabel).toBe('Combinación no disponible');
  });

  test('una variante agotada sigue siendo la combinación exacta', () => {
    const state = submitState(gridProduct, select({ [COLOR]: MARRON, [SIZE]: SIZE_100 }));
    expect(state.selectedVariant.id).toBe('gid://shopify/ProductVariant/4');
    expect(state.availability.status).toBe('out_of_stock');
    expect(state.submitLabel).toBe('Agotado');
    expect(state.submitDisabled).toBe(true);
    expect(getVariantAvailability(state.selectedVariant).status).toBe('out_of_stock');
  });

  test('precio, compareAt, imagen y cantidad pertenecen a esa variante', () => {
    const brown90 = applyProductBuyBoxSelection(gridProduct, select({ [COLOR]: MARRON, [SIZE]: SIZE_90 }));
    const black100 = applyProductBuyBoxSelection(gridProduct, select({ [COLOR]: NEGRO, [SIZE]: SIZE_100 }));
    expect(brown90.selectedVariant.price).toEqual({ amountMinor: 9_400, currency: 'EUR' });
    expect(brown90.selectedVariant.compareAtPrice).toEqual({ amountMinor: 10_900, currency: 'EUR' });
    expect(black100.selectedVariant.compareAtPrice).toBeUndefined();
    expect(brown90.selectedVariant.imageId).toContain(MARRON);
    expect(black100.selectedVariant.imageId).toContain(NEGRO);
    expect(toPublicBuyBoxAvailability(brown90.selectedVariant)).toMatchObject({
      status: 'available',
      minimum: 1,
      increment: 1,
      maxQuantity: 99,
    });
    expect(toPublicBuyBoxAvailability(black100.selectedVariant)).toMatchObject({
      status: 'limited',
      minimum: 1,
      increment: 1,
      maxQuantity: 99,
    });
    expect(toPublicBuyBoxAvailability(applyProductBuyBoxSelection(
      gridProduct,
      select({ [COLOR]: MARRON, [SIZE]: SIZE_100 })
    ).selectedVariant)).toMatchObject({
      status: 'out_of_stock',
      maxQuantity: 0,
    });
  });

  test('un producto solo color resuelve variante y galería', () => {
    const state = applyProductBuyBoxSelection(colorOnly, select({ [COLOR]: MARRON }));
    expect(state.selectedVariant.id).toBe('variant:only-brown');
    expect(state.colorValueId).toBe(MARRON);
  });
});

describe('payload compacto por optionId', () => {
  test('round-trip conserva variant ID, option ID y value ID aunque cambie el orden', () => {
    for (const product of [gridProduct, sizeFirstGrid]) {
      const { compact, variants } = toClientPayload(product);
      expect(compact.o).toEqual(product.options.map((option) => option.id));
      expect(compact.o).toContain(COLOR);
      expect(compact.o).toContain(SIZE);
      product.variants.forEach((variant, index) => {
        expect(variants[index].id).toBe(variant.id);
        expect(selectionKey(variants[index].optionValues)).toBe(selectionKey(variant.optionValues));
        expect(toPublicBuyBoxVariant(variant).id).toBe(variant.id);
        expect(selectionKey(toPublicBuyBoxVariant(variant).optionValues)).toBe(selectionKey(variant.optionValues));
      });
    }
  });

  test('el cliente reconstruido resuelve la misma variante con Talla primero', () => {
    const selection = select({ [COLOR]: MARRON, [SIZE]: SIZE_100 });
    for (const product of [gridProduct, sizeFirstGrid]) {
      const payload = toClientPayload(product);
      const state = applyProductBuyBoxSelection(
        { options: payload.options, variants: payload.variants },
        selection
      );
      expect(payload.options.find((option) => option.purpose === 'color')?.id).toBe(COLOR);
      expect(state.selectedVariant.id).toBe('gid://shopify/ProductVariant/4');
      expect(state.colorValueId).toBe(MARRON);
      expect(state.selectedVariant.price).toBe(9_700);
    }
  });
});

describe('carrito: ProductVariant.id exacto', () => {
  test('Marrón + 100 envía únicamente ProductVariant/4, también con opciones invertidas', () => {
    const selection = select({ [COLOR]: MARRON, [SIZE]: SIZE_100 });
    for (const product of [gridProduct, sizeFirstGrid]) {
      const payload = toClientPayload(product);
      const resolved = getVariantBySelectedOptions(
        { options: payload.options, variants: payload.variants },
        selection
      );
      const request = cartAddRequest({ options: payload.options, variants: payload.variants }, selection);
      expect(resolved.id).toBe('gid://shopify/ProductVariant/4');
      expect(request).toEqual({
        command: 'add',
        variantId: 'gid://shopify/ProductVariant/4',
        quantity: 1,
      });
      const serialized = JSON.stringify(request);
      expect(serialized).not.toContain('ProductVariant/1');
      expect(serialized).not.toContain('ProductVariant/2');
      expect(serialized).not.toContain('ProductVariant/3');
      expect(serialized).not.toContain('Marrón');
      expect(serialized).not.toContain('100');
      expect(serialized).not.toContain('SKU');
    }
  });

  test('el script de ficha envía selectedVariant.id y no un input editable', () => {
    const source = readFileSync(join(root, 'src/scripts/commerce/product-add-to-cart.ts'), 'utf8');
    expect(source).toContain('getVariantBySelectedOptions(payload, selection)');
    expect(source).toContain('addProductToCart({ variantId: variantId(resolvedVariant.id), quantity })');
    expect(source).toContain('applyProductBuyBoxSelection');
    expect(source).toContain('resolved.colorValueId');
    expect(source).not.toContain('getColorValueId');
    expect(source).not.toContain('upstreamSelection');
    expect(source).not.toContain('name="variantId"');
    expect(source).not.toContain('option.name === \'Color\'');
    expect(source).not.toContain('option.name === "Talla"');
  });
});
