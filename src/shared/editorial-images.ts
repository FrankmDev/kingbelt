import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/imagen-cinturon-kingbelt-*.avif',
  { eager: true }
);

const byPublicPath = new Map<string, ImageMetadata>();

for (const [file, loaded] of Object.entries(modules)) {
  const match = file.match(/imagen-cinturon-kingbelt-(\d+)\.avif$/);
  if (!match) continue;
  byPublicPath.set(`/images/imagen-cinturon-kingbelt-${match[1]}.avif`, loaded.default);
}

/** Resuelve una ruta pública editorial al asset procesable por `astro:assets`. */
export const getEditorialAsset = (src: string): ImageMetadata | undefined =>
  byPublicPath.get(src);
