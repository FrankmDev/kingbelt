/** Escapa identificadores para selectores CSS generados en build. */
export const escapeCssIdentifier = (value: string): string => {
  if (typeof CSS !== 'undefined' && 'escape' in CSS) {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
};

/** Escapa valores literales entrecomillados en selectores de atributo CSS. */
export const escapeCssAttributeValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Impide que contenido CSS generado cierre el elemento `<style>` contenedor. */
export const escapeStyleElementContent = (value: string): string =>
  value.replace(/</g, '\\3C ').replace(/>/g, '\\3E ');
