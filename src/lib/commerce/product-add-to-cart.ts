import { setButtonPending } from '../dom/button-state';
import { addProductToCart, openCartDrawer } from './cart-client';
import { formatMoney } from './money';
import {
  getCompatibleOptionValues,
  getMaxSelectableQuantity,
  getVariantBySelectedOptions,
  reconcileSelectedOptions,
} from './product-variants';
import type {
  Money,
  ProductImage,
  ProductOption,
  ProductVariant,
  SelectedOption,
} from './types';

interface PublicVariant {
  id: string;
  selectedOptions: SelectedOption[];
  availableForSale: boolean;
  quantityAvailable?: number;
  price: Money;
  compareAtPrice?: Money;
  image?: ProductImage;
}

interface VariantPayload {
  options: ProductOption[];
  variants: PublicVariant[];
}

const parsePayload = (form: HTMLFormElement): VariantPayload | null => {
  const script = form.querySelector<HTMLScriptElement>('[data-product-variants]');
  if (!script?.textContent || script.textContent.length > 500_000) return null;
  try {
    const value: unknown = JSON.parse(script.textContent);
    if (!value || typeof value !== 'object') return null;
    const payload = value as Partial<VariantPayload>;
    if (!Array.isArray(payload.options) || !Array.isArray(payload.variants)) return null;
    return payload as VariantPayload;
  } catch {
    return null;
  }
};

