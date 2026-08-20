import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { emptyCart } from '../../src/commerce/application/cart-service.ts';

mock.module('astro:env/client', () => ({ COMMERCE_SOURCE: 'shopify' }));
mock.module('astro:env/server', () => ({
  SHOPIFY_API_VERSION: '2026-07',
  SHOPIFY_STORE_DOMAIN: 'kingbelt.myshopify.com',
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-private-storefront-token',
}));

const CART_ID = 'gid://shopify/Cart/z2NwLXVzLWVhc3QxOjAxSk1YV0hKRlA?key=super-secret-cart-key-never-leak';
const FOREIGN_CART_ID = 'gid://shopify/Cart/foreign?key=other-session-secret';
const VARIANT_A = 'gid://shopify/ProductVariant/111';
const LINE_A = 'gid://shopify/CartLine/line-a';
const CHECKOUT_URL = 'https://kingbelt.myshopify.com/checkouts/cn/test';

const money = (amount = '89.00') => ({ amount, currencyCode: 'EUR' });
const merchandise = (id) => ({
  id,
  title: 'Negro / 90',
  availableForSale: true,
  currentlyNotInStock: false,
  quantityRule: { minimum: 1, increment: 1, maximum: null },
  selectedOptions: [{ name: 'Color', value: 'Negro' }, { name: 'Talla', value: '90' }],
  image: {
    id: `gid://shopify/MediaImage/${id}`,
    url: 'https://cdn.shopify.com/s/files/1/test.jpg',
    width: 800,
    height: 1000,
    altText: 'Cinturón de prueba',
  },
  product: {
    id: 'gid://shopify/Product/1',
    handle: 'cinturon-test',
    title: 'Cinturón de prueba',
    modelReference: null,
    primaryCollection: {
      type: 'collection_reference',
      reference: {
        __typename: 'Collection',
        id: 'gid://shopify/Collection/1',
        handle: 'sport',
        title: 'Sport',
      },
    },
    featuredImage: null,
  },
});

const remoteLine = (id, variantId, quantity) => ({
  id,
  quantity,
  cost: { amountPerQuantity: money(), totalAmount: money((89 * quantity).toFixed(2)) },
  merchandise: merchandise(variantId),
});

const remoteCart = ({
  id = CART_ID,
  lines = [remoteLine(LINE_A, VARIANT_A, 1)],
  checkoutUrl = CHECKOUT_URL,
} = {}) => ({
  id,
  checkoutUrl,
  buyerIdentity: { countryCode: 'ES' },
  totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
  cost: { subtotalAmount: money(lines.reduce((sum, line) => sum + (89 * line.quantity), 0).toFixed(2)) },
  lines: { nodes: lines, pageInfo: { hasNextPage: false } },
});

const payload = (cart) => ({ cart, userErrors: [], warnings: [] });

const operationName = (query) => {
  if (query.includes('mutation CartCreate')) return 'create';
  if (query.includes('mutation CartLinesAdd')) return 'add';
  if (query.includes('mutation CartLinesUpdate')) return 'update';
  if (query.includes('mutation CartLinesRemove')) return 'remove';
  if (query.includes('mutation CartBuyerIdentityUpdate')) return 'identity';
  if (query.includes('query CartLineQuantities')) return 'quantities';
  if (query.includes('query Cart(')) return 'get';
  return 'unknown';
};

const createMemorySession = (initial = {}) => {
  const store = { ...initial };
  return {
    store,
    async get(key) { return store[key]; },
    set(key, value) { store[key] = value; },
    delete(key) { delete store[key]; },
  };
};

const graphqlCalls = [];
const carts = new Map();
let failNext = false;

