import { productId, sku, variantId } from '../../src/commerce/domain/identifiers';
import type { Product, ProductImage, ProductOptionValue } from '../../src/commerce/domain/catalog';

const colors: ProductOptionValue[] = ['Negro', 'Marrón', 'Coñac', 'Acero'].map((label, index) => ({
  id: `scale:color:${index}`,
  label,
  swatch: ['#1c1a18', '#6d4a2f', '#a06836', '#7b7d78'][index],
}));

const sizes: ProductOptionValue[] = Array.from({ length: 20 }, (_, index) => ({
  id: `scale:size:${80 + index * 5}`,
  label: String(80 + index * 5),
}));

const images: ProductImage[] = colors.flatMap((color, colorIndex) =>
  Array.from({ length: 3 }, (_, imageIndex) => ({
    id: `scale:image:${colorIndex}:${imageIndex}`,
    url: '/images/imagen-cinturon-kingbelt-10.avif',
    altText: `Ficha de escala en ${color.label.toLocaleLowerCase('es')}, vista ${imageIndex + 1}`,
    width: 960,
    height: 1200,
  }))
);

/** Fixture aislada: 80 combinaciones posibles menos una por color = 76 variantes reales. */
export const scaleProduct: Product = {
  id: productId('scale:product:76'),
  reference: 'SCALE-76',
  handle: 'ficha-76-variantes',
  title: 'Ficha de escala de variantes',
  description: 'Fixture técnica aislada para validar el render de la ficha máxima prevista.',
  summary: 'Prueba renderizada de selección, disponibilidad, precio, imágenes y cantidad.',
  vendor: 'KingBelt',
  productType: 'Fixture técnica',
  category: { id: 'scale:category:belts', name: 'Cinturones' },
  publicationStatus: 'published',
  primaryCollectionId: 'scale:collection',
  collectionIds: ['scale:collection'],
  options: [
    { id: 'scale:option:color', name: 'Color', purpose: 'color', values: colors },
    { id: 'scale:option:size', name: 'Talla', purpose: 'size', values: sizes },
  ],
  variants: colors.flatMap((color, colorIndex) =>
    sizes.flatMap((size, sizeIndex) => {
      if (sizeIndex === colorIndex) return [];
      const soldOut = colorIndex === 3 && sizeIndex === 19;
      const unavailable = colorIndex === 2 && sizeIndex === 18;
      return [{
        id: variantId(`scale:variant:${colorIndex}:${sizeIndex}`),
        sku: sku(`SCALE-${colorIndex}-${sizeIndex}`),
        optionValues: [
          { optionId: 'scale:option:color', valueId: color.id },
          { optionId: 'scale:option:size', valueId: size.id },
        ],
        price: { amountMinor: 8_900 + colorIndex * 250 + sizeIndex * 10, currency: 'EUR' },
        compareAtPrice: sizeIndex % 7 === 0
          ? { amountMinor: 10_500 + colorIndex * 250, currency: 'EUR' }
          : undefined,
        salesStatus: unavailable ? 'unavailable' as const : 'active' as const,
        inventory: { kind: 'known' as const, quantity: soldOut ? 0 : 12 },
        inventoryPolicy: 'deny' as const,
        quantityRule: {
          minimum: 1,
          increment: 1,
          ...(sizeIndex % 5 === 0 ? { maximum: 4 } : {}),
        },
        imageId: `scale:image:${colorIndex}:0`,
      }];
    })
  ),
  images,
  primaryImageId: images[0].id,
  mediaGroups: colors.map((color, colorIndex) => ({
    id: `scale:media:${colorIndex}`,
    optionValueId: color.id,
    imageIds: images
      .filter((image) => image.id.startsWith(`scale:image:${colorIndex}:`))
      .map((image) => image.id),
  })),
  specifications: [
    { label: 'Uso', value: 'Validación de escala' },
  ],
};
