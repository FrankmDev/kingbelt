import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { demoCollections, demoProducts } from '../src/demo-catalog.ts';
import { aboutPage } from '../src/content/about.ts';
import { publicSecurityConfig } from '../src/config/security.ts';
import { validateCatalog } from '../src/commerce/application/catalog-validation.ts';
import { getSafeCheckoutUrl, MAX_CHECKOUT_URL_LENGTH, buildShopifyCheckoutHosts } from '../src/commerce/application/checkout.ts';
import { resolveProductRedirectTarget } from '../src/commerce/application/product-redirects.ts';
import { createCartService, emptyCart } from '../src/commerce/application/cart-service.ts';
import { demoCartCatalog } from '../src/commerce/infrastructure/demo/demo-catalog-adapter.ts';
import { isAllowedImageUrl } from '../src/commerce/domain/url-policy.ts';
import { serializeJsonForHtml } from '../src/shared/security/serialize-json-for-html.ts';

const root = resolve(import.meta.dir, '..');
const walk = (directory) => readdirSync(directory)
  .flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const collectStrings = (value) => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
};

describe('serialización y contenido externo', () => {
  test('el JSON embebido no puede cerrar el script ni crear HTML ejecutable', () => {
    const payload = {
      title: '</script><img src=x onerror=alert(1)>',
      separators: '\u2028\u2029',
      query: 'a&b',
    };
    const serialized = serializeJsonForHtml(payload);

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(JSON.parse(serialized)).toEqual(payload);
  });

  test('solo permite imágenes locales o HTTPS desde hosts exactos aprobados', () => {
    const allowed = publicSecurityConfig.remoteImageHosts;
    expect(isAllowedImageUrl('/images/producto.jpg', allowed)).toBe(true);
    expect(isAllowedImageUrl('https://images.unsplash.com/photo.jpg', allowed)).toBe(true);
    expect(isAllowedImageUrl('https://cdn.shopify.com/s/files/product.jpg', allowed)).toBe(true);
    expect(isAllowedImageUrl('https://cdn.shopify.com.evil.test/product.jpg', allowed)).toBe(false);
    expect(isAllowedImageUrl('https://images.unsplash.com.evil.test/photo.jpg', allowed)).toBe(false);
    expect(isAllowedImageUrl('https://user:pass@images.unsplash.com/photo.jpg', allowed)).toBe(false);
    expect(isAllowedImageUrl('http://images.unsplash.com/photo.jpg', allowed)).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)', allowed)).toBe(false);
    expect(isAllowedImageUrl('//images.unsplash.com/photo.jpg', allowed)).toBe(false);
  });

  test('las imágenes editoriales remotas actuales pertenecen a la allowlist', () => {
    const remoteUrls = collectStrings(aboutPage).filter((value) => /^https?:\/\//.test(value));
    expect(remoteUrls.length).toBeGreaterThan(0);
    expect(remoteUrls.every((url) => isAllowedImageUrl(url, publicSecurityConfig.remoteImageHosts)))
      .toBe(true);
  });

  test('el catálogo rechaza HTML, hosts de imagen no aprobados y textos excesivos', () => {
    const products = structuredClone(demoProducts);
    products[0].description = '<img src=x onerror=alert(1)>';
    products[0].images[0].url = 'https://images.unsplash.com.evil.test/product.jpg';
    products[1].summary = 'x'.repeat(10_001);

    const codes = validateCatalog(
      products,
      demoCollections,
      ['EUR'],
      publicSecurityConfig.remoteImageHosts
    ).map((finding) => finding.code);

    expect(codes).toContain('unsafe_catalog_html');
    expect(codes).toContain('invalid_image_url');
    expect(codes).toContain('empty_product_summary');
  });
});

