import { createLocalCommerceProvider } from './local-provider';
import type { CommerceProvider } from './types';

/** Frontera activa del carrito, independiente del proveedor de catálogo. */
export const commerceProvider: CommerceProvider = createLocalCommerceProvider();
