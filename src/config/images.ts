/**
 * Política de renderizado de imágenes de producto.
 *
 * No define qué hosts sirven imágenes (eso vive en `src/config/security.ts`
 * junto a la CSP), sino cómo se optimizan las que ya están autorizadas.
 *
 * - La relación de aspecto canónica es 4:5 tanto para la escena como para las
 *   miniaturas. Cuando el CDN permite transformación, se pide un recorte
 *   centrado con esas dimensiones; cuando no, los contenedores la imponen con
 *   `object-fit: cover` y `aspect-ratio`.
 * - `cdn.shopify.com` está autorizado de forma exacta porque el catálogo real
 *   ya devuelve sus imágenes desde ese host. No se admiten comodines.
 * - Las URLs transformadas son deterministas: misma URL origen + mismos
 *   parámetros = misma URL servida. Eso las hace idempotentes para la caché
 *   del CDN y del navegador sin variaciones por sesión.
 */
export const imagePolicy = {
  /** Proporción objetivo: ancho y alto canónicos de slides y miniaturas. */
  aspectWidth: 4,
  aspectHeight: 5,
  /** Calidad equilibrada para fotografía de producto. */
  quality: 82,
  /** Anchos candidatos del srcset de la imagen principal, en píxeles. */
  slideWidths: [480, 768, 960, 1280],
  /** Ancho servido para miniaturas y carrito. */
  thumbWidth: 240,
  /** Hosts exactos cuyo CDN puede generar variantes (recorte, calidad, formato). */
  transformableHosts: ['cdn.shopify.com'],
} as const;
