import {
  CHECKOUT_RETURN_PARAM,
  getCheckoutReturnNotice,
  parseCheckoutReturn,
} from '@commerce/application/checkout-return';
import { setCartStatusMessage } from './cart-status';

const params = new URLSearchParams(window.location.search);
const kind = parseCheckoutReturn(params);

if (kind) {
  const target = document.querySelector<HTMLElement>('[data-cart-page-status]');
  setCartStatusMessage(target, getCheckoutReturnNotice(kind), true);
  requestAnimationFrame(() => target?.focus());

  params.delete(CHECKOUT_RETURN_PARAM);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}
