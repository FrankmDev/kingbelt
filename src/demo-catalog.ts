/** Fixtures locales de la demo. Solo el proveedor local debe importar este módulo. */
import { moneyFromMajor } from '@commerce/domain/money';
import { productId, sku, variantId } from '@commerce/domain/identifiers';
import type {
  Collection,
  Product,
  ProductImage,
  ProductOptionValue,
  ProductVariant,
} from '@commerce/domain/catalog';

const image = (
  id: string,
  url: string,
  altText: string,
  position: string,
  width = 960,
  height = 1200
): ProductImage => ({ id, url, altText, position, width, height });

export const demoCollections: Collection[] = [
  {
    id: 'local:collection:vestir',
    handle: 'vestir',
    title: 'Vestir',
    image: image('collection:vestir:cover', '/images/blog/cinturon-negro.jpg', 'Cinturón negro de vestir sobre fondo neutro', 'center 62%'),
    description: 'Cinturones de silueta limpia para conjuntos formales: piel lisa, hebillas discretas y proporción contenida.',
    featured: true,
    badge: 'Principal',
    tagline: 'Silueta limpia para conjunto formal',
  },
  {
    id: 'local:collection:casual',
    handle: 'casual',
    title: 'Casual',
    image: image('collection:casual:cover', '/images/blog/cinturon-marron.jpg', 'Cinturón marrón para uso diario', 'center 55%'),
    description: 'Cinturones de uso diario con proporción contenida: cueros con carácter, trenzados y detalles discretos.',
    tagline: 'Proporción para el día a día',
  },
  {
    id: 'local:collection:sport',
    handle: 'sport',
    title: 'Sport',
    image: image('collection:sport:cover', '/images/brand/cinturones-en-taller.jpg', 'Selección de cinturones con acabado resistente', 'center 42%'),
    description: 'Cinturones de acabado resistente con herrajes de carácter industrial, pensados para aguantar el ritmo.',
    tagline: 'Acabado resistente con carácter',
  },
];

interface ImagePoolEntry {
  url: string;
  altBase: string;
  position: string;
}

const imagePool: ImagePoolEntry[] = [
  { url: '/images/blog/cinturon-negro.jpg', altBase: 'sobre fondo neutro', position: 'center 65%' },
  { url: '/images/blog/cinturon-marron.jpg', altBase: 'con textura de cuero', position: 'center 50%' },
  { url: '/images/blog/cinturon-marron-oscuro.jpg', altBase: 'en cuero marrón oscuro', position: 'center 58%' },
  { url: '/images/brand/cinturones-en-taller.jpg', altBase: 'con herraje metálico', position: 'center 40%' },
];

const swatches: Record<string, string> = {
  Negro: '#1c1a18',
  Marrón: '#6d4a2f',
  'Marrón oscuro': '#46301f',
  Coñac: '#a06836',
  'Negro / marrón': 'linear-gradient(135deg, #1c1a18 50%, #6d4a2f 50%)',
  'Marrón / negro': 'linear-gradient(135deg, #6d4a2f 50%, #1c1a18 50%)',
  'Negro / acero': 'linear-gradient(135deg, #1c1a18 50%, #7b7d78 50%)',
  'Marrón / detalle tricolor': 'linear-gradient(135deg, #6d4a2f 0 68%, #aa151b 68% 78%, #f1bf00 78% 90%, #aa151b 90%)',
};

const baseColorways = ['Negro', 'Marrón', 'Coñac'];
const sizes = ['85', '90', '95', '100', '105'];

const slugify = (value: string): string =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const colorValues = (handle: string, primary: string): ProductOptionValue[] =>
  [primary, ...baseColorways.filter((color) => color !== primary)]
    .slice(0, 3)
    .map((label) => ({
      id: `${handle}:color:${slugify(label)}`,
      label,
      swatch: swatches[label] ?? '#6d4a2f',
    }));

const galleryLabels = ['Vista principal', 'Detalle de textura', 'Vista de conjunto'];
const buildGallery = (
  handle: string,
  title: string,
  color: ProductOptionValue,
  poolIndex: number
): ProductImage[] =>
  galleryLabels.map((label, offset) => {
    const entry = imagePool[(poolIndex + offset) % imagePool.length];
    return image(
      `${handle}:image:${slugify(color.label)}:${offset + 1}`,
      entry.url,
      `${label} del cinturón ${title} en color ${color.label.toLocaleLowerCase('es')} ${entry.altBase}`,
      entry.position
    );
  });

type ProductSeed = [name: string, productType: string, color: string, price: number, excerpt: string];

