import { getSafeCheckoutUrl } from '@commerce/application/checkout-redirect';
import { CART_DRAWER_OPEN_EVENT, type CartDrawerEventDetail } from '@shared/browser/cart-events';
import { lockBodyScroll, unlockBodyScroll } from '@shared/browser/scroll-lock';
import {
  changeLineQuantity,
  deleteLine,
  getCart,
  openCartDrawer,
  startCheckout,
} from './cart-store';
import {
  cartSelectors,
  type CartView,
} from './cart-ui';
import {
  clearCartStatusMessage,
  setCartStatusMessage,
} from './cart-status';

type FocusControl = 'decrease' | 'increase' | 'input';

let controllerInitialized = false;
let drawerTrigger: HTMLElement | null = null;
let isDrawerOpen = false;
const outsideInertState = new Map<HTMLElement, boolean>();

const getView = (element: Element): CartView =>
  element.closest(cartSelectors.drawerPanel) ? 'drawer' : 'page';

const getStatusTarget = (view: CartView): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    view === 'drawer' ? cartSelectors.drawerStatus : cartSelectors.pageStatus
  );

const setDrawerTriggersExpanded = (expanded: boolean) => {
  document.querySelectorAll<HTMLElement>(cartSelectors.drawerOpen).forEach((trigger) => {
    trigger.setAttribute('aria-expanded', String(expanded));
  });
};

const setOutsideInert = (drawer: HTMLElement, inert: boolean) => {
  if (inert) {
    outsideInertState.clear();
    Array.from(document.body.children).forEach((element) => {
      if (!(element instanceof HTMLElement) || element === drawer || element.contains(drawer)) return;
      outsideInertState.set(element, element.inert);
      element.inert = true;
    });
    return;
  }

  outsideInertState.forEach((wasInert, element) => {
    if (element.isConnected) element.inert = wasInert;
  });
  outsideInertState.clear();
};

const getFocusableElements = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

const trapDrawerFocus = (event: KeyboardEvent) => {
  if (!isDrawerOpen || event.key !== 'Tab') return;
  const panel = document.querySelector<HTMLElement>(cartSelectors.drawerPanel);
  if (!panel) return;
  const focusable = getFocusableElements(panel);
  if (!focusable.length) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
};

const openDrawer = () => {
  const drawer = document.querySelector<HTMLElement>(cartSelectors.drawer);
  if (!drawer || isDrawerOpen) return;

  isDrawerOpen = true;
  drawer.setAttribute('data-open', 'true');
  drawer.removeAttribute('aria-hidden');
  drawer.inert = false;
  setOutsideInert(drawer, true);
  setDrawerTriggersExpanded(true);
  lockBodyScroll('cart-drawer');

  const closeButton = drawer.querySelector<HTMLElement>(cartSelectors.drawerClose);
  requestAnimationFrame(() => closeButton?.focus());
};