describe('checkout y carrito como entradas no confiables', () => {
  test('rechaza redirecciones con estado, esquema, credenciales, host o tamaño inseguros', () => {
    const base = { status: 'ready', allowedHosts: ['checkout.example.com'] };
    expect(getSafeCheckoutUrl({ ...base, url: 'https://checkout.example.com/cart/1' })?.pathname)
      .toBe('/cart/1');
    expect(getSafeCheckoutUrl({ ...base, status: 'error', url: 'https://checkout.example.com/cart/1' }))
      .toBeNull();
    expect(getSafeCheckoutUrl({ ...base, url: ' https://checkout.example.com/cart/1' })).toBeNull();
    expect(getSafeCheckoutUrl({ ...base, url: 'https://checkout.example.com.evil.test/cart/1' }))
      .toBeNull();
    expect(getSafeCheckoutUrl({ ...base, url: 'https://user:pass@checkout.example.com/cart/1' }))
      .toBeNull();
    expect(getSafeCheckoutUrl({ ...base, url: `https://checkout.example.com/${'x'.repeat(MAX_CHECKOUT_URL_LENGTH)}` }))
      .toBeNull();
    expect(() => resolveProductRedirectTarget({ type: 'path', path: 'https://evil.test' })).toThrow();
    expect(() => resolveProductRedirectTarget({ type: 'path', path: '//evil.test' })).toThrow();
    expect(resolveProductRedirectTarget({ type: 'path', path: '/ayuda' })).toBe('/ayuda');
  });

  test('ignora precio, stock e identidad de producto falsificados por el cliente', () => {
    const service = createCartService(demoCartCatalog);
    const authoritativeProduct = demoProducts.find((product) => product.variants.some((variant) =>
      variant.salesStatus === 'active' &&
      (variant.inventory.kind === 'unknown' || variant.inventory.quantity > 0 || variant.inventoryPolicy === 'continue')
    ));
    const authoritative = authoritativeProduct.variants.find((variant) =>
      variant.salesStatus === 'active' &&
      (variant.inventory.kind === 'unknown' || variant.inventory.quantity > 0 || variant.inventoryPolicy === 'continue')
    );
    const added = service.addToCart(emptyCart(), {
      variantId: authoritative.id,
      quantity: 1,
      price: { amountMinor: 1, currency: 'EUR' },
      title: '<script>alert(1)</script>',
      inventory: { kind: 'known', quantity: 999_999 },
    });
    expect(added.success).toBe(true);
    expect(added.cart.lines[0].product.unitPrice).toEqual(authoritative.price);
    expect(added.cart.lines[0].product.title).toBe(authoritativeProduct.title);

    const falsified = structuredClone(added.cart);
    falsified.lines[0].product.unitPrice.amountMinor = 1;
    falsified.lines[0].lineTotal.amountMinor = 1;
    const refreshed = service.updateLineQuantity(falsified, falsified.lines[0].id, 2);
    expect(refreshed.success).toBe(true);
    expect(refreshed.cart.lines[0].product.unitPrice).toEqual(authoritative.price);
    expect(refreshed.cart.subtotal.amountMinor).toBe(authoritative.price.amountMinor * 2);
  });

  test('rechaza identificadores y cantidades manipulados', () => {
    const service = createCartService(demoCartCatalog);
    expect(service.addToCart(emptyCart(), { variantId: 'x'.repeat(257), quantity: 1 }).success)
      .toBe(false);
    expect(service.addToCart(emptyCart(), { variantId: demoProducts[0].variants[0].id, quantity: Number.NaN }).success)
      .toBe(false);
  });

  test('el redirect de checkout solo confía en hosts explícitos del dominio de la tienda', () => {
    const allowedHosts = buildShopifyCheckoutHosts('kingbelt.myshopify.com');
    expect(allowedHosts).toEqual(['kingbelt.myshopify.com', 'checkout.shopify.com']);

    const adversarial = {
      status: 'ready',
      url: 'https://kingbelt.myshopify.com/checkouts/test',
      allowedHosts: ['evil.test'],
      message: 'upstream token=not-a-real-token',
    };
    expect(getSafeCheckoutUrl(adversarial)).toBeNull();
    expect(JSON.stringify(adversarial)).toContain('evil.test');

    const trusted = {
      status: 'ready',
      url: 'https://kingbelt.myshopify.com/checkouts/test',
      allowedHosts,
    };
    expect(getSafeCheckoutUrl(trusted)?.hostname).toBe('kingbelt.myshopify.com');
    expect(JSON.stringify({ ...trusted, message: undefined })).not.toContain('not-a-real');
  });
});

