import { isSafeInternalPath } from '../domain/url-policy';
import { normalizePathname, toCanonicalUrl } from '@shared/url';

export { isSafeInternalPath, normalizePathname };

export const CATALOG_INDEX_PATH = '/productos';

export const productPath = (handle: string): string => `/productos/${handle}`;

export const collectionPath = (handle: string): string => `/categorias/${handle}`;

export const resolveCanonicalUrl = toCanonicalUrl;
