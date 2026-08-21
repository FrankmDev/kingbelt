import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { emptyCart } from '../src/commerce/application/cart-service.ts';

const VARIANT_ID = 'gid://shopify/ProductVariant/111';
const LINE_ID = 'gid://shopify/CartLine/line-a';
const CONTEXTUAL_LINE_ID = `${LINE_ID}?cart=${'a'.repeat(32)}`;
const API_URL = 'https://kingbelt.test/api/cart';
const EXPECTED_ORIGIN = 'https://kingbelt.test';
const CLIENT_ADDRESS = '203.0.113.10';
const REMOTE_CART_ID = 'gid://shopify/Cart/secret?key=never-leak';

let serviceCreated = 0;
let serviceCalls = [];
let lastBuyerIp;
let serviceShouldThrow = false;
let serviceHandlers = {};

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'shopify' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: 'kingbelt.myshopify.com',
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-storefront-token',
}));
mock.module('@commerce/cart-server', () => ({
  createConfiguredShopifyCartService(buyerIp) {
    serviceCreated += 1;
    lastBuyerIp = buyerIp;
    return {
      async get(cartId) {
        if (serviceShouldThrow) {
          throw new Error('Shopify cart currency does not match EUR at cost.subtotalAmount.');
        }
        serviceCalls.push({ method: 'get', cartId });
        if (serviceHandlers.get) return serviceHandlers.get(cartId);
        return { cart: emptyCart(), cartId };
      },
      async add(cartId, variantId, quantity) {
        if (serviceShouldThrow) {
          throw new Error('Shopify Storefront request failed with HTTP 500.');
        }
        serviceCalls.push({ method: 'add', cartId, variantId, quantity });
        if (serviceHandlers.add) return serviceHandlers.add(cartId, variantId, quantity);
        return { success: true, cart: emptyCart(), cartId: REMOTE_CART_ID };
      },
      async update(cartId, lineId, quantity) {
        if (serviceShouldThrow) {
          throw new Error('Shopify Storefront request failed with HTTP 500.');
        }
        serviceCalls.push({ method: 'update', cartId, lineId, quantity });
        if (serviceHandlers.update) return serviceHandlers.update(cartId, lineId, quantity);
        return { success: true, cart: emptyCart(), cartId };
      },
      async remove(cartId, lineId) {
        if (serviceShouldThrow) {
          throw new Error('Shopify Storefront request failed with HTTP 500.');
        }
        serviceCalls.push({ method: 'remove', cartId, lineId });
        if (serviceHandlers.remove) return serviceHandlers.remove(cartId, lineId);
        return { success: true, cart: emptyCart(), cartId };
      },
      async checkout(cartId) {
        if (serviceShouldThrow) {
          throw new Error('Shopify Storefront request failed with HTTP 500.');
        }
        serviceCalls.push({ method: 'checkout', cartId });
        if (serviceHandlers.checkout) return serviceHandlers.checkout(cartId);
        return {
          status: 'ready',
          url: 'https://kingbelt.myshopify.com/checkouts/cn/test',
          cart: emptyCart(),
          cartId,
        };
      },
    };
  },
}));

const { POST } = await import('../src/pages/api/cart.ts');

const createSession = (initial = {}) => {
  const store = { ...initial };
  return {
    store,
    async get(key) { return store[key]; },
    set(key, value) { store[key] = value; },
    delete(key) { delete store[key]; },
  };
};

const postCart = async ({
  session = createSession(),
  json,
  body,
  origin = EXPECTED_ORIGIN,
  contentType = 'application/json',
  fetchSite,
  contentLength,
  clientAddress = CLIENT_ADDRESS,
} = {}) => {
  const headers = new Headers();
  if (contentType != null) headers.set('Content-Type', contentType);
  if (origin != null) headers.set('Origin', origin);
  if (fetchSite !== undefined) headers.set('Sec-Fetch-Site', fetchSite);
  if (contentLength !== undefined) headers.set('Content-Length', contentLength);
  const response = await POST({
    request: new Request(API_URL, {
      method: 'POST',
      headers,
      body: body !== undefined ? body : JSON.stringify(json),
    }),
    session,
    clientAddress,
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text), session };
};

