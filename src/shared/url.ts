export const normalizePathname = (pathname: string): string =>
  pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

/** URL absoluta canónica: origen público + pathname sin barra final (salvo `/`). */
export const toCanonicalUrl = (origin: string | URL, pathname: string): string =>
  new URL(normalizePathname(pathname), origin).href;
