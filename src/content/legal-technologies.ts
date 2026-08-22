import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../session-storage-config';

export interface CookieTechnology {
  name: string;
  type: 'localStorage' | 'sessionStorage' | 'cookie';
  purpose: string;
  duration: string;
  provider: string;
  context?: 'demo' | 'shopify' | 'all';
}

export interface ExternalResource {
  name: string;
  domains: string[];
  purpose: string;
  cookieNote: string;
}

const SESSION_COOKIE_MAX_AGE_DAYS = SESSION_TTL_SECONDS / (60 * 60 * 24);

/** Solo tecnologías actualmente demostrables en el código del sitio. */
export const currentTechnologies: CookieTechnology[] = [
  {
    name: SESSION_COOKIE_NAME,
    type: 'cookie',
    purpose:
      'Identificador opaco de sesión para persistir el carrito Shopify en el servidor. No contiene el Cart ID, precios ni datos de pago.',
    duration: `${SESSION_COOKIE_MAX_AGE_DAYS} días (maxAge y ttl de la sesión Astro: ${SESSION_TTL_SECONDS} segundos).`,
    provider: 'KingBelt (primera parte)',
    context: 'shopify',
  },
  {
    name: 'kingbelt-cart-v4',
    type: 'localStorage',
    purpose:
      'Conservar las líneas del carrito de demostración (identificador de variante y cantidad) entre visitas. No se usa en el modo Shopify de producción.',
    duration: 'Hasta que el usuario borre los datos del sitio o se migre a una versión posterior.',
    provider: 'KingBelt (primera parte)',
    context: 'demo',
  },
];

export const externalResources: ExternalResource[] = [
  {
    name: 'Fontshare (API)',
    domains: ['api.fontshare.com'],
    purpose: 'Carga de la tipografía Satoshi.',
    cookieNote: 'No se declaran cookies propias de KingBelt en estos dominios.',
  },
  {
    name: 'Google Fonts',
    domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    purpose: 'Carga de la tipografía Bitter.',
    cookieNote: 'No se declaran cookies propias de KingBelt en estos dominios.',
  },
];
