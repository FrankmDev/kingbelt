/** Código ISO 4217. El catálogo decide qué códigos acepta en cada despliegue. */
export type CurrencyCode = string;

/** Los importes se guardan siempre en unidades mínimas. */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface PriceRange {
  min: Money;
  max: Money;
}

const minorUnitCache = new Map<CurrencyCode, number>();

export const getCurrencyMinorUnitDigits = (currency: CurrencyCode): number => {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError('La moneda debe ser un código ISO 4217 de tres letras mayúsculas.');
  }
  const cached = minorUnitCache.get(currency);
  if (cached !== undefined) return cached;

  let digits: number;
  try {
    const resolvedDigits = new Intl.NumberFormat('en', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
    if (resolvedDigits === undefined) {
      throw new TypeError(`No se pudo determinar la precisión de ${currency}.`);
    }
    digits = resolvedDigits;
  } catch {
    throw new TypeError(`La moneda ${currency} no está soportada por el entorno.`);
  }
  if (!Number.isInteger(digits) || digits < 0 || digits > 4) {
    throw new TypeError(`La moneda ${currency} usa una precisión no soportada.`);
  }
  minorUnitCache.set(currency, digits);
  return digits;
};

const getMinorUnitScale = (currency: CurrencyCode): number =>
  10 ** getCurrencyMinorUnitDigits(currency);

const assertMinorAmount = (value: number, label = 'El importe'): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} debe ser un entero no negativo dentro del rango seguro.`);
  }
};

/**
 * Convierte un decimal serializado por un proveedor externo sin pasar por
 * aritmética de coma flotante. El adaptador de Shopify debe usar esta función.
 */
export const moneyFromDecimal = (
  amount: string,
  currency: CurrencyCode = 'EUR'
): Money => {
  const digits = getCurrencyMinorUnitDigits(currency);
  const decimalPattern = digits === 0
    ? /^(0|[1-9]\d*)$/
    : new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${digits}}))?$`);
  const match = decimalPattern.exec(amount.trim());
  if (!match) {
    throw new TypeError(`El importe debe ser un decimal no negativo con hasta ${digits} decimales.`);
  }

  const major = Number(match[1]);
  const minor = Number((match[2] ?? '').padEnd(digits, '0'));
  const amountMinor = major * getMinorUnitScale(currency) + minor;
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError('El importe supera el rango seguro admitido.');
  }

  return { amountMinor, currency };
};

export const moneyFromMajor = (
  amount: number,
  currency: CurrencyCode = 'EUR'
): Money => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError('El importe debe ser un número no negativo y finito.');
  }

  const amountMinor = Math.round((amount + Number.EPSILON) * getMinorUnitScale(currency));
  assertMinorAmount(amountMinor);
  return { amountMinor, currency };
};

export const zeroMoney = (currency: CurrencyCode = 'EUR'): Money => ({
  amountMinor: 0,
  currency,
});

export const formatMoney = (value: Money): string => {
  assertMinorAmount(value.amountMinor);
  const digits = getCurrencyMinorUnitDigits(value.currency);
  const scale = getMinorUnitScale(value.currency);
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: value.amountMinor % scale === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value.amountMinor / scale);
};

export const moneyToDecimal = (value: Money): string => {
  assertMinorAmount(value.amountMinor);
  const digits = getCurrencyMinorUnitDigits(value.currency);
  return (value.amountMinor / getMinorUnitScale(value.currency)).toFixed(digits);
};

export const multiplyMoney = (value: Money, quantity: number): Money => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError('La cantidad debe ser un entero no negativo.');
  }

  assertMinorAmount(value.amountMinor);
  const amountMinor = value.amountMinor * quantity;
  assertMinorAmount(amountMinor, 'El total');
  return { amountMinor, currency: value.currency };
};

export const sumMoney = (values: readonly Money[]): Money => {
  if (!values.length) return zeroMoney();

  const currency = values[0].currency;
  if (values.some((item) => item.currency !== currency)) {
    throw new TypeError('No se pueden sumar importes de monedas distintas.');
  }

  let amountMinor = 0;
  values.forEach((item) => {
    assertMinorAmount(item.amountMinor);
    amountMinor += item.amountMinor;
    assertMinorAmount(amountMinor, 'La suma');
  });
  return { amountMinor, currency };
};