const closeDrawer = () => {
  const drawer = document.querySelector<HTMLElement>(cartSelectors.drawer);
  if (!drawer || !isDrawerOpen) return;

  isDrawerOpen = false;
  drawer.removeAttribute('data-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  setOutsideInert(drawer, false);
  setDrawerTriggersExpanded(false);
  unlockBodyScroll('cart-drawer');

  const trigger = drawerTrigger;
  drawerTrigger = null;
  requestAnimationFrame(() => {
    if (trigger?.isConnected) trigger.focus();
  });
};

const restoreLineFocus = (
  view: CartView,
  lineId: string | null,
  preferredControl: FocusControl | 'remove' = 'decrease'
) => {
  const root = document.querySelector<HTMLElement>(
    view === 'drawer' ? cartSelectors.drawerPanel : cartSelectors.pageRoot
  );
  if (!root) return;

  const lines = [...root.querySelectorAll<HTMLElement>('[data-cart-line]')];
  const lineIndex = lineId ? lines.findIndex((line) => line.dataset.cartLine === lineId) : -1;
  const targetLine = lineIndex >= 0
    ? lines[lineIndex]
    : lines[Math.min(Math.max(lineIndex, 0), Math.max(lines.length - 1, 0))];

  const attribute = preferredControl === 'remove'
    ? 'data-cart-remove'
    : `data-qty-${preferredControl}`;
  const selector = preferredControl === 'remove'
    ? `[${attribute}]`
    : `[${attribute}="${lineId ?? ''}"]`;
  const focusTarget = targetLine?.querySelector<HTMLElement>(selector)
    ?? lines[0]?.querySelector<HTMLElement>('[data-cart-remove], [data-qty-decrease]');
  requestAnimationFrame(() => focusTarget?.focus());
};

const restoreQuantityFocus = (
  view: CartView,
  lineId: string,
  control: FocusControl
) => restoreLineFocus(view, lineId, control);

const handleQuantityAction = async (
  lineId: string,
  nextQuantity: number,
  view: CartView,
  control: FocusControl
) => {
  const statusTarget = getStatusTarget(view);
  clearCartStatusMessage(statusTarget);
  const result = await changeLineQuantity(lineId, nextQuantity);

  if (!result.success && result.error) {
    setCartStatusMessage(statusTarget, result.error.message, true, true);
  } else if (result.notice) {
    setCartStatusMessage(statusTarget, result.notice.message, true);
  }
  if (result.cart.lines.some((line) => line.id === lineId)) {
    restoreQuantityFocus(view, lineId, control);
  }
};

const bindCartInteractions = () => {
  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const openTrigger = target.closest<HTMLElement>(cartSelectors.drawerOpen);
    if (openTrigger) {
      event.preventDefault();
      openCartDrawer(openTrigger);
      return;
    }

    if (target.closest(cartSelectors.drawerClose)) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (target.closest(cartSelectors.drawerOverlay) && isDrawerOpen) {
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

      const linesRoot = document.querySelector<HTMLElement>(
        view === 'drawer' ? cartSelectors.drawerLines : cartSelectors.pageLines
      );
      const removedIndex = [...(linesRoot?.querySelectorAll('[data-cart-line]') ?? [])]
        .findIndex((line) => line instanceof HTMLElement && line.dataset.cartLine === lineId);

      clearCartStatusMessage(statusTarget);
      const result = await deleteLine(lineId);
      if (!result.success && result.error) {
        setCartStatusMessage(statusTarget, result.error.message, true, true);
        requestAnimationFrame(() => statusTarget?.focus());
      } else if (result.notice) {
        setCartStatusMessage(statusTarget, result.notice.message, true);
        if (result.cart.lines.length > 0) {
          const nextLine = result.cart.lines[Math.min(removedIndex, result.cart.lines.length - 1)];
          restoreLineFocus(view, nextLine?.id ?? null, 'remove');
        } else {
          requestAnimationFrame(() => statusTarget?.focus());
        }
      }
      return;
    }

    const checkout = target.closest<HTMLButtonElement>(cartSelectors.checkout);
    if (!checkout) return;
    event.preventDefault();
    if (getCart().status !== 'idle' || !getCart().canCheckout) return;

    const view = getView(checkout);
    const statusTarget = getStatusTarget(view);
    const result = await startCheckout();
    const safeUrl = getSafeCheckoutUrl(result);
    if (safeUrl) {
      window.location.assign(safeUrl.href);
      return;
    }

    if (result.url) {
      setCartStatusMessage(statusTarget, 'La URL de checkout recibida no es segura.', true, true);
      requestAnimationFrame(() => statusTarget?.focus());
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
      setCartStatusMessage(getStatusTarget(view), 'Introduce una cantidad válida.', true, true);
      return;
    }
    void handleQuantityAction(lineId, quantity, view, 'input');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDrawerOpen) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    trapDrawerFocus(event);
  });

  document.addEventListener(CART_DRAWER_OPEN_EVENT, (event) => {
    const detail = (event as CustomEvent<CartDrawerEventDetail>).detail;
    if (!isDrawerOpen) drawerTrigger = detail?.trigger ?? null;
    openDrawer();
  });

  window.addEventListener('pagehide', () => {
    if (isDrawerOpen) closeDrawer();
  });
};

export const initCartController = () => {
  if (controllerInitialized) return;
  controllerInitialized = true;
  bindCartInteractions();
  setDrawerTriggersExpanded(false);
};
