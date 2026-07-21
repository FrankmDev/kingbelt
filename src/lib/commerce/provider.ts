import { createLocalCommerceProvider } from './local-provider';
import type { CommerceProvider } from './types';

/**
 * Punto único de sustitución. Shopify deberá implementar CommerceProvider y
 * comunicarse con una frontera servidor segura cuando requiera credenciales.
 */
export const commerceProvider: CommerceProvider = createLocalCommerceProvider();
