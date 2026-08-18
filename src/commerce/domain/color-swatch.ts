const normalizeColorLabel = (label: string): string =>
  label
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const CANONICAL_SWATCHES = {
  cuero: '#54332F',
  marron: '#372E2E',
  negro: '#0B0A07',
  marino: '#131B23',
  taupe: '#80685D',
} as const;

const isHexOrGradient = (value: string): boolean =>
  /^#[0-9a-f]{3,8}$/i.test(value) || /^linear-gradient\([^;{}]+\)$/i.test(value);

const canonicalFromLabel = (label: string): string | undefined => {
  const normalized = normalizeColorLabel(label);
  const direct = CANONICAL_SWATCHES[normalized as keyof typeof CANONICAL_SWATCHES];
  if (direct) return direct;

  if (normalized.includes('tricolor')) {
    return `linear-gradient(135deg, ${CANONICAL_SWATCHES.marron} 0 68%, #aa151b 68% 78%, #f1bf00 78% 90%, #aa151b 90%)`;
  }

  if (normalized.includes('acero') && normalized.includes('negro')) {
    return `linear-gradient(135deg, ${CANONICAL_SWATCHES.negro} 50%, #7b7d78 50%)`;
  }

  if (normalized.includes('negro') && normalized.includes('marron')) {
    return `linear-gradient(135deg, ${CANONICAL_SWATCHES.negro} 50%, ${CANONICAL_SWATCHES.marron} 50%)`;
  }

  if (normalized.includes('marino')) return CANONICAL_SWATCHES.marino;
  if (normalized.includes('taupe')) return CANONICAL_SWATCHES.taupe;
  if (normalized.includes('cuero')) return CANONICAL_SWATCHES.cuero;
  if (normalized.includes('negro')) return CANONICAL_SWATCHES.negro;
  if (normalized.includes('marron')) return CANONICAL_SWATCHES.marron;
  if (normalized.includes('conac')) return CANONICAL_SWATCHES.taupe;

  return undefined;
};

/** Resuelve la muestra visual de un color de producto a partir de su etiqueta comercial. */
export const resolveColorSwatch = (label: string, source?: string): string => {
  const canonical = canonicalFromLabel(label);
  if (canonical) return canonical;
  if (source && isHexOrGradient(source)) return source;
  return CANONICAL_SWATCHES.cuero;
};
