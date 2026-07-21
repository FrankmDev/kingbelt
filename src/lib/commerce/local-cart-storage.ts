import type { Cart } from './types';

export const LOCAL_CART_STORAGE_KEY = 'kingbelt-cart-v3';
const LEGACY_STORAGE_KEY = 'kingbelt-cart-v2';
const STORAGE_VERSION = 3;
const MAX_SERIALIZED_LENGTH = 64_000;
const MAX_CART_LINES = 50;
const MAX_VALUE_LENGTH = 128;
const MAX_QUANTITY = 99;

export interface PersistedCartLine {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

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
  lines: PersistedCartLine[];
  source: 'current' | 'legacy' | 'empty' | 'invalid';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeValue = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_VALUE_LENGTH &&
  !/[\u0000-\u001f\u007f]/.test(value);

const parseLine = (value: unknown, legacy = false): PersistedCartLine | null => {
  if (!isRecord(value)) return null;

  const legacyProduct = legacy && isRecord(value.product) ? value.product : undefined;
  const productId = legacy ? legacyProduct?.id : value.productId;

  if (
    !isSafeValue(productId) ||
    !isSafeValue(value.color) ||
    !isSafeValue(value.size) ||
    !Number.isInteger(value.quantity) ||
    Number(value.quantity) < 1 ||
    Number(value.quantity) > MAX_QUANTITY
  ) {
    return null;
  }

  return {
    productId,
    color: value.color,
    size: value.size,
    quantity: Number(value.quantity),
  };
};

const parsePayload = (raw: string, legacy = false): PersistedCartLine[] | null => {
  if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.lines)) return null;
    if (!legacy && parsed.version !== STORAGE_VERSION) return null;
    if (parsed.lines.length > MAX_CART_LINES) return null;

    const lines = parsed.lines.map((line) => parseLine(line, legacy));
    if (lines.some((line) => line === null)) return null;

    return lines.filter((line): line is PersistedCartLine => line !== null);
  } catch {
    return null;
  }
};

export const readPersistedCart = (storage: StorageLike): PersistedCartReadResult => {
  try {
    const current = storage.getItem(LOCAL_CART_STORAGE_KEY);
    if (current !== null) {
      const lines = parsePayload(current);
      return lines ? { lines, source: 'current' } : { lines: [], source: 'invalid' };
    }

    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const lines = parsePayload(legacy, true);
      return lines ? { lines, source: 'legacy' } : { lines: [], source: 'invalid' };
    }

    return { lines: [], source: 'empty' };
  } catch {
    return { lines: [], source: 'invalid' };
  }
};

export const persistCart = (storage: StorageLike, cart: Cart): void => {
  const payload: PersistedCart = {
    version: STORAGE_VERSION,
    lines: cart.lines.slice(0, MAX_CART_LINES).map((line) => ({
      productId: line.productId,
      color: line.color,
      size: line.size,
      quantity: Math.min(line.quantity, MAX_QUANTITY),
    })),
  };

  try {
    storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(payload));
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // El carrito continúa en memoria si el navegador bloquea o llena localStorage.
  }
};
