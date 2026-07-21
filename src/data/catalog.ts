/** Datos provisionales de catálogo — sustituir por capa de comercio / Shopify. */

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  /** Ruta de la página de categoría. */
  href: string;
  /** Descripción breve provisional para la cabecera de la página de categoría. */
  description: string;
  featured?: boolean;
  badge?: string;
  tagline?: string;
}

export interface ProductPreview {
  id: string;
  name: string;
  slug: string;
  category: string;
  color: string;
  price: number;
  currency: 'EUR';
  image: string;
  imageAlt: string;
  imagePosition?: string;
  badge?: string;
  /** Descripción breve provisional para cards de selección. */
  excerpt: string;
  /** Ruta de la ficha de producto (PDP). */
  href: string;
}

/** Ruta de la ficha de producto (PDP). */
export const getProductHref = (slug: string) => `/productos/${slug}`;

export const productCategories: ProductCategory[] = [
  {
    id: 'vestir',
    name: 'Vestir',
    slug: 'vestir',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro de vestir sobre fondo neutro',
    imagePosition: 'center 62%',
    href: '/categorias/vestir',
    description:
      'Cinturones de silueta limpia para conjuntos formales: piel lisa, hebillas discretas y proporción contenida.',
    featured: true,
    badge: 'Principal',
    tagline: 'Silueta limpia para conjunto formal',
  },
  {
    id: 'casual',
    name: 'Casual',
    slug: 'casual',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón marrón para uso diario',
    imagePosition: 'center 55%',
    href: '/categorias/casual',
    description:
      'Cinturones de uso diario con proporción contenida: cueros con carácter, trenzados y detalles discretos.',
    tagline: 'Proporción para el día a día',
  },
  {
    id: 'sport',
    name: 'Sport',
    slug: 'sport',
    image: '/image.jpg',
    imageAlt: 'Selección de cinturones con acabado resistente',
    imagePosition: 'center 42%',
    href: '/categorias/sport',
    description:
      'Cinturones de acabado resistente con herrajes de carácter industrial, pensados para aguantar el ritmo.',
    tagline: 'Acabado resistente con carácter',
  },
];

export const featuredProducts: ProductPreview[] = [
  {
    id: 'kb-001',
    name: 'Cinturón Atlas',
    slug: 'cinturon-atlas',
    category: 'Vestir',
    color: 'Negro',
    price: 89,
    currency: 'EUR',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón Atlas negro con hebilla metálica',
    imagePosition: 'center 65%',
    badge: 'Top ventas',
    excerpt: 'Cuero negro de silueta limpia para vestir.',
    href: getProductHref('cinturon-atlas'),
  },
  {
    id: 'kb-002',
    name: 'Cinturón Ruta',
    slug: 'cinturon-ruta',
    category: 'Casual',
    color: 'Marrón',
    price: 79,
    currency: 'EUR',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón Ruta marrón con textura de cuero',
    imagePosition: 'center 50%',
    badge: 'Nuevo',
    excerpt: 'Marrón de uso diario, proporción contenida.',
    href: getProductHref('cinturon-ruta'),
  },
  {
    id: 'kb-003',
    name: 'Cinturón Garaje',
    slug: 'cinturon-garaje',
    category: 'Sport',
    color: 'Negro / acero',
    price: 85,
    currency: 'EUR',
    image: '/image.jpg',
    imageAlt: 'Cinturón Garaje con herraje oscuro',
    imagePosition: 'center 40%',
    excerpt: 'Herraje de acero oscuro y acabado resistente.',
    href: getProductHref('cinturon-garaje'),
  },
  {
    id: 'kb-004',
    name: 'Cinturón Bandera',
    slug: 'cinturon-bandera',
    category: 'Casual',
    color: 'Marrón / detalle tricolor',
    price: 95,
    currency: 'EUR',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Cinturón con detalle de bandera española',
    imagePosition: 'center 58%',
    badge: 'Edición',
    excerpt: 'Cuero marrón con detalle tricolor discreto.',
    href: getProductHref('cinturon-bandera'),
  },
];

