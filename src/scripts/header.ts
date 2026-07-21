import { CART_DRAWER_OPEN_EVENT } from '../lib/commerce/cart-client';
import { lockBodyScroll, unlockBodyScroll } from '../lib/dom/scroll-lock';

type Cleanup = () => void;

export function initHeader(header: HTMLElement): Cleanup {
  if (header.dataset.headerInitialized === 'true') return () => {};

  const menuToggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menuId = menuToggle?.getAttribute('aria-controls');
  const mobileMenu = menuId ? document.getElementById(menuId) : null;
  if (!menuToggle || !mobileMenu) return () => {};

  header.dataset.headerInitialized = 'true';

  const controller = new AbortController();
  const { signal } = controller;
  const desktop = window.matchMedia('(min-width: 64rem)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const initialTheme = header.dataset.initialTheme ?? 'dark';
  const scrolledTheme = header.dataset.scrolledTheme ?? 'light';
  const threshold = Number(header.dataset.compactThreshold ?? 72);
  let frame = 0;
  let focusTimer = 0;
  let lastProgress = '';
  let lastTheme = header.dataset.theme ?? '';
  let lastScrolled = header.dataset.scrolled ?? '';

  const isMenuOpen = () => header.dataset.menuOpen === 'true';

  const closeMenu = ({ restoreFocus = true } = {}) => {
    if (!isMenuOpen()) return;

    if (focusTimer) {
      window.clearTimeout(focusTimer);
      focusTimer = 0;
    }

    header.dataset.menuOpen = 'false';
    mobileMenu.dataset.open = 'false';
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.setAttribute('inert', '');
    unlockBodyScroll('mobile-navigation');
    if (restoreFocus) menuToggle.focus();
  };

  const openMenu = () => {
    if (isMenuOpen()) return;

    header.dataset.menuOpen = 'true';
    mobileMenu.dataset.open = 'true';
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Cerrar menú');
    mobileMenu.setAttribute('aria-hidden', 'false');
    mobileMenu.removeAttribute('inert');
    lockBodyScroll('mobile-navigation');

    const focusDelay = reducedMotion.matches ? 0 : 400;
    focusTimer = window.setTimeout(() => {
      focusTimer = 0;
      mobileMenu.querySelector<HTMLElement>('[data-mobile-nav-link]')?.focus();
    }, focusDelay);
  };

  const updateHeader = () => {
    frame = 0;
    const scrollY = window.scrollY;
    const progress = Math.min(scrollY / 180, 1).toFixed(3);
    const scrolled = scrollY > threshold;
    const scrolledValue = String(scrolled);
    const theme = scrolled ? scrolledTheme : initialTheme;

    if (progress !== lastProgress) {
      header.style.setProperty('--scroll-progress', progress);
      lastProgress = progress;
    }
    if (theme !== lastTheme) {
      header.dataset.theme = theme;
      lastTheme = theme;
    }
    if (scrolledValue !== lastScrolled) {
      header.dataset.scrolled = scrolledValue;
      lastScrolled = scrolledValue;
    }
    if (desktop.matches) closeMenu({ restoreFocus: false });
  };

  const scheduleHeader = () => {
    if (!frame) frame = requestAnimationFrame(updateHeader);
  };

  menuToggle.addEventListener(
    'click',
    () => (isMenuOpen() ? closeMenu() : openMenu()),
    { signal }
  );

  mobileMenu.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        closeMenu({ restoreFocus: false });
      }
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (!isMenuOpen()) return;

      if (event.key === 'Escape') {
        closeMenu();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        mobileMenu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal }
  );

  document.addEventListener(
    CART_DRAWER_OPEN_EVENT,
    () => closeMenu({ restoreFocus: false }),
    { signal }
  );
  window.addEventListener('scroll', scheduleHeader, { passive: true, signal });
  window.addEventListener('resize', scheduleHeader, { passive: true, signal });
  desktop.addEventListener('change', scheduleHeader);
  updateHeader();

  return () => {
    controller.abort();
    desktop.removeEventListener('change', scheduleHeader);
    if (frame) cancelAnimationFrame(frame);
    if (focusTimer) window.clearTimeout(focusTimer);
    closeMenu({ restoreFocus: false });
    delete header.dataset.headerInitialized;
  };
}