const bindProductAddForm = (form: HTMLFormElement): void => {
  if (form.dataset.cartBound === 'true') return;
  const payload = parsePayload(form);
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-product-submit]');
  const submitLabel = form.querySelector<HTMLElement>('[data-product-submit-label]');
  const drawerWrap = form.querySelector<HTMLElement>('[data-product-drawer-wrap]');
  const feedback = form.querySelector<HTMLElement>('[data-product-feedback]');
  const price = form.querySelector<HTMLElement>('[data-product-price]');
  const compare = form.querySelector<HTMLElement>('[data-product-compare]');
  const qtyInput = form.querySelector<HTMLInputElement>('[data-product-quantity]');
  const decreaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-decrease]');
  const increaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-increase]');
  const optionInputs = [...form.querySelectorAll<HTMLInputElement>('[data-product-option]')];
  if (!payload || !submitBtn || !qtyInput || !optionInputs.length) return;
  form.dataset.cartBound = 'true';
  let submitting = false;
  let selectedVariant: PublicVariant | undefined;

  const setOptionError = (optionName: string, message?: string) => {
    const node = [...form.querySelectorAll<HTMLElement>('[data-error-for-option]')]
      .find((item) => item.dataset.errorForOption === optionName);
    optionInputs.filter((input) => input.dataset.optionName === optionName).forEach((input) => {
      input.toggleAttribute('aria-invalid', Boolean(message));
      if (message && node) input.setAttribute('aria-errormessage', node.id);
      else input.removeAttribute('aria-errormessage');
    });
    if (node) {
      node.textContent = message ?? '';
      node.hidden = !message;
    }
  };

  const setQuantityError = (message?: string) => {
    const node = form.querySelector<HTMLElement>('[data-error-for="quantity"]');
    qtyInput.toggleAttribute('aria-invalid', Boolean(message));
    if (message && node) qtyInput.setAttribute('aria-errormessage', node.id);
    else qtyInput.removeAttribute('aria-errormessage');
    if (node) {
      node.textContent = message ?? '';
      node.hidden = !message;
    }
  };

  const clearErrors = () => {
    payload.options.forEach((option) => setOptionError(option.name));
    setQuantityError();
  };

  const setFeedback = (message: string, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
    feedback.hidden = !message;
  };

  const getSelection = (): SelectedOption[] => payload.options.flatMap((option) => {
    const input = optionInputs.find((candidate) => candidate.dataset.optionName === option.name && candidate.checked);
    return input ? [{ name: option.name, value: input.value }] : [];
  });

  const syncVariantImage = (variant: PublicVariant | undefined) => {
    if (!variant?.image?.url) return;
    const page = form.closest<HTMLElement>('[data-product-page]') ?? document.body;
    const choice = [...page.querySelectorAll<HTMLInputElement>('[data-gallery-image-url]')]
      .find((input) => input.dataset.galleryImageUrl === variant.image?.url);
    if (choice && !choice.checked) {
      choice.checked = true;
      choice.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const syncQuantityControls = () => {
    const max = getMaxSelectableQuantity(selectedVariant as ProductVariant | undefined);
    qtyInput.max = String(Math.max(1, max));
    if (qtyInput.valueAsNumber > max && max > 0) qtyInput.value = String(max);
    const current = Number.isInteger(qtyInput.valueAsNumber) ? qtyInput.valueAsNumber : 1;
    const disabled = submitting || !selectedVariant?.availableForSale;
    qtyInput.disabled = disabled;
    decreaseBtn?.toggleAttribute('disabled', disabled || current <= 1);
    increaseBtn?.toggleAttribute('disabled', disabled || current >= max);
  };

  const syncSelection = (changedOptionName?: string) => {
    let selection = getSelection();
    if (changedOptionName) {
      selection = reconcileSelectedOptions(payload, selection, changedOptionName);
      optionInputs.forEach((input) => {
        if (input.dataset.optionName !== changedOptionName && input.checked) {
          input.checked = selection.some((selected) =>
            selected.name === input.dataset.optionName && selected.value === input.value
          );
        }
      });
    }

    selection = getSelection();
    optionInputs.forEach((input) => {
      const optionName = input.dataset.optionName ?? '';
      const optionIndex = payload.options.findIndex((option) => option.name === optionName);
      const upstreamSelection = selection.filter((selected) =>
        payload.options.findIndex((option) => option.name === selected.name) < optionIndex
      );
      const compatible = getCompatibleOptionValues(payload, upstreamSelection, optionName).includes(input.value);
      input.disabled = submitting || !compatible;
      input.closest('label')?.toggleAttribute('data-impossible', !compatible);
    });

    selectedVariant = getVariantBySelectedOptions(payload, selection) as PublicVariant | undefined;
    const complete = selection.length === payload.options.length;
    if (selectedVariant) {
      if (price) price.textContent = formatMoney(selectedVariant.price);
      if (compare) {
        compare.textContent = selectedVariant.compareAtPrice ? formatMoney(selectedVariant.compareAtPrice) : '';
        compare.hidden = !selectedVariant.compareAtPrice;
      }
      syncVariantImage(selectedVariant);
    }

    submitBtn.disabled = submitting || !selectedVariant?.availableForSale;
    if (submitLabel) {
      submitLabel.textContent = !complete
        ? 'Elige las opciones'
        : selectedVariant?.availableForSale
          ? 'Añadir al carrito'
          : selectedVariant
            ? 'Agotado'
            : 'Combinación no disponible';
    }
    syncQuantityControls();
  };

  const setSubmitting = (active: boolean) => {
    submitting = active;
    setButtonPending(submitBtn, active);
    syncSelection();
  };

  optionInputs.forEach((input) => input.addEventListener('change', () => {
    const optionName = input.dataset.optionName ?? '';
    setOptionError(optionName);
    setFeedback('');
    syncSelection(optionName);
  }));

  decreaseBtn?.addEventListener('click', () => {
    qtyInput.value = String(Math.max(1, (qtyInput.valueAsNumber || 1) - 1));
    setQuantityError();
    syncQuantityControls();
  });
  increaseBtn?.addEventListener('click', () => {
    const max = Number(qtyInput.max) || 99;
    qtyInput.value = String(Math.min(max, (qtyInput.valueAsNumber || 1) + 1));
    setQuantityError();
    syncQuantityControls();
  });
  qtyInput.addEventListener('input', () => {
    setQuantityError();
    setFeedback('');
    syncQuantityControls();
  });

  drawerWrap?.querySelector<HTMLButtonElement>('[data-product-open-drawer]')
    ?.addEventListener('click', (event) => openCartDrawer(event.currentTarget as HTMLButtonElement));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    clearErrors();
    setFeedback('');
    const selection = getSelection();
    payload.options.forEach((option) => {
      if (!selection.some((selected) => selected.name === option.name)) {
        setOptionError(option.name, `Selecciona ${option.name.toLocaleLowerCase('es')}.`);
      }
    });
    const quantity = qtyInput.valueAsNumber;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(qtyInput.max)) {
      setQuantityError(`La cantidad debe estar entre 1 y ${qtyInput.max}.`);
    }
    if (!selectedVariant || !selectedVariant.availableForSale || !Number.isInteger(quantity) || quantity < 1 || quantity > Number(qtyInput.max)) {
      setFeedback(selectedVariant ? 'La variante seleccionada está agotada.' : 'Revisa las opciones antes de añadir el producto.', true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await addProductToCart({ variantId: selectedVariant.id, quantity });
      if (!result.success && result.error) {
        if (result.error.field === 'quantity') setQuantityError(result.error.message);
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

  syncSelection();
};

export const initProductAddForms = (): void => {
  document.querySelectorAll<HTMLFormElement>('[data-product-add-form]').forEach(bindProductAddForm);
};
