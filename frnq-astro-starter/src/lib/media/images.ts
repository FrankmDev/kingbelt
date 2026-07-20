export function imageAlt(alt: string | undefined, decorative = false): string {
  if (decorative) return '';
  if (!alt?.trim()) {
    throw new Error('Informative images require non-empty alt text.');
  }
  return alt.trim();
}
