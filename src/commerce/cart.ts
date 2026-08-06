import { createDemoCartAdapter } from './infrastructure/demo/demo-cart-adapter';
import type { CartProvider } from './application/cart-provider';

/** Frontera activa del carrito, independiente del proveedor de catálogo. */
export const cartProvider: CartProvider = createDemoCartAdapter();
