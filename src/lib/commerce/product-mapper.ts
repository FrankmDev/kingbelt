import type { ProductDetail } from '../../data/catalog';
import type { CartProduct } from './types';
import { moneyFromMajor } from './money';

export const toCartProduct = (product: ProductDetail): CartProduct => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  category: product.category,
  reference: product.id.toUpperCase(),
  unitPrice: moneyFromMajor(product.price, product.currency),
  sizeUnit: 'cm',
  image: {
    src: product.image,
    alt: product.imageAlt,
    position: product.imagePosition,
  },
  href: product.href,
});
