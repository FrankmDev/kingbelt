/** Contrato DOM del carrito compartido entre cabecera y scripts de comercio. */
export const CART_DRAWER_OPEN_EVENT = 'kb:cart:drawer-open';

export interface CartDrawerEventDetail {
  trigger: HTMLElement | null;
}
