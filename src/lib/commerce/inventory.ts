import { getMaxSelectableQuantity } from './product-variants';
import type { LineAvailability, ProductVariant } from './types';

export const getVariantAvailability = (variant: ProductVariant): LineAvailability => {
  const maxQuantity = getMaxSelectableQuantity(variant);
  const quantityKnown = variant.quantityAvailable !== undefined;

  if (!variant.availableForSale) {
    const outOfStock = variant.quantityAvailable === 0;
    return {
      status: outOfStock ? 'out_of_stock' : 'unavailable',
      maxQuantity: 0,
      quantityKnown,
      message: outOfStock ? 'Producto agotado.' : 'Este producto ya no está disponible.',
    };
  }

  return {
    status: quantityKnown && maxQuantity <= 2 ? 'limited' : 'available',
    maxQuantity,
    quantityKnown,
    message: quantityKnown && maxQuantity <= 2 ? 'Quedan pocas unidades.' : undefined,
  };
};

export const canAddVariantToCart = (variant: ProductVariant, quantity: number): boolean => {
  const availability = getVariantAvailability(variant);
  return (
    (availability.status === 'available' || availability.status === 'limited') &&
    quantity > 0 &&
    quantity <= availability.maxQuantity
  );
};
