export type JsonLdValue =
  | null
  | boolean
  | number
  | string
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

export function serializeJsonLd(value: JsonLdValue): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
