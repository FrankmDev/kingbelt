import { buildShopifyCheckoutHosts } from '../../application/checkout-redirect';
import type { CheckoutResult } from '../../application/checkout';
import type { Cart, CartOperationErrorCode, CartOperationResult } from '../../domain/cart';
import { variantId, productId } from '../../domain/identifiers';
import { moneyFromDecimal, sumMoney, zeroMoney } from '../../domain/money';
import { TECHNICAL_LINE_QUANTITY_LIMIT } from '../../domain/inventory';
import type { ShopifyStorefrontGateway } from './storefront-gateway';

const CART_QUERY = `#graphql
  query Cart($id: ID!) {
    cart(id: $id) {
      id
      checkoutUrl
      totalQuantity
      cost { subtotalAmount { amount currencyCode } }
      lines(first: 100) {
        nodes {
          id
          quantity
          cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } }
          merchandise {
            ... on ProductVariant {
              id
              title
              selectedOptions { name value }
              image { id url width height altText }
              product {
                id
                handle
                title
                productType
                featuredImage { id url width height altText }
              }
            }
          }
        }
      }
    }
  }
`;

const CART_CREATE_MUTATION = `#graphql
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id quantity
        cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id title selectedOptions { name value }
            image { id url width height altText }
            product { id handle title productType featuredImage { id url width height altText } }
          }
        }
      }
    }
  }
`;

const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) { nodes { id quantity cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title selectedOptions { name value } image { id url width height altText } product { id handle title productType featuredImage { id url width height altText } } } } } }
  }
`;

const CART_LINES_UPDATE_MUTATION = CART_LINES_ADD_MUTATION.replace('CartLinesAdd', 'CartLinesUpdate').replace('cartLinesAdd', 'cartLinesUpdate').replace('[CartLineInput!]!', '[CartLineUpdateInput!]!');
const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) { nodes { id quantity cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title selectedOptions { name value } image { id url width height altText } product { id handle title productType featuredImage { id url width height altText } } } } } }
  }
`;

interface ShopifyMoney { amount: string; currencyCode: string }
interface ShopifyImage { id: string; url: string; width: number; height: number; altText?: string | null }
interface ShopifyCartLine {
  id: string;
  quantity: number;
  cost: { amountPerQuantity: ShopifyMoney; totalAmount: ShopifyMoney };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: Array<{ name: string; value: string }>;
    image?: ShopifyImage | null;
    product: { id: string; handle: string; title: string; productType: string; featuredImage?: ShopifyImage | null };
  } | null;
}
interface ShopifyCart { id: string; checkoutUrl?: string | null; totalQuantity: number; cost: { subtotalAmount: ShopifyMoney }; lines: { nodes: ShopifyCartLine[] } }
interface ShopifyUserError { field?: string[] | null; message: string; code?: string | null }
interface CartPayload { cart: ShopifyCart | null; userErrors: ShopifyUserError[] }

const imageFromShopify = (image: ShopifyImage | null | undefined) => image
  ? { id: image.id, url: image.url, width: image.width, height: image.height, altText: image.altText?.trim() || 'Producto KingBelt' }
  : undefined;

const errorCode = (errors: ShopifyUserError[]): CartOperationErrorCode => {
  const text = errors.map((error) => error.message.toLowerCase()).join(' ');
  if (text.includes('stock') || text.includes('inventory') || text.includes('available')) return 'out_of_stock';
  if (text.includes('quantity')) return 'quantity_limit';
  return 'provider_error';
};

const errorMessage = (errors: ShopifyUserError[]): string =>
  errors.map((error) => error.message).slice(0, 2).join(' ') || 'Shopify no ha podido actualizar el carrito.';

