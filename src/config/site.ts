export const site = {
  name: 'KingBelt',
  tagline: 'Accesorios de cuero para hombre',
  description:
    'Accesorios de cuero para hombre con carácter. Piezas pensadas para la ruta y el uso diario.',
  logos: {
    ink: '/images/brand/logo.avif',
    white: '/images/brand/logo-white.avif',
    width: 3969,
    height: 2102,
  },
  contact: {
    email: 'contabilidad@cintuelx.com',
  },
  social: {
    instagram: {
      handle: '@kingbelt',
      href: 'https://instagram.com/kingbelt',
    },
  },
} as const;

/** Debe coincidir con `site` en `astro.config.mjs`. */
export const siteUrl = 'https://kingbelt.com' as const;