export const formatPrice = (price: number, currency: ProductPreview['currency'] = 'EUR') =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

/* ------------------------------------------------------------------------ */
/* Productos de colección (placeholder — fase 2 demo local)                  */
/* ------------------------------------------------------------------------ */

export interface CollectionProduct extends ProductPreview {
  /** Subcategoría provisional usada como faceta de filtrado. */
  subcategory: string;
}

/* ------------------------------------------------------------------------ */
/* Ficha de producto (placeholder — fase 2 demo local)                        */
/* ------------------------------------------------------------------------ */

export interface ProductGalleryImage {
  src: string;
  alt: string;
  position?: string;
}

export interface ProductColorOption {
  name: string;
  /** Muestra CSS del color (hex o degradado para colorways dobles). */
  swatch: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductDetail extends CollectionProduct {
  /** Galería provisional de 3 vistas derivada del pool de imágenes. */
  gallery: ProductGalleryImage[];
  /** Tallas en cm, placeholder común a la selección de cinturones. */
  sizes: string[];
  /** Color propio + alternativos provisionales. */
  colorOptions: ProductColorOption[];
  /** Ficha técnica breve; solo afirmaciones ya públicas en la web. */
  specs: ProductSpec[];
  /** Descripción de ficha derivada del excerpt y de copy ya público. */
  description: string;
}

/** Tallas de cinturón en cm — placeholder común de la demo local. */
export const productSizes = ['85', '90', '95', '100', '105'];

const colorSwatches: Record<string, string> = {
  Negro: '#1c1a18',
  Marrón: '#6d4a2f',
  'Marrón oscuro': '#46301f',
  Coñac: '#a06836',
  'Negro / marrón': 'linear-gradient(135deg, #1c1a18 50%, #6d4a2f 50%)',
  'Marrón / negro': 'linear-gradient(135deg, #6d4a2f 50%, #1c1a18 50%)',
  'Negro / acero': 'linear-gradient(135deg, #1c1a18 50%, #7b7d78 50%)',
};

/** Colorways base usados como alternativas provisionales de color. */
const baseColorways = ['Negro', 'Marrón', 'Coñac'];

const buildColorOptions = (color: string): ProductColorOption[] =>
  [color, ...baseColorways.filter((base) => base !== color)]
    .slice(0, 3)
    .map((name) => ({ name, swatch: colorSwatches[name] ?? '#6d4a2f' }));

const galleryViewLabels = ['Vista principal', 'Detalle de textura', 'Vista de conjunto'];

const buildGallery = (name: string, color: string, poolIndex: number): ProductGalleryImage[] =>
  galleryViewLabels.map((viewLabel, offset) => {
    const entry = collectionImagePool[(poolIndex + offset) % collectionImagePool.length];

    return {
      src: entry.image,
      alt: `${viewLabel} del cinturón ${name} en color ${color.toLowerCase()} ${entry.imageAltBase}`,
      position: entry.imagePosition,
    };
  });

interface CollectionImagePoolEntry {
  image: string;
  imageAltBase: string;
  imagePosition: string;
}

/** [nombre, subcategoría, color, precio, descripción breve] */
type CollectionProductSeed = [string, string, string, number, string];

/** Pool de imágenes reutilizado mientras no exista fotografía de producto real. */
const collectionImagePool: CollectionImagePoolEntry[] = [
  {
    image: '/images/blog/cinturon-negro.jpg',
    imageAltBase: 'sobre fondo neutro',
    imagePosition: 'center 65%',
  },
  {
    image: '/images/blog/cinturon-marron.jpg',
    imageAltBase: 'con textura de cuero',
    imagePosition: 'center 50%',
  },
  {
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAltBase: 'en cuero marrón oscuro',
    imagePosition: 'center 58%',
  },
  {
    image: '/image.jpg',
    imageAltBase: 'con herraje metálico',
    imagePosition: 'center 40%',
  },
];

const collectionSeeds: Record<string, CollectionProductSeed[]> = {
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const buildCollectionProducts = (
  category: ProductCategory,
  seeds: CollectionProductSeed[]
): ProductDetail[] =>
  seeds.map(([name, subcategory, color, price, excerpt], index) => {
    const poolEntry = collectionImagePool[index % collectionImagePool.length];
    const slug = `cinturon-${slugify(name)}`;
    const id = `kb-${category.slug}-${String(index + 1).padStart(3, '0')}`;

    return {
      id,
      name: `Cinturón ${name}`,
      slug,
      category: category.name,
      subcategory,
      color,
      price,
      currency: 'EUR',
      image: poolEntry.image,
      imageAlt: `Cinturón ${name} en color ${color.toLowerCase()} ${poolEntry.imageAltBase}`,
      imagePosition: poolEntry.imagePosition,
      badge: index === 0 ? 'Top ventas' : index === 1 ? 'Nuevo' : undefined,
      excerpt,
      href: getProductHref(slug),
      gallery: buildGallery(name, color, index),
      sizes: productSizes,
      colorOptions: buildColorOptions(color),
      specs: [
        { label: 'Referencia', value: id.toUpperCase() },
        { label: 'Acabado', value: subcategory },
        { label: 'Color', value: color },
        { label: 'Material', value: 'Piel de origen europeo' },
        { label: 'Origen', value: 'Diseñado y terminado en España' },
      ],
      description: `${excerpt} Pieza de la selección ${category.name.toLowerCase()}, diseñada y terminada en España y revisada a mano antes de salir del taller.`,
    };
  });

/** Productos placeholder por categoría — sustituir por la capa de comercio. */
export const collectionProductsByCategory: Record<string, ProductDetail[]> = Object.fromEntries(
  productCategories.map((category) => [
    category.slug,
    buildCollectionProducts(category, collectionSeeds[category.slug] ?? []),
  ])
);

export const getCollectionProducts = (categorySlug: string): ProductDetail[] =>
  collectionProductsByCategory[categorySlug] ?? [];

/** Todas las fichas de producto de la demo local. */
export const getAllProductDetails = (): ProductDetail[] =>
  Object.values(collectionProductsByCategory).flat();

/** Ficha de producto por slug. */
export const getProductBySlug = (slug: string): ProductDetail | undefined =>
  getAllProductDetails().find((product) => product.slug === slug);

/** Categoría a la que pertenece una ficha (por nombre de categoría del producto). */
export const getProductCategory = (product: ProductDetail): ProductCategory | undefined =>
  productCategories.find((category) => category.name === product.category);

/** Selección de la misma categoría, excluyendo el propio producto. */
export const getRelatedProducts = (product: ProductDetail, count = 4): ProductDetail[] => {
  const category = getProductCategory(product);
  if (!category) return [];

  return getCollectionProducts(category.slug)
    .filter((item) => item.slug !== product.slug)
    .slice(0, count);
};

/* ------------------------------------------------------------------------ */
/* Facetas de filtrado (derivadas de los productos de cada categoría)        */
/* ------------------------------------------------------------------------ */

export interface CollectionFacetValue {
  value: string;
  count: number;
}

export interface CollectionPriceRange {
  id: string;
  label: string;
}

export interface CollectionFacets {
  subcategories: CollectionFacetValue[];
  colors: CollectionFacetValue[];
  priceRanges: CollectionPriceRange[];
}

/** Rangos de precio provisionales para el panel de filtros. */
export const collectionPriceRanges: CollectionPriceRange[] = [
  { id: 'lt-80', label: 'Menos de 80 €' },
  { id: '80-90', label: '80 € – 90 €' },
  { id: 'gt-90', label: 'Más de 90 €' },
];

const countFacetValues = (values: string[]): CollectionFacetValue[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
};

export const getCollectionFacets = (products: CollectionProduct[]): CollectionFacets => ({
  subcategories: countFacetValues(products.map((product) => product.subcategory)),
  colors: countFacetValues(products.map((product) => product.color)),
  priceRanges: collectionPriceRanges,
});
