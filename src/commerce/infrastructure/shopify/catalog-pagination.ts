export const SHOPIFY_PAGE_SIZE = 250;
const MAX_CONNECTION_PAGES = 40;

export interface ShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyConnection<T> {
  nodes: T[];
  pageInfo: ShopifyPageInfo;
}

export const completedConnection = <T>(nodes: T[]): ShopifyConnection<T> => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});

export const shopifyPageSize = (requested: number): number => {
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error('El tamaño de página Shopify debe ser un entero positivo.');
  }
  return Math.min(requested, SHOPIFY_PAGE_SIZE);
};

export const requireNextCursor = (pageInfo: ShopifyPageInfo, label: string): string => {
  if (!pageInfo.endCursor) {
    throw new Error(`Shopify devolvió una página incompleta de ${label}: falta endCursor.`);
  }
  return pageInfo.endCursor;
};

const assertCursorAdvances = (
  previousCursor: string,
  pageInfo: ShopifyPageInfo,
  label: string
): void => {
  if (pageInfo.hasNextPage && pageInfo.endCursor === previousCursor) {
    throw new Error(`Shopify devolvió un cursor que no avanza de ${label}.`);
  }
};

/** Completa una conexión paginada. Los cursores no salen de infraestructura. */
export const collectConnectionPages = async <T>(
  initial: ShopifyConnection<T>,
  label: string,
  loadPage: (after: string) => Promise<ShopifyConnection<T>>
): Promise<T[]> => {
  const nodes = [...initial.nodes];
  let pageInfo = initial.pageInfo;
  const seenCursors = new Set<string>();
  let pages = 1;

  while (pageInfo.hasNextPage) {
    if (pages >= MAX_CONNECTION_PAGES) {
      throw new Error(`Shopify superó el límite de páginas de ${label}.`);
    }
    const cursor = requireNextCursor(pageInfo, label);
    if (seenCursors.has(cursor)) {
      throw new Error(`Shopify devolvió un cursor repetido de ${label}: la paginación no avanza.`);
    }
    seenCursors.add(cursor);
    const page = await loadPage(cursor);
    assertCursorAdvances(cursor, page.pageInfo, label);
    nodes.push(...page.nodes);
    pageInfo = page.pageInfo;
    pages += 1;
  }

  return nodes;
};

export const collectLimitedConnectionPages = async <T>(
  initial: ShopifyConnection<T>,
  label: string,
  loadPage: (after: string, first: number) => Promise<ShopifyConnection<T>>,
  limit: number
): Promise<T[]> => {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('El límite de paginación Shopify debe ser un entero no negativo.');
  }
  if (limit === 0) return [];

  const nodes = [...initial.nodes];
  let pageInfo = initial.pageInfo;
  const seenCursors = new Set<string>();
  let pages = 1;

  while (nodes.length < limit && pageInfo.hasNextPage) {
    if (pages >= MAX_CONNECTION_PAGES) {
      throw new Error(`Shopify superó el límite de páginas de ${label}.`);
    }
    const cursor = requireNextCursor(pageInfo, label);
    if (seenCursors.has(cursor)) {
      throw new Error(`Shopify devolvió un cursor repetido de ${label}: la paginación no avanza.`);
    }
    seenCursors.add(cursor);
    const page = await loadPage(cursor, shopifyPageSize(limit - nodes.length));
    assertCursorAdvances(cursor, page.pageInfo, label);
    nodes.push(...page.nodes);
    pageInfo = page.pageInfo;
    pages += 1;
  }

  return nodes.slice(0, limit);
};
