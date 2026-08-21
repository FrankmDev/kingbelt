import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  ACCOUNT_ACCESS_HREF,
  buildAccountAccessResponse,
  CUSTOMER_ACCOUNT_REDIRECT_STATUS,
  CUSTOMER_ACCOUNT_UNAVAILABLE_MESSAGE,
  CUSTOMER_ACCOUNT_UNAVAILABLE_STATUS,
  parseShopifyHostedUrl,
  resolveCustomerAccountHref,
  ShopifyHostedUrlError,
} from '../src/commerce/application/hosted-url.ts';

const root = resolve(import.meta.dir, '..');
const sourceRoot = join(root, 'src');
const ACCOUNT_URL = 'https://account.example.test';
const CUSTOM_ACCOUNT_URL = 'https://account.kingbelt.es';

const walk = (directory) => readdirSync(directory)
  .flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sourcePath = (path) => relative(root, path).split(sep).join('/');
const read = (path) => readFileSync(join(root, path), 'utf8');
const sourceFiles = walk(sourceRoot).filter((path) =>
  /\.(?:astro|m?[jt]s)$/.test(path) && !path.endsWith('.d.ts')
);

describe('URLs alojadas de Shopify', () => {
  test('acepta HTTPS absoluto con hostname explícito, incluido un dominio de cuentas personalizado', () => {
    expect(parseShopifyHostedUrl(ACCOUNT_URL).href).toBe(`${ACCOUNT_URL}/`);
    expect(parseShopifyHostedUrl(CUSTOM_ACCOUNT_URL).href).toBe(`${CUSTOM_ACCOUNT_URL}/`);
    expect(parseShopifyHostedUrl(`"${ACCOUNT_URL}"`).href).toBe(`${ACCOUNT_URL}/`);
    expect(parseShopifyHostedUrl(`${ACCOUNT_URL}/account`).pathname).toBe('/account');
  });

  test('acepta la URL de Customer Accounts de shopify.com con path de tienda', () => {
    const hosted = parseShopifyHostedUrl('https://shopify.com/106425811284/account');
    expect(hosted.protocol).toBe('https:');
    expect(hosted.hostname).toBe('shopify.com');
    expect(hosted.pathname).toBe('/106425811284/account');
    expect(hosted.search).toBe('');
    expect(hosted.hash).toBe('');
    expect(hosted.href).toBe('https://shopify.com/106425811284/account');
  });

  test('exige HTTPS y rechaza javascript:, data: y URLs no absolutas', () => {
    [
      undefined,
      '',
      '   ',
      'http://account.example.test',
      'javascript:alert(1)',
      'data:text/html,hi',
      '/cuenta/iniciar',
      '//account.example.test',
      'account.example.test',
      'ftp://account.example.test',
    ].forEach((value) => {
      expect(() => parseShopifyHostedUrl(value)).toThrow(ShopifyHostedUrlError);
    });
  });

  test('rechaza credenciales embebidas, fragmentos, query, IPs, whitespace interno y controles', () => {
    [
      'https://user:pass@account.example.test',
      'https://user@account.example.test',
      'https://account.example.test#login',
      'https://account.example.test/?next=/pedidos',
      'https://account.example.test/?return_to=https://evil.example',
      'https://127.0.0.1',
      'https://account.example.test:8443',
      'https://localhost',
      'https://account.example.test/path with space',
      `https://account.example.test/\u0000account`,
    ].forEach((value) => {
      expect(() => parseShopifyHostedUrl(value)).toThrow(ShopifyHostedUrlError);
    });
  });
});

