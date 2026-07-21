import type { CurrencyCode, Money } from './types';

const MINOR_UNITS = 100;

/**
 * Convierte un decimal serializado por un proveedor externo sin pasar por
 * aritmética de coma flotante. El adaptador de Shopify debe usar esta función.
 */
export const moneyFromDecimal = (
  amount: string,
  currency: CurrencyCode = 'EUR'
): Money => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) {
    throw new TypeError('El importe debe ser un decimal positivo con hasta dos decimales.');
  }

  const major = Number(match[1]);
  const minor = Number((match[2] ?? '').padEnd(2, '0'));
  const amountMinor = major * MINOR_UNITS + minor;
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
    throw new TypeError('El importe debe ser un número positivo y finito.');
  }

  return {
    amountMinor: Math.round((amount + Number.EPSILON) * MINOR_UNITS),
    currency,
  };
};

export const zeroMoney = (currency: CurrencyCode = 'EUR'): Money => ({
  amountMinor: 0,
  currency,
});

export const formatMoney = (value: Money): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: value.amountMinor % MINOR_UNITS === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value.amountMinor / MINOR_UNITS);

export const multiplyMoney = (value: Money, quantity: number): Money => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError('La cantidad debe ser un entero positivo.');
  }

  return {
    amountMinor: value.amountMinor * quantity,
    currency: value.currency,
  };
};

export const sumMoney = (values: readonly Money[]): Money => {
  if (!values.length) return zeroMoney();

  const currency = values[0].currency;
  if (values.some((item) => item.currency !== currency)) {
    throw new TypeError('No se pueden sumar importes de monedas distintas.');
  }

  return {
    amountMinor: values.reduce((total, item) => total + item.amountMinor, 0),
    currency,
  };
};
