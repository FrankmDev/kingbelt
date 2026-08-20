export const SMOKE_BASE_URL_ERROR = 'SHOPIFY_SMOKE_BASE_URL must be a HTTPS deployment origin.';
export const SMOKE_PRODUCT_HANDLE_ERROR = 'SHOPIFY_SMOKE_PRODUCT_HANDLE must be a catalog handle.';

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const parseUrl = (raw: string): URL | undefined => {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
};

const isSafeHttps = (url: URL): boolean =>
  url.protocol === 'https:'
  && !url.username
  && !url.password
  && (url.port === '' || url.port === '443');

export const parseSmokeBaseUrl = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw || raw.trim() !== raw || /\s/.test(raw)) {
    throw new Error(SMOKE_BASE_URL_ERROR);
  }
  const url = parseUrl(raw);
  if (
    !url
    || !isSafeHttps(url)
    || url.search
    || url.hash
    || !url.hostname
    || (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error(SMOKE_BASE_URL_ERROR);
  }
  return url.origin;
};

export const parseSmokeProductHandle = (raw: unknown): string => {
  if (typeof raw !== 'string' || raw.trim() !== raw || !HANDLE_PATTERN.test(raw)) {
    throw new Error(SMOKE_PRODUCT_HANDLE_ERROR);
  }
  return raw;
};
