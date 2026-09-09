/**
 * Gemelos JPG para Open Graph/Twitter.
 *
 * Meta y X no renderizan AVIF en las previsualizaciones de compartir, por lo que
 * cada imagen editorial usada como og:image tiene un gemelo 1200x630 JPG en
 * `/public/images/og/`. Las URLs que no están en el mapa (p. ej. JPG de Shopify
 * CDN) se devuelven sin cambios.
 */
const OG_IMAGE_TWINS: ReadonlyMap<string, string> = new Map([
  ['/images/imagen-cinturon-kingbelt-1.avif', '/images/og/imagen-cinturon-kingbelt-1.jpg'],
  ['/images/imagen-cinturon-kingbelt-2.avif', '/images/og/imagen-cinturon-kingbelt-2.jpg'],
  ['/images/imagen-cinturon-kingbelt-3.avif', '/images/og/imagen-cinturon-kingbelt-3.jpg'],
  ['/images/imagen-cinturon-kingbelt-4.avif', '/images/og/imagen-cinturon-kingbelt-4.jpg'],
  ['/images/imagen-cinturon-kingbelt-5.avif', '/images/og/imagen-cinturon-kingbelt-5.jpg'],
  ['/images/imagen-cinturon-kingbelt-6.avif', '/images/og/imagen-cinturon-kingbelt-6.jpg'],
  ['/images/imagen-cinturon-kingbelt-7.avif', '/images/og/imagen-cinturon-kingbelt-7.jpg'],
  ['/images/imagen-cinturon-kingbelt-8.avif', '/images/og/imagen-cinturon-kingbelt-8.jpg'],
  ['/images/imagen-cinturon-kingbelt-9.avif', '/images/og/imagen-cinturon-kingbelt-9.jpg'],
  ['/images/imagen-cinturon-kingbelt-10.avif', '/images/og/imagen-cinturon-kingbelt-10.jpg'],
  ['/images/imagen-cinturon-kingbelt-11.avif', '/images/og/imagen-cinturon-kingbelt-11.jpg'],
  ['/images/imagen-cinturon-kingbelt-12.avif', '/images/og/imagen-cinturon-kingbelt-12.jpg'],
  ['/images/imagen-cinturon-kingbelt-13.avif', '/images/og/imagen-cinturon-kingbelt-13.jpg'],
  ['/images/imagen-cinturon-kingbelt-14.avif', '/images/og/imagen-cinturon-kingbelt-14.jpg'],
  ['/images/imagen-cinturon-kingbelt-15.avif', '/images/og/imagen-cinturon-kingbelt-15.jpg'],
  ['/images/imagen-cinturon-kingbelt-16.avif', '/images/og/imagen-cinturon-kingbelt-16.jpg'],
  ['/images/imagen-cinturon-kingbelt-17.avif', '/images/og/imagen-cinturon-kingbelt-17.jpg'],
  ['/images/imagen-cinturon-kingbelt-18.avif', '/images/og/imagen-cinturon-kingbelt-18.jpg'],
  ['/images/imagen-cinturon-kingbelt-20.avif', '/images/og/imagen-cinturon-kingbelt-20.jpg'],
  ['/images/imagen-cinturon-kingbelt-21.avif', '/images/og/imagen-cinturon-kingbelt-21.jpg'],
]);

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Devuelve el gemelo JPG para compartir, si existe; si no, la URL original. */
export const toOgImageUrl = (url: string): string => OG_IMAGE_TWINS.get(url) ?? url;
