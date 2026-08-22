import { setButtonPending } from '@shared/browser/button-state';
import { publicSecurityConfig } from '@config/security';
import { isAllowedImageUrl } from '@commerce/domain/url-policy';
import { buildThumbnailUrl } from '@shared/image-source';
import {
  formatLineMeta,
  formatMoney,
  getLineError,
  subscribeCart,
} from './cart-store';
import {
  clearCartStatusMessage,
  setCartStatusMessage,
} from './cart-status';
import type { Cart, CartLine, CartLineError } from '@commerce/domain/cart';

export type CartView = 'drawer' | 'page';

export const cartSelectors = {
  count: '[data-cart-count]',
  countWrapper: '[data-cart-count-wrapper]',
  drawer: '[data-cart-drawer]',
  drawerOverlay: '[data-cart-drawer-overlay]',
  drawerPanel: '[data-cart-drawer-panel]',
  drawerClose: '[data-cart-drawer-close]',
  drawerOpen: '[data-cart-drawer-open]',
  drawerLines: '[data-cart-drawer-lines]',
  drawerEmpty: '[data-cart-drawer-empty]',
  drawerRecovery: '[data-cart-drawer-recovery]',
  drawerFooter: '[data-cart-drawer-footer]',
  drawerCount: '[data-cart-drawer-count]',
  drawerSubtotal: '[data-cart-drawer-subtotal]',
  drawerStatus: '[data-cart-drawer-status]',
  pageRoot: '[data-cart-page]',
  pageLines: '[data-cart-page-lines]',
  pageEmpty: '[data-cart-page-empty]',
  pageRecovery: '[data-cart-page-recovery]',
  pageSummary: '[data-cart-page-summary]',
  pageCount: '[data-cart-page-count]',
  pageSubtotal: '[data-cart-page-subtotal]',
  pageStatus: '[data-cart-page-status]',
  pageIntro: '[data-cart-page-intro]',
  checkout: '[data-cart-checkout]',
  reset: '[data-cart-reset]',
} as const;

let uiInitialized = false;

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
  if (!isAllowedImageUrl(value, publicSecurityConfig.remoteImageHosts)) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin || url.protocol === 'https:' ? url.href : null;
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
  const controlsDisabled = disabled || !line.availability.purchasable;
  const disabledReason = !line.availability.purchasable
    ? 'Esta línea no se puede modificar.'
    : '';

  const label = document.createElement('span');
  label.id = labelId;
  label.className = 'sr-only';
  label.textContent = `Cantidad de ${line.product.title}`;

  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.className = 'qty-selector__btn';
  decrease.setAttribute('aria-label', `Reducir cantidad de ${line.product.title}`);
  decrease.setAttribute('data-qty-decrease', line.id);
  decrease.disabled = controlsDisabled || line.quantity <= line.availability.minimum;
  if (decrease.disabled) decrease.title = disabledReason || 'No puedes reducir más la cantidad.';
  const decreaseGlyph = document.createElement('span');
  decreaseGlyph.setAttribute('aria-hidden', 'true');
  decreaseGlyph.textContent = '−';
  decrease.append(decreaseGlyph);

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'qty-selector__input kb-input';
  input.min = String(line.availability.minimum);
  input.max = String(Math.max(line.availability.maxQuantity, line.quantity));
  input.step = String(line.availability.increment);
  input.inputMode = 'numeric';
  input.value = String(line.quantity);
  input.setAttribute('data-qty-input', line.id);
  input.setAttribute('aria-labelledby', labelId);
  input.disabled = controlsDisabled;
  if (error && error.severity !== 'notice') {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-errormessage', errorId);
  }

  const increase = document.createElement('button');
  increase.type = 'button';
  increase.className = 'qty-selector__btn';
  increase.setAttribute('aria-label', `Aumentar cantidad de ${line.product.title}`);
  increase.setAttribute('data-qty-increase', line.id);
  increase.disabled = controlsDisabled || line.quantity >= line.availability.maxQuantity;
  if (increase.disabled) {
    increase.title = disabledReason || 'Has alcanzado la cantidad máxima permitida.';
  }
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

  const safeImageSrc = line.product.image?.url
    ? getSafeImageSrc(line.product.image.url)
    : null;

  if (line.product.image && safeImageSrc) {
    const image = document.createElement('img');
    image.src = buildThumbnailUrl(safeImageSrc);
    image.alt = line.product.image.altText;
    image.width = line.product.image.width;
    image.height = line.product.image.height;
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
  titleLink.textContent = line.product.title;
  title.append(titleLink);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'cart-line__remove';
  removeButton.setAttribute('data-cart-remove', line.id);
  removeButton.setAttribute('aria-label', `Eliminar ${line.product.title} del carrito`);
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
  const updating = cart.status !== 'idle' && cart.status !== 'error';
  container.toggleAttribute('aria-busy', updating);
  cart.lines.forEach((line) => container.append(createLineElement(cart, line, view, updating)));
};