const seeds: Record<string, ProductSeed[]> = {
  vestir: [
    ['Atlas', 'Piel lisa', 'Negro', 89, 'Cuero negro de silueta limpia para vestir.'],
    ['Meridian', 'Piel lisa', 'Marrón oscuro', 85, 'Marrón oscuro de grano fino y hebilla discreta.'],
    ['Corte', 'Hebilla fina', 'Negro', 92, 'Hebilla fina de perfil bajo para traje.'],
    ['Línea', 'Piel lisa', 'Negro', 79, 'Piel lisa con canto pulido y costura tonal.'],
    ['Norte', 'Reversible', 'Negro / marrón', 95, 'Reversible negro-marrón con hebilla giratoria.'],
    ['Villa', 'Piel lisa', 'Coñac', 88, 'Coñac de tono cálido para sastrería clara.'],
    ['Eje', 'Hebilla fina', 'Marrón oscuro', 90, 'Perfil estrecho con hebilla de línea fina.'],
    ['Marco', 'Piel lisa', 'Negro', 84, 'Negro mate de acabado uniforme.'],
    ['Prisma', 'Reversible', 'Marrón / negro', 98, 'Dos tonos en una sola pieza reversible.'],
    ['Solemne', 'Piel lisa', 'Negro', 99, 'Cuero seleccionado de brillo contenido.'],
    ['Recto', 'Hebilla fina', 'Marrón oscuro', 86, 'Silueta recta con herraje pulido.'],
    ['Consejo', 'Piel lisa', 'Coñac', 94, 'Coñac profundo con hebilla plateada mate.'],
  ],
  casual: [
    ['Ruta', 'Piel lisa', 'Marrón', 79, 'Marrón de uso diario, proporción contenida.'],
    ['Bandera', 'Edición', 'Marrón / detalle tricolor', 95, 'Cuero marrón con detalle tricolor discreto.'],
    ['Taller', 'Piel lisa', 'Marrón oscuro', 75, 'Cuero robusto que gana carácter con el uso.'],
    ['Camino', 'Trenzado', 'Marrón', 82, 'Trenzado flexible sin agujeros fijos.'],
    ['Puerto', 'Piel lisa', 'Coñac', 78, 'Coñac suave de tacto encerado.'],
    ['Senda', 'Trenzado', 'Marrón oscuro', 84, 'Trenzado oscuro de ajuste continuo.'],
    ['Molino', 'Piel lisa', 'Marrón', 76, 'Grano visible con costura en contraste.'],
    ['Huella', 'Edición', 'Negro', 89, 'Negro de uso diario con detalle grabado.'],
    ['Tramo', 'Trenzado', 'Coñac', 81, 'Trenzado coñac de tono medio.'],
    ['Vereda', 'Piel lisa', 'Marrón oscuro', 77, 'Marrón oscuro de corte recto.'],
    ['Orilla', 'Piel lisa', 'Marrón', 80, 'Cuero marrón con canto natural.'],
    ['Farol', 'Edición', 'Coñac', 92, 'Coñac envejecido con herraje latonado.'],
  ],
  sport: [
    ['Garaje', 'Herraje acero', 'Negro / acero', 85, 'Herraje de acero oscuro y acabado resistente.'],
    ['Circuito', 'Herraje acero', 'Negro', 87, 'Negro con hebilla de acero cepillado.'],
    ['Rodada', 'Técnico', 'Negro', 74, 'Construcción técnica de alta resistencia.'],
    ['Asfalto', 'Piel lisa', 'Negro', 82, 'Cuero negro de superficie sellada.'],
    ['Escape', 'Herraje acero', 'Marrón oscuro', 88, 'Marrón oscuro con herraje grafito.'],
    ['Faro', 'Técnico', 'Negro / acero', 79, 'Perfil técnico con hebilla ligera.'],
    ['Chasis', 'Piel lisa', 'Marrón oscuro', 83, 'Cuero grueso de estructura firme.'],
    ['Rótula', 'Herraje acero', 'Negro', 86, 'Hebilla articulada de acero oscuro.'],
    ['Carril', 'Técnico', 'Negro', 72, 'Banda técnica de mantenimiento mínimo.'],
    ['Grava', 'Piel lisa', 'Coñac', 84, 'Coñac de grano abierto y tacto seco.'],
    ['Pista', 'Herraje acero', 'Negro / acero', 91, 'Acero pulido sobre cuero negro denso.'],
    ['Túnel', 'Técnico', 'Marrón oscuro', 78, 'Marrón oscuro de acabado mate.'],
  ],
};

