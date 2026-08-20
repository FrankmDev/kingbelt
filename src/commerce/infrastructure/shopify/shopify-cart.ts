import { buildCheckoutBlockedMessage, CHECKOUT_EXPIRED_MESSAGE } from '../../application/checkout';
import { getSafeCheckoutUrl } from '../../application/checkout-redirect';
import type { CheckoutResult } from '../../application/checkout';
import { emptyCart } from '../../application/cart-service';
import type { Cart, CartOperationResult } from '../../domain/cart';
import { MAX_CART_LINES_MESSAGE } from '../../domain/cart';
import { isTechnicalLineQuantity } from '../../domain/inventory';
import {
  SHOPIFY_CART_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS,
  SHOPIFY_MARKET_CONTEXT,
  SHOPIFY_PRIMARY_COLLECTION_METAFIELD,
  shopifyCartBuyerIdentity,
  withShopifyCartInContextVariables,
} from './config';
import type { ShopifyStorefrontGateway } from './storefront-gateway';
import {
  interpretShopifyCartMutation,
  mapShopifyCart,
  previousLinesFromQuantitySnapshot,
  publicCartOperationError,
  wouldExceedShopifyCartLineLimit,
  type ShopifyCart,
  type ShopifyCartPayload,
  type ShopifyCartQuantitySnapshot,
} from './shopify-cart-mappers';

/** Página de líneas: por encima del máximo comercial KingBelt y dentro del límite de Cart API. */
const CART_LINE_PAGE_SIZE = 100;

const IMAGE_FIELDS = 'id url width height altText';

const CART_FIELDS = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    buyerIdentity { countryCode }
    cost { subtotalAmount { amount currencyCode } }
    lines(first: ${CART_LINE_PAGE_SIZE}) {
      nodes {
        id
        quantity
        cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            availableForSale
            currentlyNotInStock
            quantityRule { minimum increment maximum }
            selectedOptions { name value }
            image { ${IMAGE_FIELDS} }
            product {
              id
              handle
              title
              modelReference: metafield(namespace: "kingbelt", key: "model_reference") { value }
              primaryCollection: metafield(namespace: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.namespace}", key: "${SHOPIFY_PRIMARY_COLLECTION_METAFIELD.key}") {
                type
                value
                reference {
                  __typename
                  ... on Collection { id handle title }
                }
              }
              featuredImage { ${IMAGE_FIELDS} }
            }
          }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

const CART_MUTATION_RESULT = `
  cart { ...CartFields }
  userErrors { field message code }
  warnings { code message target }
`;

// Cart country comes from buyerIdentity, not @inContext country. Language keeps titles/options in Spanish.
const CART_QUERY = `#graphql
  query Cart($id: ID!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cart(id: $id) {
      ...CartFields
    }
  }
  ${CART_FIELDS}
`;

const CART_LINE_QUANTITIES_QUERY = `#graphql
  query CartLineQuantities($id: ID!) {
    cart(id: $id) {
      lines(first: ${CART_LINE_PAGE_SIZE}) {
        nodes {
          id
          quantity
          merchandise { ... on ProductVariant { id } }
        }
        pageInfo { hasNextPage }
      }
    }
  }
`;