export { clearCartStatusMessage, setCartStatusMessage } from './cart-status';

const updateCheckoutButtons = (cart: Cart) => {
  const pending = cart.status === 'checkout';
  const disabled = cart.status !== 'idle' || !cart.canCheckout;
  const disabledReason = !pending && cart.lines.length > 0 && !cart.canCheckout
    ? 'Revisa los productos marcados antes de finalizar la compra.'
    : '';
  document.querySelectorAll<HTMLButtonElement>(cartSelectors.checkout).forEach((button) => {
    setButtonPending(button, pending);
    button.disabled = disabled;
    button.classList.toggle('kb-btn-disabled', disabled && !pending);
    button.title = disabledReason;
  });
};

const renderStatus = (selector: string, cart: Cart) => {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;
  if (target.hasAttribute('data-persistent-message') && cart.status === 'idle') return;
  if (target.hasAttribute('data-persistent-message')) clearCartStatusMessage(target);

  const hasBlockingLineError = cart.lineErrors.some((error) => error.severity !== 'notice');
  if (cart.recovery === 'reset_required' && cart.status === 'idle') {
    clearCartStatusMessage(target);
  } else if (cart.globalError) {
    setCartStatusMessage(target, cart.globalError, false, true);
  } else if (hasBlockingLineError) {
    setCartStatusMessage(
      target,
      'Revisa los productos marcados antes de finalizar la compra.',
      true,
      true
    );
  } else if (cart.globalNotice) {
    setCartStatusMessage(target, cart.globalNotice, true);
  } else if (cart.status === 'recovering') {
    setCartStatusMessage(target, 'Recuperando carrito…');
  } else if (cart.status === 'updating') {
    setCartStatusMessage(target, 'Actualizando carrito…');
  } else if (cart.status === 'checkout') {
    setCartStatusMessage(target, 'Preparando checkout…');
  } else {
    clearCartStatusMessage(target);
  }
};

export const renderCart = (cart: Cart) => {
  const countLabel = cart.itemCount > 99 ? '99+' : cart.itemCount > 0 ? String(cart.itemCount) : '';
  const countText = cart.itemCount === 1 ? '1 artículo' : `${cart.itemCount} artículos`;
  const busy = cart.status !== 'idle' && cart.status !== 'error';

  document.querySelectorAll<HTMLElement>(cartSelectors.count).forEach((node) => {
    node.textContent = countLabel;
    node.setAttribute('aria-hidden', cart.itemCount > 0 ? 'false' : 'true');
  });

  document.querySelectorAll<HTMLElement>(cartSelectors.countWrapper).forEach((node) => {
    node.setAttribute(
      'aria-label',
      cart.itemCount > 0
        ? `Carrito, ${cart.itemCount} ${cart.itemCount === 1 ? 'artículo' : 'artículos'}`
        : 'Carrito vacío'
    );
  });

  const hasLines = cart.lines.length > 0;
  const requiresReset = cart.recovery === 'reset_required';
  const recoveringEmptyCart = cart.status === 'recovering' && !hasLines;
  document.querySelector<HTMLElement>(cartSelectors.drawerPanel)
    ?.toggleAttribute('aria-busy', busy);
  document.querySelector<HTMLElement>(cartSelectors.pageRoot)
    ?.toggleAttribute('aria-busy', busy);
  setText(cartSelectors.drawerCount, countText);
  setText(cartSelectors.pageCount, countText);
  setText(cartSelectors.pageIntro, countText);
  setText(cartSelectors.drawerSubtotal, formatMoney(cart.subtotal));
  setText(cartSelectors.pageSubtotal, formatMoney(cart.subtotal));
  setHidden(cartSelectors.drawerRecovery, !requiresReset);
  setHidden(cartSelectors.pageRecovery, !requiresReset);
  setHidden(cartSelectors.drawerEmpty, requiresReset || hasLines || recoveringEmptyCart);
  setHidden(cartSelectors.pageEmpty, requiresReset || hasLines || recoveringEmptyCart);
  setHidden(cartSelectors.drawerFooter, requiresReset || !hasLines);
  setHidden(cartSelectors.pageSummary, requiresReset || !hasLines);
  setHidden(cartSelectors.drawerLines, requiresReset || !hasLines);
  setHidden(cartSelectors.pageLines, requiresReset || !hasLines);

  renderStatus(cartSelectors.drawerStatus, cart);
  renderStatus(cartSelectors.pageStatus, cart);
  renderLines(document.querySelector<HTMLElement>(cartSelectors.drawerLines), cart, 'drawer');
  renderLines(document.querySelector<HTMLElement>(cartSelectors.pageLines), cart, 'page');
  updateCheckoutButtons(cart);
};

export const initCartUi = () => {
  if (uiInitialized) return;
  uiInitialized = true;
  subscribeCart(renderCart);
};