describe('superficie del navegador y cabeceras', () => {
  test('la presentación de comercio no inserta HTML del catálogo', () => {
    const commerceSurfaces = [
      join(root, 'src/components/cart'),
      join(root, 'src/components/collection'),
      join(root, 'src/components/product'),
      join(root, 'src/pages/categorias'),
      join(root, 'src/pages/productos'),
      join(root, 'src/scripts/commerce'),
    ].flatMap(walk);
    const violations = commerceSurfaces
      .filter((path) => /\.(?:astro|m?[jt]s)$/.test(path))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        const guardedSetHtml = source.includes('serializeJsonForHtml') || source.includes('buildProductGalleryRules');
        const unsafeSetHtml = source.includes('set:html') && !guardedSetHtml;
        return unsafeSetHtml || /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(source);
      })
      .map((path) => path.slice(root.length + 1));

    expect(violations).toEqual([]);
  });

  test('el acceso a almacenamiento del navegador queda aislado en el adaptador demo', () => {
    const sourceFiles = walk(join(root, 'src')).filter((path) => /\.(?:astro|m?[jt]s)$/.test(path));
    const accesses = sourceFiles
      .filter((path) => /\bwindow\.(?:localStorage|sessionStorage)\b/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(root.length + 1));
    expect(accesses).toEqual(['src/commerce/infrastructure/demo/demo-cart-adapter.ts']);
  });

  test('el identificador remoto de carrito Shopify no se expone al navegador', () => {
    const clientSurfaces = [
      join(root, 'src/components'),
      join(root, 'src/layouts'),
      join(root, 'src/scripts'),
      join(root, 'src/shared/browser'),
      join(root, 'src/commerce/cart.ts'),
      join(root, 'src/commerce/infrastructure/shopify/shopify-cart-adapter.ts'),
    ].flatMap((path) => (path.endsWith('.ts') ? [path] : walk(path)))
      .filter((path) => /\.(?:astro|m?[jt]s)$/.test(path));
    const pageSurfaces = walk(join(root, 'src/pages'))
      .filter((path) => /\.(?:astro|m?[jt]s)$/.test(path))
      .filter((path) => !path.slice(root.length + 1).split('/').join('/').startsWith('src/pages/api/'));

    const violations = [...clientSurfaces, ...pageSurfaces]
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('shopifyCartId')
          || source.includes('SHOPIFY_CART_SESSION_KEY')
          || /gid:\/\/shopify\/Cart\//.test(source);
      })
      .map((path) => path.slice(root.length + 1));

    expect(violations).toEqual([]);
  });

  test('el formulario limita los campos antes de que exista el endpoint servidor', () => {
    const source = readFileSync(join(root, 'src/components/sections/contact/ContactFormSection.astro'), 'utf8');
    expect(source).toContain('maxlength="100"');
    expect(source).toContain('maxlength="254"');
    expect(source).toContain('maxlength="5000"');
    expect(source).toContain('method="post"');
    expect(source).not.toMatch(/\bname="(?:name|email|subject|message|privacy)"/);
    expect(readFileSync(join(root, 'src/scripts/contact-form.ts'), 'utf8'))
      .toContain('event.preventDefault();');
  });

  test('la configuración de despliegue define CSP y cabeceras defensivas', () => {
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const headers = new Map(config.headers[0].headers.map(({ key, value }) => [key, value]));
    const csp = headers.get('Content-Security-Policy');

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/js\.stripe\.com|paypal\.com|pay\.shopify\.com/);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.has('Strict-Transport-Security')).toBe(true);
    expect(headers.has('Permissions-Policy')).toBe(true);
    expect(JSON.stringify(config)).not.toContain('COMMERCE_SOURCE');
    expect(config.build).toBeUndefined();
    expect(config.env).toBeUndefined();
    const astroConfig = readFileSync(join(root, 'astro.config.mjs'), 'utf8');
    expect(astroConfig).toContain("inlineStylesheets: 'never'");
    expect(astroConfig).toContain('assetsInlineLimit: 0');
  });

  test('el example y vercel.json no contienen secretos ni fuerzan Shopify', () => {
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    const vercelText = readFileSync(join(root, 'vercel.json'), 'utf8');
    const clientSurfaces = [
      join(root, 'src/components'),
      join(root, 'src/layouts'),
      join(root, 'src/scripts'),
      join(root, 'src/shared/browser'),
    ].flatMap(walk).filter((path) => /\.(?:astro|m?[jt]s)$/.test(path));
    const publicFiles = walk(join(root, 'public'));

    expect(example).toContain('COMMERCE_SOURCE=demo');
    expect(example).toMatch(/^SHOPIFY_STORE_DOMAIN=\s*$/m);
    expect(example).toMatch(/^SHOPIFY_STOREFRONT_PRIVATE_TOKEN=\s*$/m);
    expect(example).toMatch(/^SHOPIFY_CUSTOMER_ACCOUNT_URL=\s*$/m);
    expect(example).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(example).not.toContain('SHOPIFY_ADMIN_ACCESS_TOKEN');
    expect(example).not.toMatch(/^SHOPIFY_STORE_DOMAIN=.+\S/m);
    expect(example).not.toMatch(/shpat_|shpca_|shpss_/);
    expect(example).not.toContain('PUBLIC_SHOPIFY');
    expect(example).not.toContain('SHOPIFY_CART_COOKIE_SECRET');
    expect(example).toContain('UPSTASH_REDIS_REST_URL=');
    expect(example).toContain('UPSTASH_REDIS_REST_TOKEN=');
    expect(example).not.toContain('PUBLIC_UPSTASH');
    expect(vercelText).not.toContain('COMMERCE_SOURCE');
    expect(vercelText).not.toMatch(/shpat_|SHOPIFY_STOREFRONT_PRIVATE_TOKEN|VERCEL_DEPLOY_HOOK_URL/);
    expect(vercelText).not.toContain('UPSTASH_REDIS_REST_TOKEN');

    const secretImports = clientSurfaces.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return source.includes('astro:env/server')
        || source.includes('SHOPIFY_STOREFRONT_PRIVATE_TOKEN')
        || source.includes('SHOPIFY_CART_COOKIE_SECRET')
        || source.includes('SHOPIFY_WEBHOOK_SECRET')
        || source.includes('VERCEL_DEPLOY_HOOK_URL')
        || source.includes('UPSTASH_REDIS_REST_URL')
        || source.includes('UPSTASH_REDIS_REST_TOKEN');
    });
    expect(secretImports).toEqual([]);
    expect(publicFiles.some((path) => {
      const source = readFileSync(path, 'utf8');
      return source.includes('UPSTASH_REDIS_REST_URL')
        || source.includes('UPSTASH_REDIS_REST_TOKEN')
        || source.includes('PUBLIC_UPSTASH');
    })).toBe(false);
  });
});