const mapCart = (remote: ShopifyCart | null): Cart => {
  if (!remote) return { lines: [], itemCount: 0, subtotal: zeroMoney(), lineErrors: [], status: 'idle', canCheckout: false };
  const lines = remote.lines.nodes.flatMap((line) => {
    if (!line.merchandise) return [];
    const merchandise = line.merchandise;
    const image = imageFromShopify(merchandise.image ?? merchandise.product.featuredImage);
    const unitPrice = moneyFromDecimal(line.cost.amountPerQuantity.amount, line.cost.amountPerQuantity.currencyCode);
    const lineTotal = moneyFromDecimal(line.cost.totalAmount.amount, line.cost.totalAmount.currencyCode);
    const availability = {
      status: 'available' as const,
      purchasable: true,
      maxQuantity: TECHNICAL_LINE_QUANTITY_LIMIT,
      minimum: 1,
      increment: 1,
      limitReason: 'technical' as const,
      quantityKnown: false,
      backorder: false,
      message: 'Disponible.',
    };
    return [{
      id: line.id,
      variantId: variantId(merchandise.id),
      product: {
        id: productId(merchandise.product.id),
        handle: merchandise.product.handle,
        title: merchandise.product.title,
        collection: merchandise.product.productType || 'KingBelt',
        reference: merchandise.product.handle,
        unitPrice,
        ...(image ? { image } : {}),
        href: `/productos/${merchandise.product.handle}`,
      },
      selectedOptions: merchandise.selectedOptions,
      quantity: line.quantity,
      availability,
      lineTotal,
    }];
  });
  const subtotal = lines.length ? sumMoney(lines.map((line) => line.lineTotal)) : zeroMoney(remote.cost.subtotalAmount.currencyCode);
  return { lines, itemCount: remote.totalQuantity, subtotal, lineErrors: [], status: 'idle', canCheckout: lines.length > 0 };
};

export interface ShopifyCartService {
  get(cartId: string): Promise<{ cart: Cart; cartId?: string; checkoutUrl?: string }>;
  add(cartId: string | undefined, variantId: string, quantity: number): Promise<CartOperationResult & { cartId?: string }>;
  update(cartId: string, lineId: string, quantity: number): Promise<CartOperationResult & { cartId?: string }>;
  remove(cartId: string, lineId: string): Promise<CartOperationResult & { cartId?: string }>;
  checkout(cartId: string): Promise<CheckoutResult & { cart?: Cart; cartId?: string }>;
}

export const createShopifyCartService = (
  gateway: ShopifyStorefrontGateway,
  checkoutHosts: readonly string[],
): ShopifyCartService => {
  const read = async (cartId: string) => gateway.graphql<{ cart: ShopifyCart | null }, Record<string, unknown>>(CART_QUERY, { id: cartId });
  const result = (payload: CartPayload, cartId?: string): CartOperationResult & { cartId?: string } => {
    const cart = mapCart(payload.cart);
    if (payload.userErrors.length) return { success: false, cart, cartId, error: { code: errorCode(payload.userErrors), message: errorMessage(payload.userErrors) } };
    return { success: true, cart, cartId };
  };
  return {
    async get(cartId) {
      const response = await read(cartId);
      return response.cart ? { cart: mapCart(response.cart), cartId, checkoutUrl: response.cart.checkoutUrl ?? undefined } : { cart: mapCart(null) };
    },
    async add(cartId, merchandiseId, quantity) {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
        return { success: false, cart: mapCart(null), error: { code: 'validation', message: 'La cantidad solicitada no es válida.', field: 'quantity' } };
      }
      if (!cartId) {
        const response = await gateway.graphql<{ cartCreate: CartPayload }, Record<string, unknown>>(CART_CREATE_MUTATION, { input: { lines: [{ merchandiseId, quantity }] } });
        return result(response.cartCreate, response.cartCreate.cart?.id);
      }
      const response = await gateway.graphql<{ cartLinesAdd: CartPayload }, Record<string, unknown>>(CART_LINES_ADD_MUTATION, { cartId, lines: [{ merchandiseId, quantity }] });
      return result(response.cartLinesAdd, cartId);
    },
    async update(cartId, lineId, quantity) {
      const response = await gateway.graphql<{ cartLinesUpdate: CartPayload }, Record<string, unknown>>(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] });
      return result(response.cartLinesUpdate, cartId);
    },
    async remove(cartId, lineId) {
      const response = await gateway.graphql<{ cartLinesRemove: CartPayload }, Record<string, unknown>>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] });
      return result(response.cartLinesRemove, cartId);
    },
    async checkout(cartId) {
      const response = await read(cartId);
      if (!response.cart) return { status: 'expired', message: 'El carrito ha caducado; vuelve a añadir tus productos.' };
      const cart = mapCart(response.cart);
      if (!cart.canCheckout) return { status: 'blocked', cart, message: 'Revisa el carrito antes de continuar.' };
      return { status: 'ready', url: response.cart.checkoutUrl ?? undefined, allowedHosts: checkoutHosts, cart, cartId };
    },
  };
};

export { buildShopifyCheckoutHosts };
