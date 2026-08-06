export const site = {
  name: 'KingBelt',
  tagline: 'Accesorios de cuero para hombre',
  description:
    'Accesorios de cuero para hombre con carácter. Piezas pensadas para la ruta y el uso diario.',
  contact: {
    email: 'hola@kingbelt.com',
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
