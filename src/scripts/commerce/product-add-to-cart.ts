import { setButtonPending } from '@shared/browser/button-state';
import { ensureCartReady } from './lazy-init-cart';
import { addProductToCart, openCartDrawer } from './cart-store';
import { formatMoney } from '@commerce/domain/money';
import { variantId } from '@commerce/domain/identifiers';
import { getQuantityLimitMessage } from '@commerce/domain/inventory';
import {
  getPublicBuyBoxMessage,
  isPublicBuyBoxPurchasable,
  type PublicBuyBoxAvailability,
  type PublicBuyBoxVariant,
} from '@commerce/domain/product-mappers';
import {
  getCompatibleOptionValues,
  getVariantBySelectedOptions,
  reconcileSelectedOptions,
} from '@commerce/domain/variants';
import type { Money } from '@commerce/domain/money';
import type {
  ProductOption,
  OptionSelection,
} from '@commerce/domain/catalog';

void ensureCartReady();

interface PublicVariant extends Omit<PublicBuyBoxVariant, 'price' | 'compareAtPrice' | 'inventory'> {
  price: Money;
  compareAtPrice?: Money;
}

type SerializedVariant = PublicBuyBoxVariant;

interface VariantPayload {
  currency: string;
  options: ProductOption[];
  variants: SerializedVariant[];
}

const isPublicAvailability = (value: unknown): value is PublicBuyBoxAvailability => {
  if (!value || typeof value !== 'object') return false;
  const availability = value as Partial<PublicBuyBoxAvailability>;
  return (
    typeof availability.status === 'string' &&
    typeof availability.maxQuantity === 'number' &&
    typeof availability.limitReason === 'string' &&
    (availability.backorder === undefined || availability.backorder === true)
  );
};

const toPublicVariant = (variant: SerializedVariant, currency: string): PublicVariant => ({
  ...variant,
  price: { amountMinor: variant.price, currency },
  compareAtPrice: variant.compareAtPrice === undefined
    ? undefined
    : { amountMinor: variant.compareAtPrice, currency },
});

