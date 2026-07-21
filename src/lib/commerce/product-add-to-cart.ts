import { setButtonPending } from '../dom/button-state';
import { addProductToCart, openCartDrawer } from './cart-client';

type FieldName = 'color' | 'size' | 'quantity';

const fieldSelectors: Record<FieldName, string> = {
  color: '[data-product-color]',
  size: '[data-product-size]',
  quantity: '[data-product-quantity]',
};

const bindProductAddForm = (form: HTMLFormElement): void => {
  if (form.dataset.cartBound === 'true') return;

  const productId = form.dataset.productId?.trim();
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-product-submit]');
  const drawerWrap = form.querySelector<HTMLElement>('[data-product-drawer-wrap]');
  const feedback = form.querySelector<HTMLElement>('[data-product-feedback]');
  const qtyInput = form.querySelector<HTMLInputElement>('[data-product-quantity]');
  const decreaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-decrease]');
  const increaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-increase]');
  const initiallyDisabled = submitBtn?.disabled ?? false;
  let submitting = false;

  if (!productId || !submitBtn || !qtyInput) return;
  form.dataset.cartBound = 'true';

  const setFieldError = (field: FieldName, message?: string) => {
    const node = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    const inputs = form.querySelectorAll<HTMLInputElement>(fieldSelectors[field]);
    if (!node) return;

    inputs.forEach((input) => {
      input.toggleAttribute('aria-invalid', Boolean(message));
      if (message) input.setAttribute('aria-errormessage', node.id);
      else input.removeAttribute('aria-errormessage');
    });

    node.textContent = message ?? '';
    node.toggleAttribute('hidden', !message);
  };

  const clearErrors = () => {
    (Object.keys(fieldSelectors) as FieldName[]).forEach((field) => setFieldError(field));
  };

  const setFeedback = (message: string, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
    feedback.toggleAttribute('hidden', !message);
  };

  const getSelected = (selector: string) =>
    form.querySelector<HTMLInputElement>(`${selector}:checked`)?.value.trim() ?? '';

  const syncQuantityControls = () => {
    if (initiallyDisabled) {
      qtyInput.disabled = true;
      decreaseBtn?.setAttribute('disabled', '');
      increaseBtn?.setAttribute('disabled', '');
      return;
    }

    const value = qtyInput.valueAsNumber;
    const min = Number(qtyInput.min) || 1;
    const max = Number(qtyInput.max) || 99;
    const validValue = Number.isInteger(value) ? value : min;

    decreaseBtn?.toggleAttribute('disabled', submitting || validValue <= min);
    increaseBtn?.toggleAttribute('disabled', submitting || validValue >= max);
  };

  const setSubmitting = (active: boolean) => {
    submitting = active;
    setButtonPending(submitBtn, active);
    if (!active) submitBtn.disabled = initiallyDisabled;
    qtyInput.disabled = active;
    form.querySelectorAll<HTMLInputElement>('[data-product-color], [data-product-size]')
      .forEach((input) => {
        input.disabled = active || input.dataset.initiallyDisabled === 'true';
      });
    syncQuantityControls();
  };

  form.querySelectorAll<HTMLInputElement>('[data-product-color], [data-product-size]')
    .forEach((input) => {
      input.dataset.initiallyDisabled = String(input.disabled);
      input.addEventListener('change', () => {
        const field: FieldName = input.hasAttribute('data-product-color') ? 'color' : 'size';
        setFieldError(field);
        setFeedback('');
      });
    });

  decreaseBtn?.addEventListener('click', () => {
    const current = qtyInput.valueAsNumber || 1;
    qtyInput.value = String(Math.max(1, current - 1));
    setFieldError('quantity');
    syncQuantityControls();
  });

  increaseBtn?.addEventListener('click', () => {
    const current = qtyInput.valueAsNumber || 1;
    const max = Number(qtyInput.max) || 99;
    qtyInput.value = String(Math.min(max, current + 1));
    setFieldError('quantity');
    syncQuantityControls();
  });

  qtyInput.addEventListener('input', () => {
    setFieldError('quantity');
    setFeedback('');
    syncQuantityControls();
  });

  drawerWrap
    ?.querySelector<HTMLButtonElement>('[data-product-open-drawer]')
    ?.addEventListener('click', (event) => openCartDrawer(event.currentTarget as HTMLButtonElement));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || initiallyDisabled) return;

    clearErrors();
    setFeedback('');

    const color = getSelected('[data-product-color]');
    const size = getSelected('[data-product-size]');
    const quantity = qtyInput.valueAsNumber;

    if (!color) setFieldError('color', 'Selecciona un color.');
    if (!size) setFieldError('size', 'Selecciona una talla.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setFieldError('quantity', 'La cantidad debe estar entre 1 y 99.');
    }

    if (!color || !size || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setFeedback('Revisa las opciones antes de añadir el producto.', true);
      return;
    }

    setSubmitting(true);

    try {
      const result = await addProductToCart({ productId, color, size, quantity });

      if (!result.success && result.error) {
        if (result.error.field) setFieldError(result.error.field, result.error.message);
        setFeedback(result.error.message, true);
        return;
      }

      setFeedback('Producto añadido al carrito.');
      drawerWrap?.removeAttribute('hidden');
      openCartDrawer(submitBtn);
    } finally {
      setSubmitting(false);
    }
  });

  syncQuantityControls();
};

export const initProductAddForms = (): void => {
  document
    .querySelectorAll<HTMLFormElement>('[data-product-add-form]')
    .forEach(bindProductAddForm);
};
