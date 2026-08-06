import { MAX_CART_LINES } from '../../domain/cart';
import { variantId } from '../../domain/identifiers';
import { MAX_CART_QUANTITY } from '../../domain/variants';
import type { Cart } from '../../domain/cart';
import type {
  LegacyPersistedCartLine,
  PersistedCartEntry,
  PersistedCartLine,
} from '../../application/cart-service';

export const LOCAL_CART_STORAGE_KEY = 'kingbelt-cart-v4';
export const LEGACY_CART_STORAGE_KEYS = ['kingbelt-cart-v3', 'kingbelt-cart-v2'] as const;
const STORAGE_VERSION = 4;
const MAX_SERIALIZED_LENGTH = 16_384;
const MAX_VALUE_LENGTH = 256;

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
  source: 'current' | 'legacy' | 'empty' | 'invalid' | 'unavailable';
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
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_CART_QUANTITY;

const parseCurrentLine = (value: unknown): PersistedCartLine | null => {
  if (!isRecord(value) || !isSafeValue(value.variantId) || !validQuantity(value.quantity)) return null;
  if (Object.keys(value).some((key) => key !== 'variantId' && key !== 'quantity')) return null;
  return { variantId: variantId(value.variantId), quantity: Number(value.quantity) };
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
    if (!isRecord(parsed) || !Array.isArray(parsed.lines) || parsed.lines.length > MAX_CART_LINES) {
      return null;
    }
    if (kind === 'current' && Object.keys(parsed).some((key) => key !== 'version' && key !== 'lines')) {
      return null;
    }
    if (kind === 'current' && parsed.version !== STORAGE_VERSION) return null;
    if (kind === 'v3' && parsed.version !== 3) return null;

    const parsedLines = parsed.lines.map((line) =>
      kind === 'current' ? parseCurrentLine(line) : parseLegacyLine(line, kind === 'v2')
    );

    if (kind === 'current') {
      if (parsedLines.some((line) => line === null)) return null;
      const currentLines = parsedLines as PersistedCartLine[];
      if (new Set(currentLines.map((line) => line.variantId)).size !== currentLines.length) return null;
      return { lines: currentLines, discardedCount: 0 };
    }

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
      { key: LEGACY_CART_STORAGE_KEYS[0], kind: 'v3' as const, source: 'legacy' as const },
      { key: LEGACY_CART_STORAGE_KEYS[1], kind: 'v2' as const, source: 'legacy' as const },
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
    return { lines: [], source: 'unavailable', discardedCount: 0 };
  }
};

export const persistCart = (storage: StorageLike, cart: Cart): boolean => {
  if (
    cart.lines.length > MAX_CART_LINES ||
    cart.lines.some((line) => !isSafeValue(line.variantId) || !validQuantity(line.quantity)) ||
    new Set(cart.lines.map((line) => line.variantId)).size !== cart.lines.length
  ) {
    return false;
  }

  const payload: PersistedCart = {
    version: STORAGE_VERSION,
    lines: cart.lines.map(({ variantId: id, quantity }) => ({ variantId: id, quantity })),
  };

  try {
    storage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }

  LEGACY_CART_STORAGE_KEYS.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // El formato actual ya está guardado; limpiar claves antiguas es secundario.
    }
  });
  return true;
};
