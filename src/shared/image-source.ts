import { imagePolicy } from '@config/images';
import { isAllowedImageUrl } from '@commerce/domain/url-policy';

/**
 * Fuentes de imagen optimizadas para renderizado.
 *
 * Este módulo es presentación pura: nunca decide qué hosts son válidos (eso lo
 * hace la validación del catálogo contra `publicSecurityConfig`), solo aplica
 * transformación de CDN cuando el host está autorizado en
 * `imagePolicy.transformableHosts`. Mientras esa lista esté vacía, todas las
 * URLs se sirven tal cual llegan del catálogo (rutas locales de la demo).
 */

/**
 * Solo se transforma un host remoto autorizado. Las rutas internas (`/…`) se
 * sirven tal cual aunque `isAllowedImageUrl` las acepte para renderizado.
 */
const isTransformableUrl = (url: string): boolean =>
  !url.startsWith('/') && isAllowedImageUrl(url, imagePolicy.transformableHosts);

const appendQueryParams = (url: string, params: Readonly<Record<string, string | number>>): string => {
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${url}${separator}${query}`;
};

const aspectHeightFor = (width: number): number =>
  Math.round(width * (imagePolicy.aspectHeight / imagePolicy.aspectWidth));

/**
 * URL optimizada a un ancho dado con recorte 4:5 centrado, calidad y formato
 * moderno negociado por el navegador. Devuelve la URL original sin tocar
 * cuando el CDN no está autorizado (local o host no transformable).
 */
export const buildOptimizedImageUrl = (url: string, width: number): string => {
  if (!isTransformableUrl(url)) return url;
  return appendQueryParams(url, {
    width,
    height: aspectHeightFor(width),
    crop: 'center',
    quality: imagePolicy.quality,
    format: 'auto',
  });
};

/**
 * Variantes responsivas (`srcset`) o null cuando el CDN no puede transformar.
 * Con `null` el componente renderiza una única `src`, suficiente para la demo.
 */
export const buildImageSrcset = (url: string, widths?: readonly number[]): string | null => {
  if (!isTransformableUrl(url)) return null;
  return (widths ?? imagePolicy.slideWidths)
    .map((width) => `${buildOptimizedImageUrl(url, width)} ${width}w`)
    .join(', ');
};

/** URL reducida para miniaturas y carrito; original si el CDN no transforma. */
export const buildThumbnailUrl = (url: string): string =>
  buildOptimizedImageUrl(url, imagePolicy.thumbWidth);

export interface OptimizedImageSource {
  /** URL base servida. */
  readonly src: string;
  /** `srcset` responsivo o null cuando el CDN no está autorizado. */
  readonly srcset: string | null;
  /** `sizes` válido únicamente cuando existe `srcset`. */
  readonly sizes: string | null;
}

export const buildSlideSource = (url: string, sizes: string): OptimizedImageSource => {
  const srcset = buildImageSrcset(url);
  return {
    src: buildOptimizedImageUrl(url, imagePolicy.slideWidths[imagePolicy.slideWidths.length - 1]),
    srcset,
    sizes: srcset ? sizes : null,
  };
};

export const buildCardSource = (url: string, sizes: string): OptimizedImageSource => {
  const srcset = buildImageSrcset(url);
  return {
    src: buildOptimizedImageUrl(url, 480),
    srcset,
    sizes: srcset ? sizes : null,
  };
};