const parsePayload = (form: HTMLFormElement): { options: ProductOption[]; variants: PublicVariant[] } | null => {
  const script = form.querySelector<HTMLScriptElement>('[data-product-variants]');
  if (!script?.textContent || script.textContent.length > 500_000) return null;
  try {
    const value: unknown = JSON.parse(script.textContent);
    if (!value || typeof value !== 'object') return null;
    const payload = value as Partial<VariantPayload>;
    if (
      typeof payload.currency !== 'string' ||
      !Array.isArray(payload.options) ||
      !Array.isArray(payload.variants)
    ) {
      return null;
    }
    if (payload.variants.some((variant) => !isPublicAvailability(variant.availability))) {
      return null;
    }
    return {
      options: payload.options,
      variants: payload.variants.map((variant) => toPublicVariant(variant, payload.currency!)),
    };
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
  const availabilityNode = form.querySelector<HTMLElement>('[data-product-availability]');
  const submitHint = form.querySelector<HTMLElement>('[data-product-submit-hint]');
  const price = form.querySelector<HTMLElement>('[data-product-price]');
  const compare = form.querySelector<HTMLElement>('[data-product-compare]');
  const qtyInput = form.querySelector<HTMLInputElement>('[data-product-quantity]');
  const decreaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-decrease]');
  const increaseBtn = form.querySelector<HTMLButtonElement>('[data-product-qty-increase]');
  const optionInputs = [...form.querySelectorAll<HTMLInputElement>('[data-product-option]')];
  if (!payload || !submitBtn || !qtyInput) return;
  form.dataset.cartBound = 'true';
  let submitting = false;
  let selectedVariant: PublicVariant | undefined;
  let lastAvailabilityMessage = availabilityNode?.textContent ?? '';

  const setOptionError = (optionId: string, message?: string) => {
    const node = [...form.querySelectorAll<HTMLElement>('[data-error-for-option]')]
      .find((item) => item.dataset.errorForOption === optionId);
    optionInputs.filter((input) => input.dataset.optionId === optionId).forEach((input) => {
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
    payload.options.forEach((option) => setOptionError(option.id));
    setQuantityError();
  };

  const setFeedback = (message: string, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
    feedback.hidden = !message;
    feedback.setAttribute('role', isError ? 'alert' : 'status');
  };

  const formatVariantSummary = (selection: OptionSelection[]): string => {
    return payload.options.flatMap((option) => {
      const selected = selection.find((item) => item.optionId === option.id);
      const value = option.values.find((item) => item.id === selected?.valueId);
      return value ? [`${option.name}: ${value.label}`] : [];
    }).join(', ');
  };

  const getSelection = (): OptionSelection[] => payload.options.flatMap((option) => {
    const input = optionInputs.find((candidate) => candidate.dataset.optionId === option.id && candidate.checked);
    return input ? [{ optionId: option.id, valueId: input.value }] : [];
  });

  const syncVariantImage = (variant: PublicVariant | undefined) => {
    if (!variant?.imageId) return;
    const page = form.closest<HTMLElement>('[data-product-page]') ?? document.body;
    const choice = [...page.querySelectorAll<HTMLInputElement>('[data-gallery-image-id]')]
      .find((input) => input.dataset.galleryImageId === variant.imageId);
    if (choice && !choice.checked) {
      choice.checked = true;
    }
  };

  const syncQuantityControls = () => {
    const availability = selectedVariant?.availability;
    const max = availability?.maxQuantity ?? 0;
    qtyInput.max = String(Math.max(1, max));
    if (qtyInput.valueAsNumber > max && max > 0) qtyInput.value = String(max);
    const current = Number.isInteger(qtyInput.valueAsNumber) ? qtyInput.valueAsNumber : 1;
    const disabled = submitting || !availability || !isPublicBuyBoxPurchasable(availability);
    const disabledReason = availability && !isPublicBuyBoxPurchasable(availability)
      ? getPublicBuyBoxMessage(availability)
      : !availability
        ? 'La variante seleccionada no está disponible.'
        : '';
    qtyInput.disabled = disabled;
    decreaseBtn?.toggleAttribute('disabled', disabled || current <= 1);
    increaseBtn?.toggleAttribute('disabled', disabled || current >= max);
    if (decreaseBtn) {
      decreaseBtn.title = disabled || current <= 1
        ? disabledReason || 'No puedes reducir más la cantidad.'
        : '';
    }
    if (increaseBtn) {
      increaseBtn.title = disabled || current >= max
        ? disabledReason || 'Has alcanzado la cantidad máxima permitida.'
        : '';
    }
  };

  const syncSelection = (changedOptionId?: string) => {
    let selection = getSelection();
    if (changedOptionId) {
      selection = reconcileSelectedOptions(payload, selection, changedOptionId);
      optionInputs.forEach((input) => {
        if (input.dataset.optionId !== changedOptionId && input.checked) {
          input.checked = selection.some((selected) =>
            selected.optionId === input.dataset.optionId && selected.valueId === input.value
          );
        }
      });
    }

    selection = getSelection();
    optionInputs.forEach((input) => {
      const optionId = input.dataset.optionId ?? '';
      const optionIndex = payload.options.findIndex((option) => option.id === optionId);
      const upstreamSelection = selection.filter((selected) =>
        payload.options.findIndex((option) => option.id === selected.optionId) < optionIndex
      );
      const compatible = getCompatibleOptionValues(payload, upstreamSelection, optionId).includes(input.value);
      input.disabled = submitting || !compatible;
      const label = input.closest('label');
      label?.toggleAttribute('data-impossible', !compatible);
      const hint = label?.querySelector<HTMLElement>('[data-impossible-hint]');
      if (hint) hint.hidden = compatible;
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

    const availability = selectedVariant?.availability;
    const availabilityMessage = availability ? getPublicBuyBoxMessage(availability) : undefined;
    const purchasable = availability ? isPublicBuyBoxPurchasable(availability) : false;
    submitBtn.disabled = submitting || !purchasable;
    if (availabilityNode) {
      const nextMessage = !complete
        ? 'Selecciona las opciones para consultar la disponibilidad.'
        : availabilityMessage ?? 'Esta combinación no está disponible.';
      if (nextMessage !== lastAvailabilityMessage) {
        availabilityNode.textContent = nextMessage;
        lastAvailabilityMessage = nextMessage;
      }
      availabilityNode.dataset.availabilityStatus = availability?.status ?? 'unavailable';
    }
    if (submitLabel) {
      submitLabel.textContent = !complete
        ? 'Elige las opciones'
        : purchasable
          ? 'Añadir al carrito'
          : selectedVariant
            ? availability?.status === 'out_of_stock'
              ? 'Agotado'
              : availability?.status === 'unavailable'
                ? 'No disponible'
                : 'No disponible'
            : 'Combinación no disponible';
    }
    if (submitHint) {
      const hint = !complete
        ? 'Selecciona todas las opciones del producto para poder añadirlo al carrito.'
        : purchasable
          ? ''
          : selectedVariant
            ? availability?.status === 'out_of_stock'
              ? 'Esta variante está agotada.'
              : availability?.status === 'unavailable'
                ? 'Esta variante no está disponible para la venta.'
                : availabilityMessage ?? 'Esta combinación no está disponible.'
            : 'La combinación elegida no existe en el catálogo.';
      submitHint.textContent = hint;
    }
    syncQuantityControls();
  };

  const setSubmitting = (active: boolean) => {
    submitting = active;
    setButtonPending(submitBtn, active);
    syncSelection();
  };

  optionInputs.forEach((input) => input.addEventListener('change', () => {
    const optionId = input.dataset.optionId ?? '';
    setOptionError(optionId);
    setFeedback('');
    syncSelection(optionId);
  }));

  decreaseBtn?.addEventListener('click', () => {
    qtyInput.value = String(Math.max(1, (qtyInput.valueAsNumber || 1) - 1));
    setQuantityError();
    syncQuantityControls();
  });
  increaseBtn?.addEventListener('click', () => {
    const max = Number(qtyInput.max);
    if (!Number.isSafeInteger(max) || max < 1) return;
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
      if (!selection.some((selected) => selected.optionId === option.id)) {
        setOptionError(option.id, `Selecciona ${option.name.toLocaleLowerCase('es')}.`);
      }
    });
    const quantity = qtyInput.valueAsNumber;
    const availability = selectedVariant?.availability;
    const availabilityMessage = availability ? getPublicBuyBoxMessage(availability) : undefined;
    const purchasable = availability ? isPublicBuyBoxPurchasable(availability) : false;
    if (!Number.isInteger(quantity) || quantity < 1) {
      setQuantityError('Introduce una cantidad válida a partir de 1.');
    } else if (availability && quantity > availability.maxQuantity) {
      setQuantityError(getQuantityLimitMessage({
        ...availability,
        message: availabilityMessage ?? '',
      }));
    }
    if (!selectedVariant || !purchasable || !Number.isInteger(quantity) || quantity < 1 || quantity > (availability?.maxQuantity ?? 0)) {
      setFeedback(
        selectedVariant
          ? availabilityMessage ?? 'La variante seleccionada no está disponible.'
          : 'Revisa las opciones antes de añadir el producto.',
        true
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await addProductToCart({ variantId: variantId(selectedVariant.id), quantity });
      if (!result.success && result.error) {
        if (result.error.field === 'quantity') setQuantityError(result.error.message);
        setFeedback(result.error.message, true);
        return;
      }
      const variantSummary = formatVariantSummary(selection);
      setFeedback(
        variantSummary ? `Añadido al carrito: ${variantSummary}.` : 'Producto añadido al carrito.'
      );
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
