declare const commerceIdentifier: unique symbol;

type Identifier<TKind extends string> = string & {
  readonly [commerceIdentifier]: TKind;
};

export type ProductId = Identifier<'ProductId'>;
export type VariantId = Identifier<'VariantId'>;
export type Sku = Identifier<'Sku'>;

const toIdentifier = <TKind extends string>(
  value: string,
  label: string
): Identifier<TKind> => {
  if (
    value !== value.trim() ||
    value.length === 0 ||
    value.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${label} debe ser un identificador no vacío, sin espacios exteriores ni caracteres de control.`);
  }

  return value as Identifier<TKind>;
};

export const productId = (value: string): ProductId =>
  toIdentifier<'ProductId'>(value, 'El ID de producto');

export const variantId = (value: string): VariantId =>
  toIdentifier<'VariantId'>(value, 'El ID de variante');

export const sku = (value: string): Sku =>
  toIdentifier<'Sku'>(value, 'El SKU');
