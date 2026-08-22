import { describe, expect, test } from 'bun:test';
import { siteUrl } from '../src/config/site.ts';
import {
  getRobotsForQuery,
  resolveCatalogIndexHead,
  resolveCollectionPageHead,
  resolveCommerceRobots,
  resolveProductPageHead,
} from '../src/commerce/application/seo.ts';
import { CATALOG_INDEX_PATH, productPath, resolveCanonicalUrl } from '../src/commerce/application/paths.ts';
import {
  COLLECTION_SCHEMA_MAX_ITEMS,
  createCollectionStructuredData,
  createProductStructuredData,
} from '../src/commerce/application/structured-data.ts';
import {
  buildProductRedirectMap,
  resolveProductRedirectTarget,
} from '../src/commerce/application/product-redirects.ts';
import { isSafeInternalPath } from '../src/commerce/domain/url-policy.ts';
import { toCanonicalUrl } from '../src/shared/url.ts';
import { createPageSeo } from '../src/shared/seo/page-head.ts';
import { isSearchIndexableDeployment, resolveIndexRobots } from '../src/shared/seo/deployment.ts';
import {
  createOrganizationSchema,
  createFaqPageSchema,
  SITE_ORGANIZATION_ID,
} from '../src/shared/seo/structured-data.ts';
import { GET as robotsGET } from '../src/pages/robots.txt.ts';
import { isSitemapExcluded, getSsrSitemapUrls, buildCommerceSitemapUrls } from '../src/config/sitemap.ts';
import { getLegalSitemapExcludedPaths } from '../src/content/legal.ts';

const site = { name: 'KingBelt' };

const colorOptionId = 'option:color';
const sizeOptionId = 'option:size';

const makeVariant = ({
  id,
  sku,
  price,
  salesStatus = 'active',
  quantity = 5,
  inventoryPolicy = 'deny',
}) => ({
  id,
  sku,
  optionValues: [
    { optionId: colorOptionId, valueId: 'color:negro' },
    { optionId: sizeOptionId, valueId: 'size:95' },
  ],
  price: { amountMinor: price, currency: 'EUR' },
  salesStatus,
  inventory: { kind: 'known', quantity },
  inventoryPolicy,
  quantityRule: { minimum: 1, increment: 1 },
});

const makeProduct = (overrides = {}) => ({
  id: 'product:test',
  reference: 'KB-TEST',
  handle: 'cinturon-test',
  title: 'Cinturón Test',
  description: 'Descripción completa del producto de prueba.',
  summary: 'Resumen comercial del producto.',
  vendor: 'KingBelt',
  productType: 'Piel lisa',
  category: { id: 'category:belts', name: 'Cinturones' },
  publicationStatus: 'published',
  primaryCollectionId: 'collection:test',
  collectionIds: ['collection:test'],
  options: [],
  variants: [
    makeVariant({ id: 'variant:a', sku: 'SKU-A', price: 8_900 }),
    makeVariant({ id: 'variant:b', sku: 'SKU-B', price: 9_900 }),
  ],
  images: [
    {
      id: 'image:primary',
      url: '/images/imagen-cinturon-kingbelt-10.avif',
      altText: 'Cinturón de prueba',
      width: 960,
      height: 1200,
    },
  ],
  primaryImageId: 'image:primary',
  mediaGroups: [],
  specifications: [],
  ...overrides,
});