const installStorefront = () => {
  graphqlCalls.length = 0;
  carts.clear();
  failNext = false;
  globalThis.fetch = async (_input, init) => {
    if (failNext) {
      failNext = false;
      throw new TypeError('fetch failed');
    }
    const { query, variables } = JSON.parse(init.body);
    const name = operationName(query);
    graphqlCalls.push({
      name,
      variables,
      buyerIp: init?.headers?.['Shopify-Storefront-Buyer-IP'],
    });
    if (name === 'create') {
      const cart = remoteCart();
      carts.set(cart.id, cart);
      return Response.json({ data: { cartCreate: payload(cart) } });
    }
    if (name === 'identity') {
      const current = carts.get(variables.cartId) ?? remoteCart({ id: variables.cartId, lines: [] });
      const next = { ...current, buyerIdentity: variables.buyerIdentity };
      carts.set(next.id, next);
      return Response.json({ data: { cartBuyerIdentityUpdate: payload(next) } });
    }
    const cartId = variables.id ?? variables.cartId;
    if (name === 'get') {
      return Response.json({ data: { cart: carts.get(cartId) ?? null } });
    }
    if (name === 'quantities') {
      const cart = carts.get(cartId);
      return Response.json({
        data: {
          cart: cart
            ? {
                lines: {
                  nodes: cart.lines.nodes.map((line) => ({
                    id: line.id,
                    quantity: line.quantity,
                    merchandise: { id: line.merchandise.id },
                  })),
                  pageInfo: { hasNextPage: false },
                },
              }
            : null,
        },
      });
    }
    if (name === 'add') {
      const current = carts.get(cartId) ?? remoteCart({ id: cartId, lines: [] });
      const next = remoteCart({
        id: cartId,
        lines: [...current.lines.nodes, remoteLine(LINE_A, VARIANT_A, 1)],
      });
      carts.set(cartId, next);
      return Response.json({ data: { cartLinesAdd: payload(next) } });
    }
    if (name === 'update') {
      const current = carts.get(cartId);
      const quantity = variables.lines[0].quantity;
      const next = remoteCart({
        id: cartId,
        lines: current.lines.nodes.map((line) => remoteLine(line.id, line.merchandise.id, quantity)),
      });
      carts.set(cartId, next);
      return Response.json({ data: { cartLinesUpdate: payload(next) } });
    }
    if (name === 'remove') {
      const next = remoteCart({ id: cartId, lines: [] });
      carts.set(cartId, next);
      return Response.json({ data: { cartLinesRemove: payload(next) } });
    }
    throw new Error(`Unexpected Storefront operation ${name}`);
  };
};

const { POST } = await import('../../src/pages/api/cart.ts');

const postCart = async (session, command, origin = 'https://kingbelt.test') => {
  const response = await POST({
    request: new Request('https://kingbelt.test/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(command),
    }),
    session,
    clientAddress: '203.0.113.10',
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const assertNoCartIdLeak = (text, body) => {
  assert.equal(text.includes(CART_ID), false);
  assert.equal(text.includes('super-secret-cart-key-never-leak'), false);
  assert.equal(text.includes('gid://shopify/Cart/'), false);
  assert.equal(text.includes('?key='), false);
  assert.equal(Object.hasOwn(body, 'cartId'), false);
};

installStorefront();
{
  const session = createMemorySession();
  const { response, text, body } = await postCart(session, { command: 'refresh' });
  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, cart: emptyCart() });
  assert.deepEqual(graphqlCalls, []);
  assert.equal(session.store.shopifyCartId, undefined);
  assertNoCartIdLeak(text, body);
}

installStorefront();
{
  const session = createMemorySession();
  const { response, text, body } = await postCart(session, {
    command: 'add',
    variantId: VARIANT_A,
    quantity: 1,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.success, true);
  assert.equal(body.cart.lines.length, 1);
  assert.equal(session.store.shopifyCartId, CART_ID);
  assert.equal(graphqlCalls[0].name, 'create');
  assert.equal(graphqlCalls[0].buyerIp, '203.0.113.10');
  assert.equal(graphqlCalls[0].variables.input.buyerIdentity.countryCode, 'ES');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assertNoCartIdLeak(text, body);

  graphqlCalls.length = 0;
  const refreshed = await postCart(session, { command: 'refresh' });
  assert.equal(refreshed.body.success, true);
  assert.equal(refreshed.body.cart.lines.length, 1);
  assert.deepEqual(graphqlCalls.map((item) => item.name), ['get']);
  assert.equal(graphqlCalls[0].variables.id, CART_ID);
  assertNoCartIdLeak(refreshed.text, refreshed.body);

  const updated = await postCart(session, { command: 'update', lineId: LINE_A, quantity: 2 });
  assert.equal(updated.body.success, true);
  assert.equal(updated.body.cart.lines[0].quantity, 2);
  assert.equal(graphqlCalls.at(-1).variables.cartId, CART_ID);
  assertNoCartIdLeak(updated.text, updated.body);

  const removed = await postCart(session, { command: 'remove', lineId: LINE_A });
  assert.equal(removed.body.success, true);
  assert.equal(removed.body.cart.lines.length, 0);
  assert.equal(graphqlCalls.at(-1).variables.cartId, CART_ID);
  assertNoCartIdLeak(removed.text, removed.body);
}

installStorefront();
{
  const session = createMemorySession();
  const { response, body } = await postCart(session, {
    command: 'add',
    variantId: VARIANT_A,
    quantity: 1,
    countryCode: 'US',
    country: 'FR',
    language: 'EN',
    currency: 'USD',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: 'invalid_command' });
  assert.deepEqual(graphqlCalls, []);
  assert.equal(session.store.shopifyCartId, undefined);
}

installStorefront();
{
  const session = createMemorySession();
  await postCart(session, { command: 'add', variantId: VARIANT_A, quantity: 1 });
  const { body, text, response } = await postCart(session, { command: 'checkout' });
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.status, 'ready');
  assert.equal(body.url, CHECKOUT_URL);
  assert.equal(new URL(body.url).searchParams.has('country'), false);
  assert.equal(new URL(body.url).searchParams.has('currency'), false);
  assert.equal(new URL(body.url).searchParams.has('language'), false);
  assert.equal(graphqlCalls.at(-1).variables.id, CART_ID);
  assert.equal(session.store.shopifyCartId, CART_ID);
  assertNoCartIdLeak(text, body);
}