describe('navegación de cuenta', () => {
  test('demo y Shopify válido usan la misma ruta estable de KingBelt', () => {
    const demoHref = resolveCustomerAccountHref({ source: 'demo' });
    const shopifyHref = resolveCustomerAccountHref({
      source: 'shopify',
      customerAccountUrl: ACCOUNT_URL,
    });
    expect(demoHref).toBe(ACCOUNT_ACCESS_HREF);
    expect(shopifyHref).toBe(ACCOUNT_ACCESS_HREF);
    expect(demoHref).toBe(shopifyHref);
    expect(resolveCustomerAccountHref({
      source: 'demo',
      customerAccountUrl: undefined,
    })).toBe('/cuenta/iniciar');
  });

  test('modo Shopify no habilita el CTA si falta o es inválida la URL', () => {
    expect(resolveCustomerAccountHref({
      source: 'shopify',
      customerAccountUrl: undefined,
    })).toBeNull();
    expect(resolveCustomerAccountHref({
      source: 'shopify',
      customerAccountUrl: 'http://account.example.test',
    })).toBeNull();
    expect(() => parseShopifyHostedUrl(undefined))
      .toThrow('Missing required Shopify configuration: SHOPIFY_CUSTOMER_ACCOUNT_URL');
  });

  test('el redirect de cuenta es temporal y no permanente', () => {
    expect(CUSTOMER_ACCOUNT_REDIRECT_STATUS).toBe(307);
    expect(CUSTOMER_ACCOUNT_REDIRECT_STATUS).not.toBe(301);
    expect(parseShopifyHostedUrl(ACCOUNT_URL).href).toBe(`${ACCOUNT_URL}/`);
  });
});

describe('respuesta de /cuenta/iniciar', () => {
  test('demo: getAccountAccessResponse equivalente es null y no redirige', () => {
    expect(buildAccountAccessResponse('demo')).toBeNull();
    expect(buildAccountAccessResponse('demo', ACCOUNT_URL)).toBeNull();
  });

  test('Shopify + URL válida redirige 307 a la URL exacta validada', () => {
    const hosted = parseShopifyHostedUrl(ACCOUNT_URL);
    const response = buildAccountAccessResponse('shopify', ACCOUNT_URL);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(CUSTOMER_ACCOUNT_REDIRECT_STATUS);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(hosted.href);
  });

  test('Shopify + URL de shopify.com/id/account redirige a esa Location exacta', () => {
    const url = 'https://shopify.com/106425811284/account';
    const response = buildAccountAccessResponse('shopify', url);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(url);
  });

  test('URL ausente responde 503 fail-closed sin panel demo', () => {
    const response = buildAccountAccessResponse('shopify', undefined);
    expect(response.status).toBe(CUSTOMER_ACCOUNT_UNAVAILABLE_STATUS);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.status).not.toBe(200);
  });

  test('URL inválida, HTTP y credenciales responden 503', async () => {
    for (const value of [
      'not-a-url',
      'http://account.example.test',
      'https://user:pass@account.example.test',
      'https://account.example.test/?next=/pedidos',
      'https://account.example.test#login',
    ]) {
      const response = buildAccountAccessResponse('shopify', value);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe(CUSTOMER_ACCOUNT_UNAVAILABLE_MESSAGE);
    }
  });
});