describe('SEO canónico y robots', () => {
  test('mantiene URLs estables por handle sin parámetros de consulta', () => {
    expect(productPath('cinturon-bandera')).toBe('/productos/cinturon-bandera');
    expect(resolveCanonicalUrl(siteUrl, '/productos/cinturon-bandera')).toBe(
      'https://kingbelt.es/productos/cinturon-bandera'
    );
  });

  test('bloquea indexación de filtros, variantes y paginación futura', () => {
    expect(getRobotsForQuery(new URLSearchParams('tipo=piel'))).toBe('noindex,follow');
    expect(getRobotsForQuery(new URLSearchParams('disponible=1'))).toBe('noindex,follow');
    expect(getRobotsForQuery(new URLSearchParams('categoria=vestir'))).toBe('noindex,follow');
    expect(getRobotsForQuery(new URLSearchParams('variant=variant:abc'))).toBe('noindex,follow');
    expect(getRobotsForQuery(new URLSearchParams('page=2'))).toBe('noindex,follow');
    expect(getRobotsForQuery(new URLSearchParams('page=1'))).toBeUndefined();
    expect(getRobotsForQuery()).toBeUndefined();
    expect(resolveCommerceRobots({ indexable: false })).toBe('noindex,follow');
    expect(resolveCommerceRobots({
      indexable: true,
      searchParams: new URLSearchParams('color=negro'),
    })).toBe('noindex,follow');
    expect(resolveCommerceRobots({ indexable: true })).toBeUndefined();
  });

  test('el canonical público ignora barras finales y el host de la petición', () => {
    expect(toCanonicalUrl(siteUrl, '/blog/')).toBe('https://kingbelt.es/blog');
    expect(toCanonicalUrl(siteUrl, '/')).toBe('https://kingbelt.es/');
    expect(createPageSeo({
      title: 'Contacto — KingBelt',
      description: 'Contacto.',
      pathname: '/contacto/',
    }).canonicalUrl).toBe('https://kingbelt.es/contacto');
  });
});

describe('cabecera de páginas de comercio', () => {
  test('resuelve SEO y schema de producto en una sola pasada', () => {
    const product = makeProduct({
      seo: {
        title: 'Título SEO — KingBelt',
        description: 'Descripción SEO específica.',
      },
    });
    const { seo, schema } = resolveProductPageHead(product, site, siteUrl);
    expect(seo.title).toBe('Título SEO — KingBelt');
    expect(seo.description).toBe('Descripción SEO específica.');
    expect(seo.canonicalUrl).toBe('https://kingbelt.es/productos/cinturon-test');
    expect(seo.ogType).toBe('product');
    expect(schema['@type']).toBe('Product');
    expect(schema.url).toBe(seo.canonicalUrl);
  });

  test('resuelve SEO de colección con canonical limpio', () => {
    const { seo } = resolveCollectionPageHead(
      {
        collection: {
          id: 'collection:test',
          handle: 'piel-lisa',
          title: 'Piel lisa',
          description: 'Colección de cinturones de piel lisa.',
        },
        products: [],
        facets: { productTypes: [], colors: [], priceRanges: [] },
      },
      site,
      siteUrl
    );
    expect(seo.canonicalUrl).toBe('https://kingbelt.es/categorias/piel-lisa');
    expect(seo.ogType).toBe('website');
  });

  test('resuelve SEO del índice de catálogo en /productos', () => {
    const { seo, schema } = resolveCatalogIndexHead(
      {
        title: 'Cinturones de cuero — Colección KingBelt',
        description: 'Colección completa.',
        products: [],
        collections: [{
          id: 'collection:vestir',
          handle: 'vestir',
          title: 'Vestir',
          description: 'Cinturones de vestir.',
          featured: true,
        }],
      },
      site,
      siteUrl
    );
    expect(CATALOG_INDEX_PATH).toBe('/productos');
    expect(seo.canonicalUrl).toBe('https://kingbelt.es/productos');
    expect(seo.ogType).toBe('website');
    expect(schema['@type']).toBe('CollectionPage');
  });
});

