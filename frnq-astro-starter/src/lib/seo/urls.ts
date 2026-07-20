export function toAbsoluteUrl(value: string | URL, base: string | URL): string {
  return new URL(value, base).href;
}

export function canonicalForPath(pathname: string, site: string | URL): string {
  const url = new URL(pathname, site);
  url.search = '';
  url.hash = '';
  return url.href;
}
