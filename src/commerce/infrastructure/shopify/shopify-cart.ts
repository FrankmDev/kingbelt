import { buildCheckoutBlockedMessage } from '../../application/checkout';
import { getSafeCheckoutUrl } from '../../application/checkout-redirect';
import type { CheckoutResult } from '../../application/checkout';
import { emptyCart } from '../../application/cart-service';
import type { Cart, CartOperationResult } from '../../domain/cart';
import { TECHNICAL_LINE_QUANTITY_LIMIT } from '../../domain/inventory';
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
  query Cart($id: ID!) {
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
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      ${CART_MUTATION_RESULT}
    }
  }
  ${CART_FIELDS}
`;

const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
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
  input: { lines: Array<{ merchandiseId: string; quantity: number }> };
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
    gateway.graphql<{ cart: ShopifyCart | null }, CartIdVariables>(CART_QUERY, { id: cartId });

  const readLineQuantities = async (cartId: string) =>
    gateway.graphql<{ cart: ShopifyCartQuantitySnapshot | null }, CartIdVariables>(
      CART_LINE_QUANTITIES_QUERY,
      { id: cartId }
    );

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
      return { cart: mapShopifyCart(response.cart), cartId };
    },
    async add(cartId, merchandiseId, quantity) {
      if (!isValidQuantity(quantity)) return invalidQuantityResult();
      if (!cartId) {
        const response = await gateway.graphql<{ cartCreate: ShopifyCartPayload }, CartCreateVariables>(
          CART_CREATE_MUTATION,
          { input: { lines: [{ merchandiseId, quantity }] } }
        );
        const result = interpretShopifyCartMutation(response.cartCreate, {
          kind: 'create',
          merchandiseId,
          requestedQuantity: quantity,
        });
        return withCartId(result, response.cartCreate?.cart?.id);
      }

      const previous = await readLineQuantities(cartId);
      const response = await gateway.graphql<{ cartLinesAdd: ShopifyCartPayload }, CartLinesAddVariables>(
        CART_LINES_ADD_MUTATION,
        { cartId, lines: [{ merchandiseId, quantity }] }
      );
      return withCartId(
        interpretShopifyCartMutation(response.cartLinesAdd, {
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
        { cartId, lines: [{ id: lineId, quantity }] }
      );
      return withCartId(
        interpretShopifyCartMutation(response.cartLinesUpdate, {
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
        { cartId, lineIds: [lineId] }
      );
      return withCartId(
        interpretShopifyCartMutation(response.cartLinesRemove, {
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
      const cart = mapShopifyCart(response.cart);
      if (!cart.canCheckout) {
        return { status: 'blocked', cart, message: buildCheckoutBlockedMessage(cart) };
      }
      const safeUrl = getSafeCheckoutUrl({
        status: 'ready',
        url: response.cart.checkoutUrl ?? undefined,
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
