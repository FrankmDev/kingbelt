import type { Cart } from './types';

export const LOCAL_CART_STORAGE_KEY = 'kingbelt-cart-v4';
const LEGACY_V3_STORAGE_KEY = 'kingbelt-cart-v3';
const LEGACY_V2_STORAGE_KEY = 'kingbelt-cart-v2';
const STORAGE_VERSION = 4;
const MAX_SERIALIZED_LENGTH = 64_000;
const MAX_CART_LINES = 50;
const MAX_VALUE_LENGTH = 256;
const MAX_QUANTITY = 99;

export interface PersistedCartLine {
  variantId: string;
  quantity: number;
}

export interface LegacyPersistedCartLine {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export type PersistedCartEntry = PersistedCartLine | LegacyPersistedCartLine;

interface PersistedCart {
  version: typeof STORAGE_VERSION;
  lines: PersistedCartLine[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedCartReadResult {
  lines: PersistedCartEntry[];
  source: 'current' | 'legacy' | 'empty' | 'invalid';
  discardedCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeValue = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_VALUE_LENGTH &&
  !/[\u0000-\u001f\u007f]/.test(value);

const validQuantity = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_QUANTITY;

const parseCurrentLine = (value: unknown): PersistedCartLine | null => {
  if (!isRecord(value) || !isSafeValue(value.variantId) || !validQuantity(value.quantity)) return null;
  return { variantId: value.variantId, quantity: Number(value.quantity) };
};

const parseLegacyLine = (value: unknown, nestedProduct: boolean): LegacyPersistedCartLine | null => {
  if (!isRecord(value)) return null;
  const product = nestedProduct && isRecord(value.product) ? value.product : undefined;
  const productId = nestedProduct ? product?.id : value.productId;
  if (
    !isSafeValue(productId) ||
    !isSafeValue(value.color) ||
    !isSafeValue(value.size) ||
    !validQuantity(value.quantity)
  ) return null;
  return { productId, color: value.color, size: value.size, quantity: Number(value.quantity) };
};

const parsePayload = (
  raw: string,
  kind: 'current' | 'v3' | 'v2'
): { lines: PersistedCartEntry[]; discardedCount: number } | null => {
  if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.lines) || parsed.lines.length > MAX_CART_LINES) return null;
    if (kind === 'current' && parsed.version !== STORAGE_VERSION) return null;
    if (kind === 'v3' && parsed.version !== 3) return null;

    const parsedLines = parsed.lines.map((line) =>
      kind === 'current' ? parseCurrentLine(line) : parseLegacyLine(line, kind === 'v2')
    );
    const discardedCount = parsedLines.filter((line) => line === null).length;
    return {
      lines: parsedLines.filter((line): line is PersistedCartEntry => line !== null),
      discardedCount,
    };
  } catch {
    return null;
  }
};

export const readPersistedCart = (storage: StorageLike): PersistedCartReadResult => {
  try {
    const candidates = [
      { key: LOCAL_CART_STORAGE_KEY, kind: 'current' as const, source: 'current' as const },
      { key: LEGACY_V3_STORAGE_KEY, kind: 'v3' as const, source: 'legacy' as const },
      { key: LEGACY_V2_STORAGE_KEY, kind: 'v2' as const, source: 'legacy' as const },
    ];
    for (const candidate of candidates) {
      const raw = storage.getItem(candidate.key);
      if (raw === null) continue;
      const parsed = parsePayload(raw, candidate.kind);
      return parsed
        ? { ...parsed, source: candidate.source }
        : { lines: [], source: 'invalid', discardedCount: 0 };
    }
    return { lines: [], source: 'empty', discardedCount: 0 };
  } catch {
    return { lines: [], source: 'invalid', discardedCount: 0 };
  }
};

export const persistCart = (storage: StorageLike, cart: Cart): void => {
  const payload: PersistedCart = {
    version: STORAGE_VERSION,
    lines: cart.lines.slice(0, MAX_CART_LINES).map((line) => ({
      variantId: line.variantId,
      quantity: Math.min(line.quantity, MAX_QUANTITY),
    })),
  };
  try {
    storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(payload));
    storage.removeItem(LEGACY_V3_STORAGE_KEY);
    storage.removeItem(LEGACY_V2_STORAGE_KEY);
  } catch {
    // El carrito continúa en memoria si el navegador bloquea o llena localStorage.
  }
};
