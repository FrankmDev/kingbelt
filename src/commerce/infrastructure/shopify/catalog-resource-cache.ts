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
  isNonTransientError: (error: unknown) => boolean = isNonTransientShopifyError
): ResourceCache => {
  const values = new Map<string, CacheEntry<unknown>>();
  const inflight = new Map<string, Promise<unknown>>();

  const isFresh = (entry: CacheEntry<unknown>): boolean =>
    cacheTtlMs === undefined || Date.now() - entry.loadedAt < cacheTtlMs;

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
        values.set(key, { value, loadedAt: Date.now() });
        return value;
      })
      .catch((error: unknown) => {
        if (isNonTransientError(error)) throw error;
        const previous = values.get(key) as CacheEntry<T> | undefined;
        if (previous) return previous.value;
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