const assertRejectedBeforeShopify = (result, status, error) => {
  expect(result.response.status).toBe(status);
  expect(result.body).toEqual({ error });
  expect(result.response.headers.get('Cache-Control')).toBe('no-store');
  expect(result.response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  expect(result.response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  expect(serviceCreated).toBe(0);
  expect(serviceCalls).toEqual([]);
};

beforeEach(() => {
  serviceCreated = 0;
  serviceCalls = [];
  lastBuyerIp = undefined;
  serviceShouldThrow = false;
  serviceHandlers = {};
});

describe('frontera HTTP de /api/cart', () => {
  test('acepta application/json', async () => {
    const result = await postCart({ json: { command: 'refresh' } });
    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({ success: true, cart: emptyCart() });
    expect(serviceCalls).toEqual([]);
  });

  test('acepta JSON con charset', async () => {
    const result = await postCart({
      json: { command: 'refresh' },
      contentType: 'application/json; charset=utf-8',
    });
    expect(result.response.status).toBe(200);
  });

  test('acepta JSON con charset en mayúsculas', async () => {
    const result = await postCart({
      json: { command: 'refresh' },
      contentType: 'Application/JSON; Charset=UTF-8',
    });
    expect(result.response.status).toBe(200);
  });

  test('rechaza parámetros distintos de charset UTF-8', async () => {
    for (const contentType of [
      'application/json; charset=iso-8859-1',
      'application/json; boundary=x',
      'application/json; charset=utf-8; profile=x',
    ]) {
      assertRejectedBeforeShopify(
        await postCart({ json: { command: 'refresh' }, contentType }),
        415,
        'unsupported_media_type'
      );
    }
  });

  test('rechaza Content-Type ausente', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, contentType: null }),
      415,
      'unsupported_media_type'
    );
  });

  test('rechaza text/plain', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, contentType: 'text/plain' }),
      415,
      'unsupported_media_type'
    );
  });

  test('rechaza application/jsonp', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, contentType: 'application/jsonp' }),
      415,
      'unsupported_media_type'
    );
  });

  test('rechaza application/xml', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, contentType: 'application/xml' }),
      415,
      'unsupported_media_type'
    );
  });

  test('acepta Origin exacto', async () => {
    const result = await postCart({ json: { command: 'refresh' }, origin: EXPECTED_ORIGIN });
    expect(result.response.status).toBe(200);
  });

  test('rechaza Origin ausente', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, origin: null }),
      403,
      'origin_not_allowed'
    );
  });

  test('rechaza Origin distinto', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, origin: 'https://evil.test' }),
      403,
      'origin_not_allowed'
    );
  });

  test('rechaza Origin null', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, origin: 'null' }),
      403,
      'origin_not_allowed'
    );
  });

  test('rechaza Origin por sufijo engañoso', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, origin: 'https://kingbelt.es.evil.example' }),
      403,
      'origin_not_allowed'
    );
  });

  test('acepta Sec-Fetch-Site same-origin', async () => {
    const result = await postCart({ json: { command: 'refresh' }, fetchSite: 'same-origin' });
    expect(result.response.status).toBe(200);
  });

  test('rechaza Sec-Fetch-Site cross-site', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, fetchSite: 'cross-site' }),
      403,
      'request_not_allowed'
    );
  });

  test('rechaza Sec-Fetch-Site same-site', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, fetchSite: 'same-site' }),
      403,
      'request_not_allowed'
    );
  });

  test('rechaza Sec-Fetch-Site none', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'refresh' }, fetchSite: 'none' }),
      403,
      'request_not_allowed'
    );
  });

  test('permite Sec-Fetch-Site ausente con Origin exacto', async () => {
    const result = await postCart({ json: { command: 'refresh' } });
    expect(result.response.status).toBe(200);
  });

  test('rechaza Content-Length por encima del límite sin parsear el body', async () => {
    const result = await postCart({
      body: '{"command":"refresh"}',
      contentLength: '5000',
    });
    assertRejectedBeforeShopify(result, 413, 'payload_too_large');
  });

  test('rechaza Content-Length malformado antes de leer el body', async () => {
    assertRejectedBeforeShopify(
      await postCart({ body: '{"command":"refresh"}', contentLength: '12x' }),
      400,
      'invalid_content_length'
    );
  });

  test('rechaza un stream mayor de 2048 bytes sin Content-Length', async () => {
    const result = await postCart({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(2_049).fill(97));
          controller.close();
        },
      }),
    });
    assertRejectedBeforeShopify(result, 413, 'payload_too_large');
  });

  test('mide el límite en bytes UTF-8, no en caracteres', async () => {
    const body = `{"command":"refresh","x":"${'é'.repeat(1_100)}"}`;
    expect(body.length).toBeLessThan(2_048);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(2_048);
    assertRejectedBeforeShopify(await postCart({ body }), 413, 'payload_too_large');
  });

  test('rechaza JSON inválido', async () => {
    assertRejectedBeforeShopify(await postCart({ body: '{not json' }), 400, 'invalid_json');
  });

  test('rechaza bytes que no son UTF-8 válido', async () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
    assertRejectedBeforeShopify(await postCart({ body: bytes }), 400, 'invalid_json');
  });

  test('rechaza body vacío', async () => {
    assertRejectedBeforeShopify(await postCart({ body: '' }), 400, 'invalid_json');
  });
});

