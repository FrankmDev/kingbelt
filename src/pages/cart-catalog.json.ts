import type { APIRoute } from 'astro';
import { catalogProvider } from '@commerce/catalog';
import { toCartCatalogSnapshot } from '@commerce/application/cart-catalog';
import type { Product } from '@commerce/domain/catalog';

// SSR: el carrito demo lee siempre el catálogo vigente (caché breve incluida),
// sin depender de rebuilds para reflejar cambios de Shopify.
export const prerender = false;

export const GET: APIRoute = async () => {
  const [handles, collections] = await Promise.all([
    catalogProvider.getProductHandles(),
    catalogProvider.getCollections(),
  ]);
  const products = (
    await Promise.all(handles.map((handle) => catalogProvider.getProductByHandle(handle)))
  ).filter((product): product is Product => Boolean(product));

  return new Response(JSON.stringify(toCartCatalogSnapshot(products, collections)), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
