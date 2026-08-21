import { CatalogValidationError } from '../../application/catalog-validation';
import { ShopifyCatalogMappingError } from './catalog-mappers';
import { ShopifyConfigurationError } from './config';
import { ShopifyStorefrontRequestError } from './storefront-gateway';

export interface ResourceCache {
  load<T>(key: string, loader: () => Promise<T>): Promise<T>;
  getFresh<T>(key: string): { hit: true; value: T } | { hit: false };
}

interface CacheEntry<T> {
  value: T;
  loadedAt: number;
}

export interface ResourceCacheOptions {
  /** Límite defensivo para impedir crecimiento de memoria por claves dinámicas. */
  maxEntries?: number;
  /** Antigüedad máxima reutilizable tras un fallo transitorio. */
  maxStaleMs?: number;
  /** Reloj inyectable para tests deterministas. */
  now?: () => number;
}

export const DEFAULT_RESOURCE_CACHE_MAX_ENTRIES = 512;
export const DEFAULT_RESOURCE_CACHE_MAX_STALE_MS = 15 * 60_000;

export const isNonTransientShopifyError = (error: unknown): boolean => {
  if (
    error instanceof ShopifyConfigurationError
    || error instanceof ShopifyCatalogMappingError
    || error instanceof CatalogValidationError
  ) {
    return true;
  }
  if (!(error instanceof ShopifyStorefrontRequestError)) return true;
  if (error.kind === 'network' || error.kind === 'timeout') return false;
  if (error.kind === 'http') {
    return error.status !== 429 && (error.status === undefined || error.status < 500);
  }
  return true;
};

export const createResourceCache = (
  cacheTtlMs?: number,
  isNonTransientError: (error: unknown) => boolean = isNonTransientShopifyError,
  options: ResourceCacheOptions = {}
): ResourceCache => {
  if (cacheTtlMs !== undefined && (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0)) {
    throw new TypeError('cacheTtlMs must be a finite non-negative number.');
  }
  const maxEntries = options.maxEntries ?? DEFAULT_RESOURCE_CACHE_MAX_ENTRIES;
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_RESOURCE_CACHE_MAX_STALE_MS;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
    throw new TypeError('maxEntries must be a positive safe integer.');
  }
  if (!Number.isFinite(maxStaleMs) || maxStaleMs < 0) {
    throw new TypeError('maxStaleMs must be a finite non-negative number.');
  }
  const now = options.now ?? Date.now;
  const values = new Map<string, CacheEntry<unknown>>();
  const inflight = new Map<string, Promise<unknown>>();

  const isFresh = (entry: CacheEntry<unknown>): boolean =>
    cacheTtlMs === undefined || now() - entry.loadedAt < cacheTtlMs;

  const remember = (key: string, value: unknown): void => {
    values.delete(key);
    values.set(key, { value, loadedAt: now() });
    while (values.size > maxEntries) {
      const oldestKey = values.keys().next().value;
      if (oldestKey === undefined) break;
      values.delete(oldestKey);
    }
  };

  const getFresh = <T>(key: string): { hit: true; value: T } | { hit: false } => {
    const entry = values.get(key) as CacheEntry<T> | undefined;
    if (!entry || !isFresh(entry)) return { hit: false };
    return { hit: true, value: entry.value };
  };

  const load = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;

    const fresh = getFresh<T>(key);
    if (fresh.hit) return fresh.value;

    const request = loader()
      .then((value) => {
        remember(key, value);
        return value;
      })
      .catch((error: unknown) => {
        if (isNonTransientError(error)) throw error;
        const previous = values.get(key) as CacheEntry<T> | undefined;
        if (previous && now() - previous.loadedAt <= maxStaleMs) return previous.value;
        if (previous) values.delete(key);
        throw error;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, request);
    return request;
  };

  return { load, getFresh };
};