describe('datos estructurados de producto', () => {
  test('representa rangos de precio con AggregateOffer y sin ofertas por variante', () => {
    const schema = createProductStructuredData(makeProduct(), 'https://kingbelt.es/productos/cinturon-test', 'KingBelt');
    expect(schema.mpn).toBe('KB-TEST');
    expect(schema.sku).toBeUndefined();
    expect(schema.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '89.00',
      highPrice: '99.00',
      priceCurrency: 'EUR',
      offerCount: 2,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        merchantReturnDays: 30,
        applicableCountry: 'ES',
      },
    });
    expect(schema.image[0]).toMatchObject({
      '@type': 'ImageObject',
      width: 960,
      height: 1200,
    });
  });

  test('usa Offer única con sku real solo en productos de una variante activa', () => {
    const schema = createProductStructuredData(
      makeProduct({ variants: [makeVariant({ id: 'variant:solo', sku: 'SKU-SOLO', price: 8_900 })] }),
      'https://kingbelt.es/productos/cinturon-test',
      'KingBelt'
    );
    expect(schema.offers).toMatchObject({
      '@type': 'Offer',
      price: '89.00',
      sku: 'SKU-SOLO',
    });
  });

  test('no publica como SKU comercial el identificador técnico del runtime', () => {
    const schema = createProductStructuredData(
      makeProduct({
        variants: [makeVariant({
          id: 'gid://shopify/ProductVariant/90',
          sku: 'shopify-variant-90',
          price: 8_900,
        })],
      }),
      'https://kingbelt.es/productos/cinturon-test',
      'KingBelt'
    );
    expect(schema.offers).toMatchObject({ '@type': 'Offer', price: '89.00' });
    expect(schema.offers.sku).toBeUndefined();
  });

  test('los productos agotados permanecen en schema como OutOfStock sin desindexarse', () => {
    const product = makeProduct({
      variants: [
        makeVariant({ id: 'variant:oos', sku: 'SKU-OOS', price: 8_900, quantity: 0 }),
      ],
    });
    const { seo } = resolveProductPageHead(product, site, siteUrl);
    const schema = createProductStructuredData(product, seo.canonicalUrl, 'KingBelt');
    expect(seo.robots).toBeUndefined();
    expect(resolveProductPageHead(product, site, siteUrl, { indexable: false }).seo.robots)
      .toBe('noindex,follow');
    expect(schema.offers.availability).toBe('https://schema.org/OutOfStock');
    expect(schema.offers.price).toBe('89.00');
  });

  test('omite ofertas cuando no quedan variantes activas', () => {
    const product = makeProduct({
      variants: [
        makeVariant({ id: 'variant:off', sku: 'SKU-OFF', price: 8_900, salesStatus: 'unavailable' }),
      ],
    });
    const schema = createProductStructuredData(product, 'https://kingbelt.es/productos/cinturon-test', 'KingBelt');
    expect(schema.offers).toBeUndefined();
    expect(schema.name).toBe('Cinturón Test');
  });
});

describe('datos estructurados de colección', () => {
  test('lista productos con URLs canónicas por handle', () => {
    const schema = createCollectionStructuredData(
      { handle: 'piel-lisa', title: 'Piel lisa', description: 'Colección de prueba.' },
      [
        {
          id: 'product:a',
          handle: 'cinturon-a',
          title: 'Cinturón A',
          reference: 'KB-A',
          primaryCollection: { id: 'collection:test', handle: 'piel-lisa', title: 'Piel lisa' },
          productType: 'Piel lisa',
          summary: 'Resumen A',
          priceRange: {
            min: { amountMinor: 8_900, currency: 'EUR' },
            max: { amountMinor: 8_900, currency: 'EUR' },
          },
          purchasable: true,
          colors: [],
        },
      ],
      'https://kingbelt.es/categorias/piel-lisa',
      siteUrl
    );
    expect(schema.mainEntity.itemListElement[0].url).toBe('https://kingbelt.es/productos/cinturon-a');
  });
});