describe('schema exacto de comandos /api/cart', () => {
  test('refresh exacto es válido', async () => {
    const result = await postCart({ json: { command: 'refresh' } });
    expect(result.response.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(serviceCalls).toEqual([]);
  });

  test('checkout exacto es válido', async () => {
    const session = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const result = await postCart({ session, json: { command: 'checkout' } });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([{ method: 'checkout', cartId: 'gid://shopify/Cart/existing' }]);
  });

  test('add exacto es válido', async () => {
    const result = await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 1 } });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([{ method: 'add', cartId: undefined, variantId: VARIANT_ID, quantity: 1 }]);
    expect(lastBuyerIp).toBe(CLIENT_ADDRESS);
  });

  test('update exacto es válido', async () => {
    const session = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const result = await postCart({ session, json: { command: 'update', lineId: LINE_ID, quantity: 2 } });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([
      { method: 'update', cartId: 'gid://shopify/Cart/existing', lineId: LINE_ID, quantity: 2 },
    ]);
  });

  test('remove exacto es válido', async () => {
    const session = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const result = await postCart({ session, json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([{ method: 'remove', cartId: 'gid://shopify/Cart/existing', lineId: LINE_ID }]);
  });

  test('update y remove aceptan el CartLine ID contextual que devuelve Shopify', async () => {
    const updateSession = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const updated = await postCart({
      session: updateSession,
      json: { command: 'update', lineId: CONTEXTUAL_LINE_ID, quantity: 2 },
    });
    expect(updated.response.status).toBe(200);
    expect(serviceCalls).toEqual([
      {
        method: 'update',
        cartId: 'gid://shopify/Cart/existing',
        lineId: CONTEXTUAL_LINE_ID,
        quantity: 2,
      },
    ]);

    serviceCalls = [];
    const removeSession = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const removed = await postCart({
      session: removeSession,
      json: { command: 'remove', lineId: CONTEXTUAL_LINE_ID },
    });
    expect(removed.response.status).toBe(200);
    expect(serviceCalls).toEqual([
      { method: 'remove', cartId: 'gid://shopify/Cart/existing', lineId: CONTEXTUAL_LINE_ID },
    ]);
  });

  test('command desconocido es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'drop' } }),
      400,
      'invalid_command'
    );
  });

  test('campos faltantes son inválidos', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: VARIANT_ID } }),
      400,
      'invalid_command'
    );
  });

  test('propiedades extra son inválidas', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'checkout', variantId: 'foo', admin: true } }),
      400,
      'invalid_command'
    );
  });

  test('country, currency y language en el body son inválidos', async () => {
    const extras = [
      { country: 'ES' },
      { countryCode: 'ES' },
      { currency: 'EUR' },
      { language: 'ES' },
    ];
    for (const extra of extras) {
      serviceCreated = 0;
      serviceCalls = [];
      assertRejectedBeforeShopify(
        await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 1, ...extra } }),
        400,
        'invalid_command'
      );
    }
  });

  test('cartId público es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({
        json: { command: 'update', lineId: LINE_ID, quantity: 2, cartId: REMOTE_CART_ID },
      }),
      400,
      'invalid_command'
    );
  });

  test('command de tipo incorrecto es inválido', async () => {
    assertRejectedBeforeShopify(await postCart({ json: { command: 1 } }), 400, 'invalid_command');
  });

  test('array y null no son comandos', async () => {
    assertRejectedBeforeShopify(await postCart({ body: 'null' }), 400, 'invalid_command');
    serviceCreated = 0;
    serviceCalls = [];
    assertRejectedBeforeShopify(await postCart({ body: '[]' }), 400, 'invalid_command');
  });

  test('quantity string es inválida', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: '1' } }),
      400,
      'invalid_command'
    );
  });

  test('quantity 0 es inválida', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 0 } }),
      400,
      'invalid_command'
    );
  });

  test('quantity 100 es inválida', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 100 } }),
      400,
      'invalid_command'
    );
  });

  test('Product GID como variantId es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: 'gid://shopify/Product/123', quantity: 1 } }),
      400,
      'invalid_command'
    );
  });

  test('ProductVariant GID como lineId es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'remove', lineId: VARIANT_ID } }),
      400,
      'invalid_command'
    );
  });

  test('ID demasiado largo es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({
        json: { command: 'add', variantId: `gid://shopify/ProductVariant/${'a'.repeat(300)}`, quantity: 1 },
      }),
      400,
      'invalid_command'
    );
  });

  test('caracteres de control en el GID son inválidos', async () => {
    assertRejectedBeforeShopify(
      await postCart({
        json: { command: 'add', variantId: 'gid://shopify/ProductVariant/123\nInjected', quantity: 1 },
      }),
      400,
      'invalid_command'
    );
  });

  test('variantId vacío o sin sufijo es inválido', async () => {
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: '', quantity: 1 } }),
      400,
      'invalid_command'
    );
    serviceCreated = 0;
    serviceCalls = [];
    assertRejectedBeforeShopify(
      await postCart({ json: { command: 'add', variantId: 'gid://shopify/ProductVariant/', quantity: 1 } }),
      400,
      'invalid_command'
    );
  });

  test('los GID públicos no aceptan path, query ni fragment adicionales', async () => {
    for (const variantId of [
      `${VARIANT_ID}/extra`,
      `${VARIANT_ID}?key=secret`,
      `${VARIANT_ID}#fragment`,
    ]) {
      serviceCreated = 0;
      serviceCalls = [];
      assertRejectedBeforeShopify(
        await postCart({ json: { command: 'add', variantId, quantity: 1 } }),
        400,
        'invalid_command'
      );
    }
  });

  test('CartLine solo acepta el parámetro contextual cart de Shopify', async () => {
    for (const lineId of [
      `${LINE_ID}/extra`,
      `${LINE_ID}?key=secret`,
      `${LINE_ID}?cart=`,
      `${LINE_ID}?cart=${'a'.repeat(32)}&extra=1`,
      `${LINE_ID}?cart=%2Fencoded`,
      `${LINE_ID}#fragment`,
    ]) {
      serviceCreated = 0;
      serviceCalls = [];
      assertRejectedBeforeShopify(
        await postCart({ json: { command: 'remove', lineId } }),
        400,
        'invalid_command'
      );
    }
  });
});

