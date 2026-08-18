/** Longitud máxima del resumen visible en cards de producto. */
export const PRODUCT_CARD_SUMMARY_MAX = 100;

/**
 * Acorta texto a una longitud máxima, cortando en el último espacio cuando es posible.
 */
export function truncateText(text: string, maxLength: number, ellipsis = '…'): string {
  const normalized = text.trim();
  if (!normalized || normalized.length <= maxLength) return normalized;

  const slice = normalized.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.55 ? slice.slice(0, lastSpace) : slice;

  return `${cut.trimEnd()}${ellipsis}`;
}
