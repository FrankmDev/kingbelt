import { collectionPath, isSafeInternalPath, productPath } from './paths';

export type ProductRedirectTarget =
  | { type: 'product'; handle: string }
  | { type: 'collection'; handle: string }
  | { type: 'path'; path: string };

export interface ProductRedirect {
  fromHandle: string;
  to: ProductRedirectTarget;
  /** Por defecto 301. Usar 302 solo para redirecciones temporales. */
  permanent?: boolean;
}

/**
 * Redirecciones de productos eliminados o renombrados.
 * Las rutas de origen no generan página estática: solo la redirección.
 */
export const productRedirects: readonly ProductRedirect[] = [];

export const resolveProductRedirectTarget = (target: ProductRedirectTarget): string => {
  switch (target.type) {
    case 'product':
      return productPath(target.handle);
    case 'collection':
      return collectionPath(target.handle);
    case 'path': {
      if (!isSafeInternalPath(target.path)) {
        throw new Error(`Redirección de producto no segura: ${target.path}`);
      }
      return target.path;
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};

export const buildProductRedirectMap = (): Record<string, { destination: string; status: 301 | 302 }> => {
  const map: Record<string, { destination: string; status: 301 | 302 }> = {};
  productRedirects.forEach((redirect) => {
    map[productPath(redirect.fromHandle)] = {
      destination: resolveProductRedirectTarget(redirect.to),
      status: redirect.permanent === false ? 302 : 301,
    };
  });
  return map;
};

export const getRedirectedProductHandles = (): ReadonlySet<string> =>
  new Set(productRedirects.map((redirect) => redirect.fromHandle));
