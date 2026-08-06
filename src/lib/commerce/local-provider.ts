import {
  addToCart,
  emptyCart,
  removeLine,
  restoreCart,
  updateLineQuantity,
} from './cart-operations';
import { requestLocalCheckout } from './checkout';
import {
  persistCart,
  readPersistedCart,
  type StorageLike,
} from './local-cart-storage';
import type { Cart, CommerceProvider } from './types';

interface LocalProviderOptions {
  storage?: StorageLike | null;
}

const getBrowserStorage = (): StorageLike | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const createLocalCommerceProvider = (
  options: LocalProviderOptions = {}
): CommerceProvider => {
  let cart: Cart = emptyCart();
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;

  const save = () => {
    if (storage) persistCart(storage, cart);
  };

  return {
    async initialize() {
      if (!storage) return cart;

      const persisted = readPersistedCart(storage);
      cart = restoreCart(persisted.lines, persisted.discardedCount);

      if (persisted.source === 'invalid') {
        cart = {
          ...cart,
          globalError: 'No se pudo recuperar el carrito guardado. Se ha iniciado uno nuevo.',
        };
      }

      save();
      return cart;
    },

    async addItem(input) {
      const result = addToCart(cart, input);
      cart = result.cart;
      if (result.success) save();
      return result;
    },

    async updateItem(lineId, quantity) {
      const result = updateLineQuantity(cart, lineId, quantity);
      cart = result.cart;
      if (result.success) save();
      return result;
    },

    async removeItem(lineId) {
      const result = removeLine(cart, lineId);
      cart = result.cart;
      if (result.success) save();
      return result;
    },

    checkout: requestLocalCheckout,
  };
};