const badges: Record<string, string> = {
  'cinturon-atlas': 'Top ventas',
  'cinturon-ruta': 'Nuevo',
  'cinturon-garaje': 'Top ventas',
  'cinturon-bandera': 'Edición',
  'cinturon-meridian': 'Nuevo',
  'cinturon-circuito': 'Nuevo',
};

const buildVariants = (
  reference: string,
  handle: string,
  options: ProductOptionValue[],
  sizeOptions: ProductOptionValue[],
  price: number,
  imageIdsByColor: ReadonlyMap<string, string>
): ProductVariant[] =>
  options.flatMap((color) =>
    sizeOptions.map((sizeOption) => {
        const size = sizeOption.label;
        const unavailable = handle === 'cinturon-huella';
        const soldOut = handle === 'cinturon-garaje';
        const knownQuantity = unavailable ? undefined : soldOut ? 0 : handle === 'cinturon-bandera' ? 2 : 10;
        const suffix = `${slugify(color.label).toUpperCase()}-${size}`;
        return {
          id: variantId(`local:variant:${reference.toLocaleLowerCase('es')}:${slugify(color.label)}:${size}`),
          sku: sku(`${reference}-${suffix}`),
          title: `${color.label} / ${size}`,
          optionValues: [
            { optionId: `${handle}:option:color`, valueId: color.id },
            { optionId: `${handle}:option:size`, valueId: sizeOption.id },
          ],
          price: moneyFromMajor(price),
          salesStatus: unavailable ? 'unavailable' as const : 'active' as const,
          inventory: knownQuantity === undefined
            ? { kind: 'unknown' as const }
            : { kind: 'known' as const, quantity: knownQuantity },
          inventoryPolicy: 'deny' as const,
          quantityRule: { minimum: 1, increment: 1 },
          imageId: imageIdsByColor.get(color.id),
        };
      })
  );

const buildProducts = (): Product[] =>
  demoCollections.flatMap((collection) =>
    (seeds[collection.handle] ?? []).map(([name, productType, color, price, summary], index) => {
      const reference = `KB-${collection.handle.toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
      const handle = `cinturon-${slugify(name)}`;
      const colors = colorValues(handle, color);
      const sizeOptions = sizes
        .filter((size) => !(handle === 'cinturon-circuito' && size === '100'))
        .map((label) => ({ id: `${handle}:size:${label}`, label }));
      const galleries = colors.map((colorValue, colorIndex) => ({
        color: colorValue,
        images: buildGallery(handle, name, colorValue, index + colorIndex),
      }));
      const images = galleries.flatMap((item) => item.images);
      const imageIdsByColor = new Map(galleries.map((item) => [item.color.id, item.images[0].id]));
      const variants = buildVariants(reference, handle, colors, sizeOptions, price, imageIdsByColor);
      const description = `${summary} Pieza de la selección ${collection.title.toLocaleLowerCase('es')}, diseñada y terminada en España y revisada a mano antes de salir del taller.`;

      return {
        id: productId(`local:product:${collection.handle}:${String(index + 1).padStart(3, '0')}`),
        handle,
        title: `Cinturón ${name}`,
        reference,
        description,
        summary,
        vendor: 'KingBelt',
        productType,
        category: { id: 'local:category:belts', name: 'Cinturones' },
        publicationStatus: 'published',
        primaryCollectionId: collection.id,
        collectionIds: [collection.id],
        options: [
          { id: `${handle}:option:color`, name: 'Color', purpose: 'color' as const, values: colors },
          {
            id: `${handle}:option:size`,
            name: 'Talla',
            purpose: 'size' as const,
            values: sizeOptions,
          },
        ],
        variants,
        images,
        primaryImageId: images[0]?.id,
        mediaGroups: galleries.map((item) => ({
          id: `${handle}:media:${slugify(item.color.label)}`,
          optionValueId: item.color.id,
          imageIds: item.images.map((media) => media.id),
        })),
        specifications: [
          { label: 'Referencia', value: reference },
          { label: 'Acabado', value: productType },
          { label: 'Color', value: color },
          { label: 'Material', value: 'Piel de origen europeo' },
          { label: 'Origen', value: 'Diseñado y terminado en España' },
        ],
        badge: badges[handle],
        seo: { title: `Cinturón ${name} — KingBelt`, description: summary },
      };
    })
  );

export const demoProducts: Product[] = buildProducts();

export const demoFeaturedProductHandles = [
  'cinturon-atlas',
  'cinturon-ruta',
  'cinturon-garaje',
  'cinturon-bandera',
] as const;