const CART_CREATE_MUTATION = `#graphql
  mutation CartCreate($input: CartInput!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cartCreate(input: $input) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_BUYER_IDENTITY_UPDATE_MUTATION = `#graphql
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!, ${SHOPIFY_CART_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_CART_IN_CONTEXT_DIRECTIVE} {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const invalidQuantityResult = (): CartOperationResult => ({
  success: false,
  cart: emptyCart(),
  error: publicCartOperationError('validation', 'quantity'),
});

interface CartIdVariables {
  id: string;
}

interface CartCreateVariables {
  input: {
    lines: Array<{ merchandiseId: string; quantity: number }>;
    buyerIdentity: ReturnType<typeof shopifyCartBuyerIdentity>;
  };
}

interface CartLinesAddVariables {
  cartId: string;
  lines: Array<{ merchandiseId: string; quantity: number }>;
}

interface CartLinesUpdateVariables {
  cartId: string;
  lines: Array<{ id: string; quantity: number }>;
}

interface CartLinesRemoveVariables {
  cartId: string;
  lineIds: string[];
}

interface CartBuyerIdentityUpdateVariables {
  cartId: string;
  buyerIdentity: ReturnType<typeof shopifyCartBuyerIdentity>;
}

export interface ShopifyCartService {
  get(cartId: string): Promise<{ cart: Cart; cartId?: string }>;
  add(cartId: string | undefined, variantId: string, quantity: number): Promise<CartOperationResult & { cartId?: string }>;
  update(cartId: string, lineId: string, quantity: number): Promise<CartOperationResult & { cartId?: string }>;
  remove(cartId: string, lineId: string): Promise<CartOperationResult & { cartId?: string }>;
  checkout(cartId: string): Promise<CheckoutResult & { cart?: Cart; cartId?: string }>;
}

export const createShopifyCartService = (
  gateway: ShopifyStorefrontGateway,
  checkoutHosts: readonly string[],
): ShopifyCartService => {
  const read = async (cartId: string) =>
    gateway.graphql<{ cart: ShopifyCart | null }, CartIdVariables>(
      CART_QUERY,
      withShopifyCartInContextVariables({ id: cartId })
    );

  const readLineQuantities = async (cartId: string) =>
    gateway.graphql<{ cart: ShopifyCartQuantitySnapshot | null }, CartIdVariables>(
      CART_LINE_QUANTITIES_QUERY,
      { id: cartId }
    );

  const hasExpectedMarket = (cart: ShopifyCart): boolean =>
    cart.buyerIdentity?.countryCode === SHOPIFY_MARKET_CONTEXT.country;

  const syncCartMarketIfNeeded = async (cart: ShopifyCart): Promise<ShopifyCart> => {
    if (hasExpectedMarket(cart)) return cart;
    const response = await gateway.graphql<
      { cartBuyerIdentityUpdate: ShopifyCartPayload },
      CartBuyerIdentityUpdateVariables
    >(
      CART_BUYER_IDENTITY_UPDATE_MUTATION,
      withShopifyCartInContextVariables({
        cartId: cart.id,
        buyerIdentity: shopifyCartBuyerIdentity(),
      })
    );
    const updated = response.cartBuyerIdentityUpdate;
    if (!updated?.cart || updated.userErrors.length) {
      throw new Error('Shopify rejected the cart market context update.');
    }
    if (!hasExpectedMarket(updated.cart)) {
      throw new Error(`Shopify cart country does not match ${SHOPIFY_MARKET_CONTEXT.country}.`);
    }
    return updated.cart;
  };

  const alignPayload = async (
    payload: ShopifyCartPayload | null | undefined
  ): Promise<ShopifyCartPayload | null | undefined> => {
    if (!payload?.cart) return payload;
    return { ...payload, cart: await syncCartMarketIfNeeded(payload.cart) };
  };

  const withCartId = (
    result: CartOperationResult,
    cartId?: string
  ): CartOperationResult & { cartId?: string } => ({
    ...result,
    ...(cartId ? { cartId } : {}),
  });

  const readRemoteCart = async (cartId: string): Promise<ShopifyCart | undefined> => {
    const response = await read(cartId);
    if (!response.cart) return undefined;
    return syncCartMarketIfNeeded(response.cart);
  };

  const createCartWithLine = async (merchandiseId: string, quantity: number) => {
    const response = await gateway.graphql<{ cartCreate: ShopifyCartPayload }, CartCreateVariables>(
      CART_CREATE_MUTATION,
      withShopifyCartInContextVariables({
        input: {
          lines: [{ merchandiseId, quantity }],
          buyerIdentity: shopifyCartBuyerIdentity(),
        },
      })
    );
    const created = await alignPayload(response.cartCreate);
    const result = interpretShopifyCartMutation(created, {
      kind: 'create',
      merchandiseId,
      requestedQuantity: quantity,
    });
    return withCartId(result, created?.cart?.id);
  };

  return {
    async get(cartId) {
      const remote = await readRemoteCart(cartId);
      if (!remote) return { cart: emptyCart() };
      return { cart: mapShopifyCart(remote), cartId };
    },
    async add(cartId, merchandiseId, quantity) {
      if (!isTechnicalLineQuantity(quantity)) return invalidQuantityResult();

      const previous = cartId ? await readLineQuantities(cartId) : undefined;
      if (!cartId || !previous?.cart) {
        return createCartWithLine(merchandiseId, quantity);
      }

      if (wouldExceedShopifyCartLineLimit(previous.cart, merchandiseId)) {
        const current = await readRemoteCart(cartId);
        return withCartId({
          success: false,
          cart: current ? mapShopifyCart(current) : emptyCart(),
          error: {
            code: 'validation',
            message: MAX_CART_LINES_MESSAGE,
            field: 'variant',
          },
        }, cartId);
      }

      const response = await gateway.graphql<{ cartLinesAdd: ShopifyCartPayload }, CartLinesAddVariables>(
        CART_LINES_ADD_MUTATION,
        withShopifyCartInContextVariables({ cartId, lines: [{ merchandiseId, quantity }] })
      );
      const added = await alignPayload(response.cartLinesAdd);
      const result = interpretShopifyCartMutation(added, {
        kind: 'add',
        merchandiseId,
        requestedQuantity: quantity,
        previousLines: previousLinesFromQuantitySnapshot(previous.cart),
      });

      if (!result.success && result.error?.code === 'not_found') {
        const current = await readRemoteCart(cartId);
        if (!current) return createCartWithLine(merchandiseId, quantity);
        return withCartId({ ...result, cart: mapShopifyCart(current) }, cartId);
      }

      return withCartId(result, cartId);
    },
    async update(cartId, lineId, quantity) {
      if (!isTechnicalLineQuantity(quantity)) return invalidQuantityResult();
      const response = await gateway.graphql<{ cartLinesUpdate: ShopifyCartPayload }, CartLinesUpdateVariables>(
        CART_LINES_UPDATE_MUTATION,
        withShopifyCartInContextVariables({ cartId, lines: [{ id: lineId, quantity }] })
      );
      const updated = await alignPayload(response.cartLinesUpdate);
      return withCartId(
        interpretShopifyCartMutation(updated, {
          kind: 'update',
          lineId,
          requestedQuantity: quantity,
        }),
        cartId
      );
    },
    async remove(cartId, lineId) {
      const response = await gateway.graphql<{ cartLinesRemove: ShopifyCartPayload }, CartLinesRemoveVariables>(
        CART_LINES_REMOVE_MUTATION,
        withShopifyCartInContextVariables({ cartId, lineIds: [lineId] })
      );
      const removed = await alignPayload(response.cartLinesRemove);
      return withCartId(
        interpretShopifyCartMutation(removed, {
          kind: 'remove',
          lineId,
        }),
        cartId
      );
    },
    async checkout(cartId) {
      const remote = await readRemoteCart(cartId);
      if (!remote) {
        return { status: 'expired', cart: emptyCart(), message: CHECKOUT_EXPIRED_MESSAGE };
      }
      const cart = mapShopifyCart(remote);
      if (!cart.canCheckout) {
        return { status: 'blocked', cart, message: buildCheckoutBlockedMessage(cart) };
      }
      const safeUrl = getSafeCheckoutUrl({
        status: 'ready',
        url: remote.checkoutUrl ?? undefined,
        allowedHosts: checkoutHosts,
      });
      if (!safeUrl) {
        return {
          status: 'error',
          cart,
          message: 'No se pudo preparar el checkout. Inténtalo de nuevo.',
        };
      }
      return {
        status: 'ready',
        url: safeUrl.href,
        allowedHosts: checkoutHosts,
        cart,
        cartId,
      };
    },
  };
};
