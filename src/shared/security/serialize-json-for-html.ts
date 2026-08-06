const HTML_JSON_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '\\u0026',
  '<': '\\u003c',
  '>': '\\u003e',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/** Serializa datos para un bloque JSON inerte sin permitir cerrar su `<script>`. */
export const serializeJsonForHtml = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('El valor no se puede serializar como JSON embebido.');
  }
  return serialized.replace(/[&<>\u2028\u2029]/g, (character) =>
    HTML_JSON_ESCAPE_MAP[character] ?? character
  );
};