describe('flujo BFF de /api/cart', () => {
  test('refresh sin Cart ID no llama Shopify', async () => {
    const result = await postCart({ json: { command: 'refresh' } });
    expect(result.response.status).toBe(200);
    expect(serviceCreated).toBe(1);
    expect(serviceCalls).toEqual([]);
  });

  test('update sin Cart ID responde 410', async () => {
    const result = await postCart({ json: { command: 'update', lineId: LINE_ID, quantity: 2 } });
    expect(result.response.status).toBe(410);
    expect(result.body.success).toBe(false);
    expect(serviceCalls).toEqual([]);
  });

  test('remove sin Cart ID responde 410', async () => {
    const result = await postCart({ json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(410);
    expect(serviceCalls).toEqual([]);
  });

  test('checkout sin Cart ID responde 410', async () => {
    const result = await postCart({ json: { command: 'checkout' } });
    expect(result.response.status).toBe(410);
    expect(result.body.status).toBe('expired');
    expect(result.body.cart).toEqual(emptyCart());
    expect(serviceCalls).toEqual([]);
  });

  test('add válido sin Cart ID llega a cartCreate y no expone el Cart ID', async () => {
    const result = await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 1 } });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([{ method: 'add', cartId: undefined, variantId: VARIANT_ID, quantity: 1 }]);
    expect(result.text.includes(REMOTE_CART_ID)).toBe(false);
    expect(result.text.includes('never-leak')).toBe(false);
    expect(result.text.includes('gid://shopify/Cart/')).toBe(false);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
    expect(result.session.store.shopifyCartId).toBe(REMOTE_CART_ID);
    expect(lastBuyerIp).toBe(CLIENT_ADDRESS);
  });

  test('una respuesta con cartId remoto no lo serializa al JSON público', async () => {
    const result = await postCart({ json: { command: 'add', variantId: VARIANT_ID, quantity: 1 } });
    expect(result.body).toEqual({ success: true, cart: emptyCart() });
    expect(JSON.stringify(result.body)).not.toContain('cartId');
    expect(JSON.stringify(result.body)).not.toContain('gid://shopify/Cart/');
  });

  test('sesiones distintas no comparten Cart ID', async () => {
    const sessionA = createSession({ shopifyCartId: 'gid://shopify/Cart/session-a?key=a' });
    const sessionB = createSession({ shopifyCartId: 'gid://shopify/Cart/session-b?key=b' });
    const resultA = await postCart({ session: sessionA, json: { command: 'refresh' } });
    const resultB = await postCart({ session: sessionB, json: { command: 'refresh' } });
    expect(serviceCalls).toEqual([
      { method: 'get', cartId: 'gid://shopify/Cart/session-a?key=a' },
      { method: 'get', cartId: 'gid://shopify/Cart/session-b?key=b' },
    ]);
    expect(sessionA.store.shopifyCartId).toBe('gid://shopify/Cart/session-a?key=a');
    expect(sessionB.store.shopifyCartId).toBe('gid://shopify/Cart/session-b?key=b');
    expect(resultA.text).not.toContain('session-b');
    expect(resultB.text).not.toContain('session-a');
    expect(resultA.text).not.toContain('gid://shopify/Cart/');
    expect(resultB.text).not.toContain('gid://shopify/Cart/');
  });

  test('si session.get falla responde 503 y no crea otro carrito', async () => {
    const session = {
      async get() { throw new Error('session store unavailable'); },
      set() { throw new Error('must not persist a replacement cart'); },
      delete() { throw new Error('must not forget the existing cart'); },
    };
    const result = await postCart({ session, json: { command: 'refresh' } });
    expect(result.response.status).toBe(503);
    expect(result.body).toEqual({ error: 'commerce_unavailable' });
    expect(serviceCalls).toEqual([]);
  });

  test('sin sesión no crea el servicio Shopify', async () => {
    const response = await POST({
      request: new Request(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: EXPECTED_ORIGIN },
        body: JSON.stringify({ command: 'refresh' }),
      }),
      clientAddress: CLIENT_ADDRESS,
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'commerce_unavailable' });
    expect(serviceCreated).toBe(0);
  });

  test('un error de mercado del servicio no borra la sesión ni expone detalles', async () => {
    serviceShouldThrow = true;
    const session = createSession({ shopifyCartId: 'gid://shopify/Cart/existing' });
    const result = await postCart({ session, json: { command: 'refresh' } });
    expect(result.response.status).toBe(502);
    expect(result.body).toEqual({ error: 'provider_error' });
    expect(result.text).not.toContain('EUR');
    expect(result.text).not.toContain('USD');
    expect(result.text).not.toContain('gid://shopify/Cart/');
    expect(result.session.store.shopifyCartId).toBe('gid://shopify/Cart/existing');
  });
});