describe('sitemap y redirecciones', () => {
  test('excluye rutas internas y carrito, pero indexa documentos publicados', () => {
    expect(isSitemapExcluded('/carrito')).toBe(true);
    expect(isSitemapExcluded('/cart-catalog.json')).toBe(true);
    expect(isSitemapExcluded('/cuenta/iniciar')).toBe(true);
    expect(isSitemapExcluded('/rss.xml')).toBe(true);
    expect(isSitemapExcluded('/guia-de-tallas')).toBe(false);
    expect(isSitemapExcluded('/aviso-legal')).toBe(false);
    expect(isSitemapExcluded('/')).toBe(false);
    expect(isSitemapExcluded('/productos')).toBe(false);
    expect(isSitemapExcluded('/productos/cinturon-bandera')).toBe(false);
    expect(getLegalSitemapExcludedPaths()).toContain('/desistimiento');
  });

  test('resuelve destinos de redirección de productos eliminados', () => {
    expect(resolveProductRedirectTarget({ type: 'product', handle: 'nuevo-handle' }))
      .toBe('/productos/nuevo-handle');
    expect(resolveProductRedirectTarget({ type: 'collection', handle: 'piel-lisa' }))
      .toBe('/categorias/piel-lisa');
    expect(() => resolveProductRedirectTarget({ type: 'path', path: 'https://evil.test' }))
      .toThrow(/no segura/);
    expect(isSafeInternalPath('/categorias/piel-lisa')).toBe(true);
    expect(isSafeInternalPath('//evil.test')).toBe(false);
    expect(buildProductRedirectMap()).toEqual({});
  });

  test('limita el ItemList de colección para catálogos grandes', () => {
    const products = Array.from({ length: COLLECTION_SCHEMA_MAX_ITEMS + 10 }, (_, index) => ({
      id: `product:${index}`,
      handle: `producto-${index}`,
      title: `Producto ${index}`,
      reference: `KB-${index}`,
      primaryCollection: { id: 'collection:test', handle: 'piel-lisa', title: 'Piel lisa' },
      productType: 'Piel lisa',
      summary: 'Resumen',
      priceRange: {
        min: { amountMinor: 8_900, currency: 'EUR' },
        max: { amountMinor: 8_900, currency: 'EUR' },
      },
      purchasable: true,
      colors: [],
    }));
    const schema = createCollectionStructuredData(
      { handle: 'piel-lisa', title: 'Piel lisa', description: 'Colección de prueba.' },
      products,
      `${siteUrl}/categorias/piel-lisa`,
      siteUrl
    );
    expect(schema.mainEntity.numberOfItems).toBe(products.length);
    expect(schema.mainEntity.itemListElement).toHaveLength(COLLECTION_SCHEMA_MAX_ITEMS);
  });

  test('el sitemap editorial SSR incluye la portada y el de comercio omite el catálogo demo', () => {
    expect(getSsrSitemapUrls(siteUrl)).toEqual(['https://kingbelt.es/']);
    expect(buildCommerceSitemapUrls(siteUrl, ['cinturon-test'], ['vestir'], false)).toEqual([]);
    expect(buildCommerceSitemapUrls(siteUrl, ['cinturon-test'], ['vestir'], true)).toEqual([
      'https://kingbelt.es/productos',
      'https://kingbelt.es/categorias/vestir',
      'https://kingbelt.es/productos/cinturon-test',
    ]);
  });
});

describe('señales de entidad y robots de deployment', () => {
  test('Organization usa identidad legal confirmada', () => {
    const organization = createOrganizationSchema();
    expect(organization['@id']).toBe(SITE_ORGANIZATION_ID);
    expect(organization.legalName).toBe('CintuElx S.L.');
    expect(organization.address).toMatchObject({
      '@type': 'PostalAddress',
      postalCode: '03206',
      addressLocality: 'Elche',
      addressCountry: 'ES',
    });
  });

  test('FAQPage serializa preguntas y respuestas', () => {
    const schema = createFaqPageSchema(
      [{ question: '¿Cuánto cuesta el envío?', answer: 'Envíos gratuitos.' }],
      'https://kingbelt.es/contacto'
    );
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: '¿Cuánto cuesta el envío?',
    });
  });

  test('preview de Vercel no se indexa y producción conserva index,follow', () => {
    const previous = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    expect(isSearchIndexableDeployment()).toBe(true);
    expect(resolveIndexRobots()).toBe('index,follow');
    process.env.VERCEL_ENV = 'preview';
    expect(isSearchIndexableDeployment()).toBe(false);
    expect(resolveIndexRobots('index,follow')).toBe('noindex,nofollow');
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  });

  test('robots.txt bloquea superficies privadas y declara ambos sitemaps', async () => {
    const previous = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    const response = await robotsGET({ site: new URL('https://kingbelt.es/') });
    const body = await response.text();
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /carrito');
    expect(body).toContain('Disallow: /cuenta/');
    expect(body).toContain('Disallow: /desistimiento');
    expect(body).toContain('Sitemap: https://kingbelt.es/sitemap-index.xml');
    expect(body).toContain('Sitemap: https://kingbelt.es/sitemap-commerce.xml');
    process.env.VERCEL_ENV = 'preview';
    const preview = await robotsGET({ site: new URL('https://kingbelt.es/') });
    expect(await preview.text()).toContain('Disallow: /');
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  });
});
