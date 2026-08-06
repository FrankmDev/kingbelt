let cartReady: Promise<void> | null = null;
let cartBootstrapped = false;

export const ensureCartReady = (): Promise<void> => {
  if (!cartReady) {
    cartReady = import('./init-cart').then(() => {
      cartBootstrapped = true;
    });
  }
  return cartReady;
};

const shouldEagerLoad = (): boolean => {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  return (
    header?.dataset.cartEager === 'true' ||
    Boolean(document.querySelector('[data-cart-page]'))
  );
};

const bindDeferredCartOpen = (): void => {
  document.addEventListener(
    'click',
    (event) => {
      if (cartBootstrapped) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>('[data-cart-drawer-open]');
      if (!trigger) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      void ensureCartReady().then(async () => {
        const { openCartDrawer } = await import('./cart-store');
        openCartDrawer(trigger);
      });
    },
    { capture: true }
  );
};

/** Inicializa el cliente del carrito una sola vez por página. */
export const bootstrapCartClient = (): void => {
  if (shouldEagerLoad()) {
    void ensureCartReady();
    return;
  }

  bindDeferredCartOpen();
};
