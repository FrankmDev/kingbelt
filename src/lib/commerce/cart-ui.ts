import { setButtonPending } from '../dom/button-state';
import { lockBodyScroll, unlockBodyScroll } from '../dom/scroll-lock';
import {
  CART_DRAWER_OPEN_EVENT,
  changeLineQuantity,
  deleteLine,
  formatLineMeta,
  formatMoney,
  getCart,
  getLineError,
  openCartDrawer,
  subscribeCart,
  startCheckout,
  type CartDrawerEventDetail,
} from './cart-client';
import { getSafeCheckoutUrl } from './checkout';
import type { Cart, CartLine, CartLineError } from './types';

type CartView = 'drawer' | 'page';
type FocusControl = 'decrease' | 'increase' | 'input';

interface PendingFocus {
  view: CartView;
  lineId: string;
  control: FocusControl;
}

const selectors = {
  count: '[data-cart-count]',
  countWrapper: '[data-cart-count-wrapper]',
  drawer: '[data-cart-drawer]',
  drawerOverlay: '[data-cart-drawer-overlay]',
  drawerPanel: '[data-cart-drawer-panel]',
  drawerClose: '[data-cart-drawer-close]',
  drawerOpen: '[data-cart-drawer-open]',
  drawerLines: '[data-cart-drawer-lines]',
  drawerEmpty: '[data-cart-drawer-empty]',
  drawerFooter: '[data-cart-drawer-footer]',
  drawerCount: '[data-cart-drawer-count]',
  drawerSubtotal: '[data-cart-drawer-subtotal]',
  drawerStatus: '[data-cart-drawer-status]',
  pageRoot: '[data-cart-page]',
  pageLines: '[data-cart-page-lines]',
  pageEmpty: '[data-cart-page-empty]',
  pageSummary: '[data-cart-page-summary]',
  pageCount: '[data-cart-page-count]',
  pageSubtotal: '[data-cart-page-subtotal]',
  pageStatus: '[data-cart-page-status]',
  pageIntro: '[data-cart-page-intro]',
  checkout: '[data-cart-checkout]',
} as const;

let drawerTrigger: HTMLElement | null = null;
let isDrawerOpen = false;
let uiInitialized = false;
let checkoutPending = false;
let pendingFocus: PendingFocus | null = null;

const setText = (selector: string, value: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value;
  });
};

const setHidden = (selector: string, hidden: boolean) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.toggleAttribute('hidden', hidden);
  });
};

const toDomId = (value: string): string => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const createSvgElement = (name: string): SVGElement =>
  document.createElementNS('http://www.w3.org/2000/svg', name);

const getSafeProductHref = (value: string): string => {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol)
      ? `${url.pathname}${url.search}${url.hash}`
      : '/';
  } catch {
    return '/';
  }
};

const getSafeImageSrc = (value: string): string | null => {
  try {
    const url = new URL(value, window.location.origin);
    if (
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && url.origin === window.location.origin))
    ) {
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
};

const createRemoveIcon = (): SVGSVGElement => {
  const svg = createSvgElement('svg') as SVGSVGElement;
  svg.classList.add('cart-line__remove-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  ['M3 6h18', 'M8 6V4h8v2', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M10 11v6', 'M14 11v6']
    .forEach((pathData) => {
      const path = createSvgElement('path');
      path.setAttribute('d', pathData);
      svg.append(path);
    });

  return svg;
};

const createQuantitySelector = (
  line: CartLine,
  view: CartView,
  disabled: boolean,
  error?: CartLineError
): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'qty-selector';
  wrapper.setAttribute('data-qty-selector', line.id);

  const suffix = `${view}-${toDomId(line.id)}`;
  const labelId = `qty-label-${suffix}`;
  const errorId = `cart-line-error-${suffix}`;

  const label = document.createElement('span');
  label.id = labelId;
  label.className = 'sr-only';
  label.textContent = `Cantidad de ${line.product.name}`;

  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.className = 'qty-selector__btn';
  decrease.setAttribute('aria-label', `Reducir cantidad de ${line.product.name}`);
  decrease.setAttribute('data-qty-decrease', line.id);
  decrease.disabled = disabled || line.quantity <= 1;
  const decreaseGlyph = document.createElement('span');
  decreaseGlyph.setAttribute('aria-hidden', 'true');
  decreaseGlyph.textContent = '−';
  decrease.append(decreaseGlyph);

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'qty-selector__input kb-input';
  input.min = '1';
  input.max = String(Math.max(line.availability.maxQuantity, line.quantity));
  input.step = '1';
  input.inputMode = 'numeric';
  input.value = String(line.quantity);
  input.setAttribute('data-qty-input', line.id);
  input.setAttribute('aria-labelledby', labelId);
  input.disabled = disabled;
  if (error && error.severity !== 'notice') {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-errormessage', errorId);
  }

  const increase = document.createElement('button');
  increase.type = 'button';
  increase.className = 'qty-selector__btn';
  increase.setAttribute('aria-label', `Aumentar cantidad de ${line.product.name}`);
  increase.setAttribute('data-qty-increase', line.id);
  increase.disabled = disabled || line.quantity >= line.availability.maxQuantity;
  const increaseGlyph = document.createElement('span');
  increaseGlyph.setAttribute('aria-hidden', 'true');
  increaseGlyph.textContent = '+';
  increase.append(increaseGlyph);

  wrapper.append(label, decrease, input, increase);
  return wrapper;
};