installStorefront();
{
  const session = createMemorySession({ shopifyCartId: CART_ID });
  const { body } = await postCart(session, { command: 'refresh' });
  assert.equal(body.success, true);
  assert.equal(body.cart.lines.length, 0);
  assert.equal(session.store.shopifyCartId, undefined);

  session.store.shopifyCartId = CART_ID;
  const checkout = await postCart(session, { command: 'checkout' });
  assert.equal(checkout.body.status, 'expired');
  assert.equal(session.store.shopifyCartId, undefined);
}

installStorefront();
{
  const session = createMemorySession({ shopifyCartId: CART_ID });
  carts.set(CART_ID, remoteCart());
  const { response, body, text } = await postCart(session, {
    command: 'update',
    lineId: LINE_A,
    quantity: 3,
    cartId: FOREIGN_CART_ID,
  });
  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: 'invalid_command' });
  assert.deepEqual(graphqlCalls, []);
  assert.equal(session.store.shopifyCartId, CART_ID);
  assert.equal(text.includes(FOREIGN_CART_ID), false);
}

installStorefront();
{
  const session = createMemorySession();
  for (const command of [
    { command: 'update', lineId: LINE_A, quantity: 2 },
    { command: 'remove', lineId: LINE_A },
  ]) {
    const { response, body } = await postCart(session, command);
    assert.equal(response.status, 410);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'not_found');
  }
  const checkout = await postCart(session, { command: 'checkout' });
  assert.equal(checkout.response.status, 410);
  assert.equal(checkout.body.success, false);
  assert.equal(checkout.body.status, 'expired');
  assert.deepEqual(graphqlCalls, []);
}

installStorefront();
{
  const shared = createMemorySession();
  await postCart(shared, { command: 'add', variantId: VARIANT_A, quantity: 1 });
  const first = await postCart(shared, { command: 'refresh' });
  const second = await postCart(shared, { command: 'refresh' });
  assert.equal(first.body.cart.lines.length, 1);
  assert.equal(second.body.cart.lines.length, 1);
  assert.equal(shared.store.shopifyCartId, CART_ID);

  const stranger = createMemorySession();
  const foreign = await postCart(stranger, { command: 'refresh' });
  assert.equal(foreign.body.cart.lines.length, 0);
  assert.equal(stranger.store.shopifyCartId, undefined);
}

installStorefront();
{
  const session = createMemorySession({ shopifyCartId: CART_ID });
  carts.set(CART_ID, remoteCart());
  failNext = true;
  const { response, body } = await postCart(session, { command: 'refresh' });
  assert.equal(response.status, 502);
  assert.deepEqual(body, { error: 'provider_error' });
  assert.equal(session.store.shopifyCartId, CART_ID);
}

installStorefront();
{
  const session = createMemorySession();
  const { response, body } = await postCart(session, { command: 'refresh' }, 'https://evil.test');
  assert.equal(response.status, 403);
  assert.deepEqual(body, { error: 'origin_not_allowed' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(graphqlCalls, []);
}

installStorefront();
{
  const session = createMemorySession();
  const missingOrigin = await postCart(session, { command: 'refresh' }, '');
  assert.equal(missingOrigin.response.status, 403);
  assert.deepEqual(missingOrigin.body, { error: 'origin_not_allowed' });
  assert.deepEqual(graphqlCalls, []);
}