describe('recuperación de sesión en /api/cart', () => {
  const existingCartId = 'gid://shopify/Cart/existing';
  const remainingCart = {
    ...emptyCart(),
    lines: [{ id: 'gid://shopify/CartLine/line-b' }],
    globalNotice: 'authoritative-remaining',
  };
  const cartWithRequestedLine = {
    ...remainingCart,
    lines: [{ id: LINE_ID }, ...remainingCart.lines],
    globalNotice: 'authoritative-line-still-present',
  };
  const notFoundResult = {
    success: false,
    cart: emptyCart(),
    error: { code: 'not_found', message: 'La línea o variante ya no está en el carrito.' },
  };

  test('add con Cart nuevo sustituye el Cart ID de sesión y no lo expone', async () => {
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'add', variantId: VARIANT_ID, quantity: 1 },
    });
    expect(result.response.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(session.store.shopifyCartId).toBe(REMOTE_CART_ID);
    expect(result.text.includes(existingCartId)).toBe(false);
    expect(result.text.includes(REMOTE_CART_ID)).toBe(false);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
  });

  test('add unavailable conserva la sesión y responde 422', async () => {
    serviceHandlers.add = () => ({
      ...notFoundResult,
      success: false,
      error: { code: 'unavailable', message: 'Este producto no está disponible.' },
      cartId: existingCartId,
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'add', variantId: VARIANT_ID, quantity: 1 },
    });
    expect(result.response.status).toBe(422);
    expect(result.body.error.code).toBe('unavailable');
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(serviceCalls).toEqual([
      { method: 'add', cartId: existingCartId, variantId: VARIANT_ID, quantity: 1 },
    ]);
  });

  test('refresh de un Cart inexistente borra la sesión y deja el carrito vacío', async () => {
    serviceHandlers.get = () => ({ cart: emptyCart() });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'refresh' } });
    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({ success: true, cart: emptyCart() });
    expect(session.store.shopifyCartId).toBeUndefined();
  });

  test('checkout de un Cart caducado borra la sesión y no persiste el ID', async () => {
    serviceHandlers.checkout = () => ({
      status: 'expired',
      cart: emptyCart(),
      message: 'El carrito ha caducado; vuelve a añadir tus productos.',
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'checkout' } });
    expect(result.response.status).toBe(410);
    expect(result.body.status).toBe('expired');
    expect(result.body.cart).toEqual(emptyCart());
    expect(session.store.shopifyCartId).toBeUndefined();
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
  });

  test('checkout blocked responde 422 y conserva la sesión', async () => {
    serviceHandlers.checkout = () => ({
      status: 'blocked',
      cart: remainingCart,
      message: 'El carrito está vacío.',
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'checkout' } });
    expect(result.response.status).toBe(422);
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe('blocked');
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
  });

  test('checkout unavailable responde 422 y conserva la sesión', async () => {
    serviceHandlers.checkout = () => ({
      status: 'unavailable',
      message: 'El checkout de demostración todavía no está conectado.',
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'checkout' } });
    expect(result.response.status).toBe(422);
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe('unavailable');
    expect(session.store.shopifyCartId).toBe(existingCartId);
  });

  test('checkout error de preparación responde 502 y conserva la sesión', async () => {
    serviceHandlers.checkout = () => ({
      status: 'error',
      cart: remainingCart,
      message: 'No se pudo preparar el checkout. Inténtalo de nuevo.',
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'checkout' } });
    expect(result.response.status).toBe(502);
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe('error');
    expect(result.body.error).toBeUndefined();
    expect(result.body.cart).toEqual(remainingCart);
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
  });

  test('update de un Cart caducado borra la sesión y responde 410', async () => {
    serviceHandlers.update = () => ({ ...notFoundResult, cartId: existingCartId });
    serviceHandlers.get = () => ({ cart: emptyCart() });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'update', lineId: LINE_ID, quantity: 2 },
    });
    expect(result.response.status).toBe(410);
    expect(result.body.success).toBe(false);
    expect(result.body.error.message).toBe('El carrito ha caducado.');
    expect(result.body.cart).toEqual(emptyCart());
    expect(session.store.shopifyCartId).toBeUndefined();
    expect(serviceCalls).toEqual([
      { method: 'update', cartId: existingCartId, lineId: LINE_ID, quantity: 2 },
      { method: 'get', cartId: existingCartId },
    ]);
  });

  test('update de una línea ausente conserva la sesión y el Cart autoritativo', async () => {
    serviceHandlers.update = () => ({ ...notFoundResult, cartId: existingCartId });
    serviceHandlers.get = () => ({ cart: remainingCart, cartId: existingCartId });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'update', lineId: LINE_ID, quantity: 2 },
    });
    expect(result.response.status).toBe(422);
    expect(result.body.success).toBe(false);
    expect(result.body.error.code).toBe('not_found');
    expect(result.body.cart).toEqual(remainingCart);
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
    expect(serviceCalls.filter((item) => item.method === 'get')).toHaveLength(1);
  });

  test('remove de un Cart caducado borra la sesión y responde 410', async () => {
    serviceHandlers.remove = () => ({ ...notFoundResult, cartId: existingCartId });
    serviceHandlers.get = () => ({ cart: emptyCart() });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(410);
    expect(result.body.error.message).toBe('El carrito ha caducado.');
    expect(session.store.shopifyCartId).toBeUndefined();
    expect(serviceCalls).toEqual([
      { method: 'remove', cartId: existingCartId, lineId: LINE_ID },
      { method: 'get', cartId: existingCartId },
    ]);
  });

  test('remove de una línea ya eliminada es success y conserva la sesión', async () => {
    serviceHandlers.remove = () => ({ ...notFoundResult, cartId: existingCartId });
    serviceHandlers.get = () => ({ cart: remainingCart, cartId: existingCartId });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.cart).toEqual(remainingCart);
    expect(result.body.notice).toEqual({
      code: 'product_removed',
      message: 'Producto eliminado del carrito.',
    });
    expect(result.body.error).toBeUndefined();
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
    expect(serviceCalls).toEqual([
      { method: 'remove', cartId: existingCartId, lineId: LINE_ID },
      { method: 'get', cartId: existingCartId },
    ]);
  });

  test('remove not_found no afirma product_removed si la línea sigue en el Cart', async () => {
    serviceHandlers.remove = () => ({ ...notFoundResult, cartId: existingCartId });
    serviceHandlers.get = () => ({ cart: cartWithRequestedLine, cartId: existingCartId });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(422);
    expect(result.body.success).toBe(false);
    expect(result.body.error.code).toBe('not_found');
    expect(result.body.notice).toBeUndefined();
    expect(result.body.cart).toEqual(cartWithRequestedLine);
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(Object.hasOwn(result.body, 'cartId')).toBe(false);
    expect(serviceCalls).toEqual([
      { method: 'remove', cartId: existingCartId, lineId: LINE_ID },
      { method: 'get', cartId: existingCartId },
    ]);
  });

  test('remove con validation no reconcilia not_found', async () => {
    serviceHandlers.remove = () => ({
      success: false,
      cart: remainingCart,
      error: { code: 'validation', message: 'Los datos enviados no son válidos.' },
      cartId: existingCartId,
    });
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({ session, json: { command: 'remove', lineId: LINE_ID } });
    expect(result.response.status).toBe(422);
    expect(result.body.error.code).toBe('validation');
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(serviceCalls).toEqual([{ method: 'remove', cartId: existingCartId, lineId: LINE_ID }]);
  });

  test('update happy path no hace una lectura extra', async () => {
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'update', lineId: LINE_ID, quantity: 2 },
    });
    expect(result.response.status).toBe(200);
    expect(serviceCalls).toEqual([
      { method: 'update', cartId: existingCartId, lineId: LINE_ID, quantity: 2 },
    ]);
    expect(session.store.shopifyCartId).toBe(existingCartId);
  });

  test('un HTTP 500 en update responde 502 y conserva la sesión', async () => {
    serviceShouldThrow = true;
    const session = createSession({ shopifyCartId: existingCartId });
    const result = await postCart({
      session,
      json: { command: 'update', lineId: LINE_ID, quantity: 2 },
    });
    expect(result.response.status).toBe(502);
    expect(result.body).toEqual({ error: 'provider_error' });
    expect(session.store.shopifyCartId).toBe(existingCartId);
    expect(result.text).not.toContain('gid://shopify/Cart/');
  });
});