const createLineAlert = (error: CartLineError, id: string): HTMLElement => {
  const alert = document.createElement('p');
  alert.id = id;
  alert.className = error.severity === 'notice'
    ? 'cart-line-alert cart-line-alert--notice'
    : 'cart-line-alert';
  alert.setAttribute('role', error.severity === 'notice' ? 'status' : 'alert');
  alert.textContent = error.message;
  return alert;
};

const createLineElement = (
  cart: Cart,
  line: CartLine,
  view: CartView,
  updating: boolean
): HTMLElement => {
  const article = document.createElement('article');
  article.className = `cart-line cart-line--${view}`;
  article.setAttribute('data-cart-line', line.id);
  article.toggleAttribute('aria-busy', updating);

  const media = document.createElement('div');
  media.className = 'cart-line__media';

  const safeImageSrc = line.product.image?.src
    ? getSafeImageSrc(line.product.image.src)
    : null;

  if (line.product.image && safeImageSrc) {
    const image = document.createElement('img');
    image.src = safeImageSrc;
    image.alt = line.product.image.alt;
    image.width = 120;
    image.height = 150;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (line.product.image.position) image.style.objectPosition = line.product.image.position;
    media.append(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'cart-line__media-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    media.append(placeholder);
  }

  const body = document.createElement('div');
  body.className = 'cart-line__body';

  const head = document.createElement('div');
  head.className = 'cart-line__head';

  const title = document.createElement('h3');
  title.className = 'cart-line__title';
  const titleLink = document.createElement('a');
  titleLink.href = getSafeProductHref(line.product.href);
  titleLink.textContent = line.product.name;
  title.append(titleLink);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'cart-line__remove';
  removeButton.setAttribute('data-cart-remove', line.id);
  removeButton.setAttribute('aria-label', `Eliminar ${line.product.name} del carrito`);
  removeButton.disabled = updating;
  removeButton.append(createRemoveIcon());

  head.append(title, removeButton);

  const meta = document.createElement('p');
  meta.className = 'cart-line__meta kb-meta-label text-king-muted';
  meta.textContent = formatLineMeta(line);

  const reference = document.createElement('p');
  reference.className = 'cart-line__ref kb-code-label text-king-muted';
  reference.textContent = line.product.reference;

  const foot = document.createElement('div');
  foot.className = 'cart-line__foot';
  const lineError = getLineError(cart, line.id);
  foot.append(createQuantitySelector(line, view, updating, lineError));

  const prices = document.createElement('div');
  prices.className = 'cart-line__prices';
  const unitPrice = document.createElement('span');
  unitPrice.className = 'cart-line__unit kb-meta-label text-king-muted';
  unitPrice.textContent = formatMoney(line.product.unitPrice);
  const lineTotal = document.createElement('span');
  lineTotal.className = 'cart-line__total font-display';
  lineTotal.textContent = formatMoney(line.lineTotal);
  prices.append(unitPrice, lineTotal);
  foot.append(prices);

  body.append(head, meta, reference, foot);
  if (lineError) {
    body.append(createLineAlert(lineError, `cart-line-error-${view}-${toDomId(line.id)}`));
  }

  if (updating) article.setAttribute('data-updating', 'true');
  article.append(media, body);
  return article;
};

const renderLines = (container: HTMLElement | null, cart: Cart, view: CartView) => {
  if (!container) return;

  container.replaceChildren();
  const updating = cart.status === 'updating' || checkoutPending;
  container.toggleAttribute('aria-busy', updating);
  cart.lines.forEach((line) => container.append(createLineElement(cart, line, view, updating)));
};

const setStatusMessage = (
  target: HTMLElement | null,
  message: string,
  persistent = false,
  isError = false
) => {
  if (!target) return;
  target.textContent = message;
  target.removeAttribute('hidden');
  target.toggleAttribute('data-persistent-message', persistent);
  target.toggleAttribute('data-status-error', isError);
};

const clearStatusMessage = (target: HTMLElement | null) => {
  if (!target) return;
  target.textContent = '';
  target.setAttribute('hidden', '');
  target.removeAttribute('data-persistent-message');
  target.removeAttribute('data-status-error');
};

const updateCheckoutButtons = (cart: Cart) => {
  const disabled = checkoutPending || cart.status !== 'idle' || !cart.canCheckout;
  document.querySelectorAll<HTMLButtonElement>(selectors.checkout).forEach((button) => {
    setButtonPending(button, checkoutPending);
    button.disabled = disabled;
    button.classList.toggle('kb-btn-disabled', disabled && !checkoutPending);
  });
};

const restorePendingFocus = (cart: Cart) => {
  if (!pendingFocus || cart.status !== 'idle') return;

  const { view, lineId, control } = pendingFocus;
  const root = document.querySelector<HTMLElement>(
    view === 'drawer' ? selectors.drawerPanel : selectors.pageRoot
  );
  const attribute = `data-qty-${control}`;
  const target = Array.from(root?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [])
    .find((element) => element.getAttribute(attribute) === lineId);

  pendingFocus = null;
  requestAnimationFrame(() => target?.focus());
};

const renderStatus = (selector: string, cart: Cart) => {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;
  if (target.hasAttribute('data-persistent-message') && cart.status === 'idle') return;
  if (target.hasAttribute('data-persistent-message')) clearStatusMessage(target);

  if (cart.globalError) {
    setStatusMessage(target, cart.globalError, false, true);
  } else if (cart.status === 'recovering') {
    setStatusMessage(target, 'Recuperando carrito…');
  } else if (cart.status === 'updating') {
    setStatusMessage(target, 'Actualizando carrito…');
  } else {
    clearStatusMessage(target);
  }
};

const renderCart = (cart: Cart) => {
  const countLabel = cart.itemCount > 99 ? '99+' : cart.itemCount > 0 ? String(cart.itemCount) : '';
  const countText = cart.itemCount === 1 ? '1 artículo' : `${cart.itemCount} artículos`;

  document.querySelectorAll<HTMLElement>(selectors.count).forEach((node) => {
    node.textContent = countLabel;
    node.setAttribute('aria-hidden', cart.itemCount > 0 ? 'false' : 'true');
  });

  document.querySelectorAll<HTMLElement>(selectors.countWrapper).forEach((node) => {
    node.setAttribute(
      'aria-label',
      cart.itemCount > 0
        ? `Carrito, ${cart.itemCount} ${cart.itemCount === 1 ? 'artículo' : 'artículos'}`
        : 'Carrito vacío'
    );
  });

  const hasLines = cart.lines.length > 0;
  setText(selectors.drawerCount, countText);
  setText(selectors.pageCount, countText);
  setText(selectors.pageIntro, countText);
  setText(selectors.drawerSubtotal, formatMoney(cart.subtotal));
  setText(selectors.pageSubtotal, formatMoney(cart.subtotal));
  setHidden(selectors.drawerEmpty, hasLines);
  setHidden(selectors.pageEmpty, hasLines);
  setHidden(selectors.drawerFooter, !hasLines);
  setHidden(selectors.pageSummary, !hasLines);
  setHidden(selectors.drawerLines, !hasLines);
  setHidden(selectors.pageLines, !hasLines);

  renderStatus(selectors.drawerStatus, cart);
  renderStatus(selectors.pageStatus, cart);
  renderLines(document.querySelector<HTMLElement>(selectors.drawerLines), cart, 'drawer');
  renderLines(document.querySelector<HTMLElement>(selectors.pageLines), cart, 'page');
  updateCheckoutButtons(cart);
  restorePendingFocus(cart);
};

const trapDrawerFocus = (event: KeyboardEvent) => {
  if (!isDrawerOpen || event.key !== 'Tab') return;

  const panel = document.querySelector<HTMLElement>(selectors.drawerPanel);
  if (!panel) return;
  const focusable = Array.from(
    panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const openDrawer = () => {
  const drawer = document.querySelector<HTMLElement>(selectors.drawer);
  if (!drawer || isDrawerOpen) return;

  isDrawerOpen = true;
  drawer.setAttribute('data-open', 'true');
  drawer.removeAttribute('aria-hidden');
  drawer.removeAttribute('inert');
  lockBodyScroll('cart-drawer');

  const closeButton = drawer.querySelector<HTMLElement>(selectors.drawerClose);
  requestAnimationFrame(() => closeButton?.focus());
};

const closeDrawer = () => {
  const drawer = document.querySelector<HTMLElement>(selectors.drawer);
  if (!drawer || !isDrawerOpen) return;

  isDrawerOpen = false;
  drawer.removeAttribute('data-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('inert', '');
  unlockBodyScroll('cart-drawer');

  const trigger = drawerTrigger;
  drawerTrigger = null;
  requestAnimationFrame(() => trigger?.focus());
};

const getView = (element: Element): CartView =>
  element.closest(selectors.drawerPanel) ? 'drawer' : 'page';

const getStatusTarget = (view: CartView): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    view === 'drawer' ? selectors.drawerStatus : selectors.pageStatus
  );

const handleQuantityAction = async (
  lineId: string,
  nextQuantity: number,
  view: CartView,
  control: FocusControl
) => {
  const statusTarget = getStatusTarget(view);
  clearStatusMessage(statusTarget);
  pendingFocus = { view, lineId, control };
  const result = await changeLineQuantity(lineId, nextQuantity);

  if (!result.success && result.error) {
    setStatusMessage(statusTarget, result.error.message, true, true);
  } else if (result.notice) {
    setStatusMessage(statusTarget, result.notice.message, true);
  }
};

const bindCartInteractions = () => {
  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const openTrigger = target.closest<HTMLElement>(selectors.drawerOpen);
    if (openTrigger) {
      event.preventDefault();
      openCartDrawer(openTrigger);
      return;
    }

    if (target.closest(selectors.drawerClose)) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (target.closest(selectors.drawerOverlay) && isDrawerOpen) {
      closeDrawer();
      return;
    }

    const decrease = target.closest<HTMLElement>('[data-qty-decrease]');
    if (decrease) {
      const lineId = decrease.getAttribute('data-qty-decrease');
      const line = getCart().lines.find((item) => item.id === lineId);
      if (lineId && line) {
        await handleQuantityAction(lineId, line.quantity - 1, getView(decrease), 'decrease');
      }
      return;
    }

    const increase = target.closest<HTMLElement>('[data-qty-increase]');
    if (increase) {
      const lineId = increase.getAttribute('data-qty-increase');
      const line = getCart().lines.find((item) => item.id === lineId);
      if (lineId && line) {
        await handleQuantityAction(lineId, line.quantity + 1, getView(increase), 'increase');
      }
      return;
    }

    const remove = target.closest<HTMLElement>('[data-cart-remove]');
    if (remove) {
      const lineId = remove.getAttribute('data-cart-remove');
      const view = getView(remove);
      const statusTarget = getStatusTarget(view);
      if (!lineId) return;

      clearStatusMessage(statusTarget);
      const result = await deleteLine(lineId);
      if (!result.success && result.error) {
        setStatusMessage(statusTarget, result.error.message, true, true);
      } else if (result.notice) {
        setStatusMessage(statusTarget, result.notice.message, true);
        requestAnimationFrame(() => statusTarget?.focus());
      }
      return;
    }

    const checkout = target.closest<HTMLButtonElement>(selectors.checkout);
    if (checkout) {
      event.preventDefault();
      if (checkoutPending || !getCart().canCheckout) return;

      const view = getView(checkout);
      const statusTarget = getStatusTarget(view);
      checkoutPending = true;
      renderCart(getCart());
      setStatusMessage(statusTarget, 'Preparando checkout…');

      const result = await startCheckout();
      const safeUrl = getSafeCheckoutUrl(result);
      checkoutPending = false;
      renderCart(getCart());

      if (safeUrl) {
        window.location.assign(safeUrl.href);
      } else if (result.url) {
        setStatusMessage(statusTarget, 'La URL de checkout recibida no es segura.', true, true);
      } else {
        setStatusMessage(
          statusTarget,
          result.message ?? 'Checkout no disponible.',
          true,
          result.status === 'error'
        );
      }
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-qty-input]')) return;

    const lineId = target.getAttribute('data-qty-input');
    const line = getCart().lines.find((item) => item.id === lineId);
    const quantity = target.valueAsNumber;
    const view = getView(target);

    if (!lineId || !line) return;
    if (!Number.isInteger(quantity) || quantity < 1) {
      target.value = String(line.quantity);
      setStatusMessage(getStatusTarget(view), 'Introduce una cantidad válida.', true, true);
      return;
    }

    void handleQuantityAction(lineId, quantity, view, 'input');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDrawerOpen) {
      event.preventDefault();
      closeDrawer();
    }
    trapDrawerFocus(event);
  });

  document.addEventListener(CART_DRAWER_OPEN_EVENT, (event) => {
    const detail = (event as CustomEvent<CartDrawerEventDetail>).detail;
    drawerTrigger = detail?.trigger ?? null;
    openDrawer();
  });
};

export const initCartUi = () => {
  if (uiInitialized) return;
  uiInitialized = true;
  bindCartInteractions();
  subscribeCart(renderCart);
};
