import { selectCommerceProvider } from './commerce-source';
import type { CartProvider } from './application/cart-provider';

/** Proveedor explícito: Shopify nunca degrada al carrito demo. */
export const cartProvider: CartProvider = await selectCommerceProvider({
  demo: () =>
    import('./infrastructure/demo/demo-cart-adapter').then((mod) => mod.createDemoCartAdapter()),
  shopify: () =>
    import('./infrastructure/shopify/shopify-cart-adapter').then((mod) =>
      mod.createShopifyCartAdapter()
    ),
});
