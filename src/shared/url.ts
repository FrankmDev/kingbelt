export const normalizePathname = (pathname: string): string =>
  pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
