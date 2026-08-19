import { buildCheckoutBlockedMessage } from '../../application/checkout';
import { getSafeCheckoutUrl } from '../../application/checkout-redirect';
import type { CheckoutResult } from '../../application/checkout';
import { emptyCart } from '../../application/cart-service';
import type { Cart, CartOperationResult } from '../../domain/cart';
import { TECHNICAL_LINE_QUANTITY_LIMIT } from '../../domain/inventory';
import {
  SHOPIFY_IN_CONTEXT_DIRECTIVE,
  SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS,
  SHOPIFY_MARKET_CONTEXT,
  shopifyCartBuyerIdentity,
  withShopifyInContextVariables,
} from './config';
import type { ShopifyStorefrontGateway } from './storefront-gateway';
import {
  interpretShopifyCartMutation,
  mapShopifyCart,
  previousLinesFromQuantitySnapshot,
  publicCartOperationError,
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
              productType
              metafield(namespace: "kingbelt", key: "model_reference") { value }
              collections(first: 1) { nodes { title } }
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

const CART_QUERY = `#graphql
  query Cart($id: ID!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
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
  mutation CartCreate($input: CartInput!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    cartCreate(input: $input) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_BUYER_IDENTITY_UPDATE_MUTATION = `#graphql
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!, ${SHOPIFY_IN_CONTEXT_VARIABLE_DEFINITIONS}) ${SHOPIFY_IN_CONTEXT_DIRECTIVE} {
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

const isValidQuantity = (quantity: number): boolean =>
  Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= TECHNICAL_LINE_QUANTITY_LIMIT;

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
      withShopifyInContextVariables({ id: cartId })
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
      withShopifyInContextVariables({
        cartId: cart.id,
        buyerIdentity: shopifyCartBuyerIdentity(),
      })
    );
    const updated = response.cartBuyerIdentityUpdate;
    if (!updated?.cart || updated.userErrors.length) {
      throw new Error('Shopify rejected the cart market context update.');
    }
    return updated.cart;
  };

  const withCartId = (
    result: CartOperationResult,
    cartId?: string
  ): CartOperationResult & { cartId?: string } => ({
    ...result,
    ...(cartId ? { cartId } : {}),
  });

  return {
    async get(cartId) {
      const response = await read(cartId);
      if (!response.cart) return { cart: emptyCart() };
      const cart = await syncCartMarketIfNeeded(response.cart);
      return { cart: mapShopifyCart(cart), cartId };
    },
    async add(cartId, merchandiseId, quantity) {
      if (!isValidQuantity(quantity)) return invalidQuantityResult();
      if (!cartId) {
        const response = await gateway.graphql<{ cartCreate: ShopifyCartPayload }, CartCreateVariables>(
          CART_CREATE_MUTATION,
          withShopifyInContextVariables({
            input: {
              lines: [{ merchandiseId, quantity }],
              buyerIdentity: shopifyCartBuyerIdentity(),
            },
          })
        );
        const created = response.cartCreate?.cart
          ? { ...response.cartCreate, cart: await syncCartMarketIfNeeded(response.cartCreate.cart) }
          : response.cartCreate;
        const result = interpretShopifyCartMutation(created, {
          kind: 'create',
          merchandiseId,
          requestedQuantity: quantity,
        });
        return withCartId(result, created?.cart?.id);
      }

      const previous = await readLineQuantities(cartId);
      const response = await gateway.graphql<{ cartLinesAdd: ShopifyCartPayload }, CartLinesAddVariables>(
        CART_LINES_ADD_MUTATION,
        withShopifyInContextVariables({ cartId, lines: [{ merchandiseId, quantity }] })
      );
      const added = response.cartLinesAdd?.cart
        ? { ...response.cartLinesAdd, cart: await syncCartMarketIfNeeded(response.cartLinesAdd.cart) }
        : response.cartLinesAdd;
      return withCartId(
        interpretShopifyCartMutation(added, {
          kind: 'add',
          merchandiseId,
          requestedQuantity: quantity,
          previousLines: previousLinesFromQuantitySnapshot(previous.cart),
        }),
        cartId
      );
    },
    async update(cartId, lineId, quantity) {
      if (!isValidQuantity(quantity)) return invalidQuantityResult();
      const response = await gateway.graphql<{ cartLinesUpdate: ShopifyCartPayload }, CartLinesUpdateVariables>(
        CART_LINES_UPDATE_MUTATION,
        withShopifyInContextVariables({ cartId, lines: [{ id: lineId, quantity }] })
      );
      const updated = response.cartLinesUpdate?.cart
        ? { ...response.cartLinesUpdate, cart: await syncCartMarketIfNeeded(response.cartLinesUpdate.cart) }
        : response.cartLinesUpdate;
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
        withShopifyInContextVariables({ cartId, lineIds: [lineId] })
      );
      const removed = response.cartLinesRemove?.cart
        ? { ...response.cartLinesRemove, cart: await syncCartMarketIfNeeded(response.cartLinesRemove.cart) }
        : response.cartLinesRemove;
      return withCartId(
        interpretShopifyCartMutation(removed, {
          kind: 'remove',
          lineId,
        }),
        cartId
      );
    },
    async checkout(cartId) {
      const response = await read(cartId);
      if (!response.cart) {
        return { status: 'expired', message: 'El carrito ha caducado; vuelve a añadir tus productos.' };
      }
      const remote = await syncCartMarketIfNeeded(response.cart);
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