describe('superficies alojadas en la interfaz', () => {
  const header = read('src/components/layout/Header.astro');
  const headerCta = read('src/components/account/HeaderAccountCta.astro');
  const mobile = read('src/components/layout/MobileNavigation.astro');
  const iniciar = read('src/pages/cuenta/iniciar.astro');
  const panel = read('src/components/account/AccountAccessPanel.astro');
  const navigation = read('src/config/navigation.ts');
  const composition = read('src/commerce/commerce-navigation.ts');
  const checkoutRedirect = read('src/commerce/application/checkout-redirect.ts');
  const shopifyCart = read('src/commerce/infrastructure/shopify/shopify-cart.ts');
  const cartController = read('src/scripts/commerce/cart-controller.ts');

  const hostedUrl = read('src/commerce/application/hosted-url.ts');
  const accountCopy = read('src/content/account.ts');

  test('header desktop y navegación móvil comparten el mismo destino de cuenta', () => {
    expect(composition).toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(composition).toContain('getCustomerAccountHref');
    expect(composition).toContain('resolveCustomerAccountHref');
    expect(header).toContain('getCustomerAccountHref');
    expect(header).toContain('accountHref={accountHref}');
    expect(header).toContain('<HeaderAccountCta href={accountHref} />');
    expect(mobile).toContain('accountHref: string | null');
    expect(mobile).toContain('href: accountHref');
    expect(headerCta).toContain('href={href}');
    expect(headerCta).not.toContain('target=');
    expect(mobile).not.toContain('target="_blank"');
    expect(navigation).not.toContain("href: '/cuenta/iniciar'");
    expect(headerCta).not.toContain('headerAccountCta.href');
    expect(mobile).not.toContain('headerAccountCta.href');
    expect(header).not.toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(mobile).not.toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(headerCta).not.toContain('SHOPIFY_CUSTOMER_ACCOUNT_URL');
    expect(navigation).toContain("label: 'Mi cuenta'");
    expect(navigation).not.toContain('Crear cuenta');
    expect(navigation).not.toContain('Iniciar sesión o crear cuenta');
    expect(hostedUrl).toContain('ACCOUNT_ACCESS_HREF');
    expect(hostedUrl).toContain("'/cuenta/iniciar'");
  });

  test('/cuenta/iniciar en Shopify redirige server-side sin JavaScript ni panel mock', () => {
    expect(iniciar).toContain('getAccountAccessResponse');
    expect(iniciar).toContain('return shopifyAccountResponse');
    expect(iniciar).not.toContain('window.location');
    expect(iniciar).not.toContain('meta http-equiv');
    expect(iniciar).not.toContain('301');
    expect(composition).toContain('buildAccountAccessResponse');
    expect(composition).not.toContain('status: 301');
    expect(hostedUrl).toContain('Response.redirect');
    expect(hostedUrl).toContain('CUSTOMER_ACCOUNT_REDIRECT_STATUS');
    expect(hostedUrl).toContain('CUSTOMER_ACCOUNT_UNAVAILABLE_STATUS');
    expect(hostedUrl).toContain('Shopify Customer Accounts are not configured.');
    expect(hostedUrl).toContain("'Cache-Control': 'no-store'");
    expect(composition).not.toContain('AccountAccessPanel');
    expect(iniciar.indexOf('getAccountAccessResponse')).toBeLessThan(iniciar.indexOf('AccountAccessPanel />'));
  });

  test('AccountAccessPanel no autentica y no es reachable como 200 en Shopify', () => {
    expect(panel).toContain('data-demo-account-access');
    expect(panel).toContain('preventDefault');
    expect(panel).not.toMatch(/type=["']password["']/);
    expect(panel).not.toContain('Crear cuenta');
    expect(panel).not.toContain('data-account-intent');
    expect(accountCopy).not.toContain('Crear cuenta');
    expect(panel).not.toContain('astro:env');
    expect(panel).not.toContain('process.env');
    expect(panel).not.toContain('SHOPIFY_STOREFRONT');
    expect(panel).not.toContain('Customer Account API');
    expect(panel).not.toContain('storefront');
    expect(panel).not.toContain('/admin/api');
    expect(panel).not.toContain('cartBuyerIdentityUpdate');
    expect(iniciar).not.toContain('data-demo-account-access');
    expect(iniciar).toContain('<AccountAccessPanel />');
    expect(header).not.toContain('AccountAccessPanel');
    expect(mobile).not.toContain('AccountAccessPanel');
    const shopifyResponse = buildAccountAccessResponse('shopify', ACCOUNT_URL);
    expect(shopifyResponse).not.toBeNull();
    expect(shopifyResponse?.status).not.toBe(200);
    expect(shopifyResponse?.status).toBe(307);
    expect(buildAccountAccessResponse('demo')).toBeNull();
  });

  test('no hay auth propia, Customer Account API ni APIs legacy de cliente', () => {
    const forbidden = [
      'customerCreate',
      'customerAccessTokenCreate',
      'customerAccessTokenRenew',
      'customerRecover',
      'customerReset',
      'customerAccessToken',
      'isLoggedIn',
      'code_challenge',
      'refresh_token',
    ];
    const hits = sourceFiles.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return forbidden.some((token) => source.includes(token));
    }).map(sourcePath);
    expect(hits).toEqual([]);
    expect(existsSync(join(sourceRoot, 'pages/cuenta/crear.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/cuenta/perfil.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/cuenta/pedidos.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/registro.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/login.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/cuenta/addresses.astro'))).toBe(false);
  });

  test('checkout sigue usando checkoutUrl y no una URL fija de cuenta o checkout', () => {
    expect(shopifyCart).toContain('checkoutUrl');
    expect(shopifyCart).toContain('getSafeCheckoutUrl');
    expect(cartController).toContain('getSafeCheckoutUrl');
    expect(cartController).toContain('window.location.assign');
    expect(cartController).not.toMatch(/iframe|window\.open/);
    expect(checkoutRedirect).toContain('result.url');
    expect(read('astro.config.mjs')).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(read('.env.example')).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(composition).not.toContain('checkoutUrl');
    expect(composition).not.toContain('SHOPIFY_CHECKOUT_URL');
    expect(header).not.toContain('checkoutUrl');
  });

  test('no existen páginas Astro de thank-you, review ni order-status', () => {
    const pagePaths = walk(join(sourceRoot, 'pages')).map(sourcePath);
    const forbidden = pagePaths.filter((path) =>
      /gracias|thank-you|thankyou|order-status|estado-pedido|revisar-pedido|\/revision|checkout\/review|checkout\/success/i
        .test(path)
    );
    expect(forbidden).toEqual([]);
    expect(existsSync(join(sourceRoot, 'pages/gracias.astro'))).toBe(false);
    expect(existsSync(join(sourceRoot, 'pages/cuenta/pedidos.astro'))).toBe(false);
  });

  test('no se construyen URLs de pedido ni se envían secretos Shopify al navegador', () => {
    const browserSurfaces = sourceFiles.filter((path) => {
      const normalized = sourcePath(path);
      return normalized.startsWith('src/scripts/')
        || normalized.startsWith('src/shared/browser/')
        || (normalized.startsWith('src/components/') && normalized.endsWith('.ts'));
    });

    const orderUrlBuilders = sourceFiles.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /checkoutId|orderNumber|orderId/.test(source)
        && /https?:\/\/|new URL\(|`\$\{/.test(source);
    }).map(sourcePath);
    expect(orderUrlBuilders).toEqual([]);

    const leakedSecrets = browserSurfaces.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return source.includes('SHOPIFY_STOREFRONT_PRIVATE_TOKEN')
        || source.includes('SHOPIFY_WEBHOOK_SECRET')
        || source.includes('PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_URL')
        || source.includes('process.env')
        || source.includes('astro:env/server');
    }).map(sourcePath);
    expect(leakedSecrets).toEqual([]);

    expect(headerCta).not.toContain('window.location');
    expect(mobile).not.toContain('window.location');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toMatch(/\btoken\b/i);
  });
});

describe('navegación de tarjetas de producto', () => {
  const card = read('src/components/collection/ProductCard.astro');
  const catalog = read('src/components/collection/CollectionCatalog.astro');
  const pdp = read('src/pages/productos/[slug].astro');

  test('la tarjeta enlaza a la PDP y el enlace de categoría no envuelve el grid', () => {
    expect(card).toContain('href={`/productos/${product.handle}`}');
    expect(card).not.toContain('primaryCollection.handle');
    expect(card).not.toContain('/categorias/');
    expect(catalog).toContain('href={`/categorias/${group.collection.handle}`}');
    expect(catalog.indexOf('collection-catalog__group-link'))
      .toBeLessThan(catalog.indexOf('<ul class="collection-catalog__grid">'));
    expect(catalog).toMatch(/collection-catalog__group-link::after[\s\S]*pointer-events:\s*none/);
    expect(catalog).not.toMatch(/content-visibility:\s*auto/);
  });

  test('la ficha no tapa la compra con el bloque de categoría relacionada', () => {
    expect(pdp).toContain('data-product-page');
    expect(pdp).not.toMatch(/\.pdp__buy\s*\{[^}]*height:\s*0/);
    expect(pdp).not.toMatch(/\.pdp__related\s*\{[^}]*z-index:\s*[1-9]/);
  });

  test('la galería de escritorio es miniatura a la izquierda y foto principal al lado', () => {
    const gallery = read('src/components/product/ProductGallery.astro');
    const desktop = gallery.split('@media (min-width: 48rem)')[1] ?? '';
    expect(gallery).toContain('grid-template-columns: var(--gallery-thumb-width) auto');
    expect(gallery).toContain('grid-row: 1 / -1');
    expect(gallery).toContain('height: 100%');
    expect(desktop).toContain('width: fit-content');
    expect(desktop).toContain('grid-template-columns: var(--gallery-thumb-width) auto');
    expect(desktop).not.toContain('minmax(0, 1fr)');
    expect(gallery).not.toContain('padding-bottom: 125%');
  });
});
