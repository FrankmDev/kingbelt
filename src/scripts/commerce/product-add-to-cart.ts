import { setButtonPending } from '@shared/browser/button-state';
import { ensureCartReady } from './lazy-init-cart';
import { addProductToCart, openCartDrawer } from './cart-store';
import { formatMoney } from '@commerce/domain/money';
import { variantId } from '@commerce/domain/identifiers';
import { getQuantityLimitMessage, isQuantityAllowed } from '@commerce/domain/inventory';
import {
  expandCompactPublicBuyBoxPayload,
  getPublicBuyBoxMessage,
  isPublicBuyBoxPurchasable,
  parseCompactPublicBuyBoxPayload,
  parseProductOptionPurpose,
  toPublicBuyBoxOptions,
  type PublicBuyBoxAvailability,
  type PublicBuyBoxVariant,
} from '@commerce/domain/product-mappers';
import {
  applyProductBuyBoxSelection,
  getVariantBySelectedOptions,
} from '@commerce/domain/variants';
import type { Money } from '@commerce/domain/money';
import type {
  ProductOption,
  OptionSelection,
} from '@commerce/domain/catalog';

void ensureCartReady();

interface PublicVariant {
  id: string;
  optionValues: OptionSelection[];
  price: Money;
  compareAtPrice?: Money;
  imageId?: string;
  availability: PublicBuyBoxAvailability;
}

const toClientVariant = (variant: PublicBuyBoxVariant, currency: string): PublicVariant => ({
  id: variant.id,
  optionValues: variant.optionValues,
  price: { amountMinor: variant.price, currency },
  ...(variant.compareAtPrice === undefined
    ? {}
    : { compareAtPrice: { amountMinor: variant.compareAtPrice, currency } }),
  ...(variant.imageId ? { imageId: variant.imageId } : {}),
  availability: variant.availability,
});

const readOptions = (form: HTMLFormElement, optionIds: readonly string[]): ProductOption[] | null =>
  toPublicBuyBoxOptions(
    optionIds,
    [...form.querySelectorAll<HTMLElement>('[data-product-option-group]')].flatMap((fieldset) => {
      if (!fieldset.dataset.productOptionGroup || !fieldset.dataset.productOptionName) return [];
      const values = [...fieldset.querySelectorAll<HTMLInputElement>('[data-product-option]')]
        .flatMap((input) => input.dataset.optionValueLabel
          ? [{ id: input.value, label: input.dataset.optionValueLabel }]
          : []);
      return values.length
        ? [{
          id: fieldset.dataset.productOptionGroup,
          name: fieldset.dataset.productOptionName,
          purpose: parseProductOptionPurpose(fieldset.dataset.productOptionPurpose),
          values,
        }]
        : [];
    })
  );

const parsePayload = (form: HTMLFormElement): { options: ProductOption[]; variants: PublicVariant[] } | null => {
  const script = form.querySelector<HTMLScriptElement>('[data-product-variants]');
  if (!script?.textContent || script.textContent.length > 500_000) return null;
  try {
    const compact = parseCompactPublicBuyBoxPayload(JSON.parse(script.textContent));
    if (!compact) return null;
    const options = readOptions(form, compact.o);
    if (!options || options.length !== compact.o.length) return null;
    return {
      options,
      variants: expandCompactPublicBuyBoxPayload(compact).map((variant) =>
        toClientVariant(variant, compact.c)
      ),
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

  const syncGallerySet = (colorValueId: string | undefined) => {
    if (!colorValueId) return;
    const page = form.closest<HTMLElement>('[data-product-page]') ?? document.body;
    const gallerySets = [...page.querySelectorAll<HTMLElement>('[data-gallery-set]')];
    if (gallerySets.length <= 1) return;
    gallerySets.forEach((set) => {
      set.hidden = set.dataset.gallerySet !== colorValueId;
    });
  };

  const syncVariantImage = (variant: PublicVariant | undefined, colorValueId: string | undefined) => {
    if (!variant?.imageId) return;
    const page = form.closest<HTMLElement>('[data-product-page]') ?? document.body;
    const gallerySets = [...page.querySelectorAll<HTMLElement>('[data-gallery-set]')];
    const gallerySet = colorValueId
      ? gallerySets.find((set) => set.dataset.gallerySet === colorValueId)
      : gallerySets.length === 1
        ? gallerySets[0]
        : gallerySets.find((set) => !set.hidden);
    const choice = gallerySet
      ? [...gallerySet.querySelectorAll<HTMLInputElement>('[data-gallery-image-id]')]
        .find((input) => input.dataset.galleryImageId === variant.imageId)
      : undefined;
    if (choice && !choice.checked) {
      choice.checked = true;
    }
  };

  const syncQuantityControls = () => {
    const availability = selectedVariant?.availability;
    const max = availability?.maxQuantity ?? 0;
    const minimum = availability?.minimum ?? 1;
    const increment = availability?.increment ?? 1;
    qtyInput.min = String(minimum);
    qtyInput.step = String(increment);
    qtyInput.max = String(Math.max(minimum, max));
    if (qtyInput.valueAsNumber < minimum) qtyInput.value = String(minimum);
    if (qtyInput.valueAsNumber > max && max > 0) qtyInput.value = String(max);
    const current = Number.isInteger(qtyInput.valueAsNumber) ? qtyInput.valueAsNumber : minimum;
    const disabled = submitting || !availability || !isPublicBuyBoxPurchasable(availability);
    const disabledReason = availability && !isPublicBuyBoxPurchasable(availability)
      ? getPublicBuyBoxMessage(availability)
      : !availability
        ? 'La variante seleccionada no está disponible.'
        : '';
    qtyInput.disabled = disabled;
    decreaseBtn?.toggleAttribute('disabled', disabled || current <= minimum);
    increaseBtn?.toggleAttribute('disabled', disabled || current >= max);
    if (decreaseBtn) {
      decreaseBtn.title = disabled || current <= minimum
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
    const resolved = applyProductBuyBoxSelection(payload, getSelection(), changedOptionId);
    if (changedOptionId) {
      optionInputs.forEach((input) => {
        if (input.dataset.optionId === changedOptionId) return;
        const kept = resolved.selection.some((selected) =>
          selected.optionId === input.dataset.optionId && selected.valueId === input.value
        );
        if (input.checked !== kept) input.checked = kept;
      });
      payload.options.forEach((option) => {
        if (option.id === changedOptionId) return;
        if (!resolved.selection.some((selected) => selected.optionId === option.id)) {
          setOptionError(option.id);
        }
      });
    }

    optionInputs.forEach((input) => {
      const optionId = input.dataset.optionId ?? '';
      const compatible = resolved.compatibleValueIds.get(optionId)?.includes(input.value) ?? false;
      input.disabled = submitting || !compatible;
      const label = input.closest('label');
      label?.toggleAttribute('data-impossible', !compatible);
      const hint = label?.querySelector<HTMLElement>('[data-impossible-hint]');
      if (hint) hint.hidden = compatible;
    });

    selectedVariant = resolved.selectedVariant;
    const complete = resolved.selection.length === payload.options.length;
    syncGallerySet(resolved.colorValueId);
    if (selectedVariant) {
      if (price) price.textContent = formatMoney(selectedVariant.price);
      if (compare) {
        compare.textContent = selectedVariant.compareAtPrice ? formatMoney(selectedVariant.compareAtPrice) : '';
        compare.hidden = !selectedVariant.compareAtPrice;
      }
      syncVariantImage(selectedVariant, resolved.colorValueId);
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
    const minimum = selectedVariant?.availability.minimum ?? 1;
    const increment = selectedVariant?.availability.increment ?? 1;
    qtyInput.value = String(Math.max(minimum, (qtyInput.valueAsNumber || minimum) - increment));
    setQuantityError();
    syncQuantityControls();
  });
  increaseBtn?.addEventListener('click', () => {
    const max = Number(qtyInput.max);
    const increment = selectedVariant?.availability.increment ?? 1;
    if (!Number.isSafeInteger(max) || max < 1) return;
    qtyInput.value = String(Math.min(max, (qtyInput.valueAsNumber || 1) + increment));
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
    const resolvedVariant = getVariantBySelectedOptions(payload, selection);
    const quantity = qtyInput.valueAsNumber;
    const availability = resolvedVariant?.availability;
    const availabilityMessage = availability ? getPublicBuyBoxMessage(availability) : undefined;
    const purchasable = availability ? isPublicBuyBoxPurchasable(availability) : false;
    if (availability && !isQuantityAllowed(quantity, availability)) {
      setQuantityError(
        quantity > availability.maxQuantity
          ? getQuantityLimitMessage({ ...availability, message: availabilityMessage ?? '' })
          : `La cantidad debe comenzar en ${availability.minimum} y avanzar de ${availability.increment} en ${availability.increment}.`
      );
    }
    if (!resolvedVariant || !purchasable || !availability || !isQuantityAllowed(quantity, availability)) {
      setFeedback(
        resolvedVariant
          ? availabilityMessage ?? 'La variante seleccionada no está disponible.'
          : 'Revisa las opciones antes de añadir el producto.',
        true
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await addProductToCart({ variantId: variantId(resolvedVariant.id), quantity });
      if (!result.success && result.error) {
        if (result.error.field === 'quantity') setQuantityError(result.error.message);
        setFeedback(result.error.message, true);
        return;
      }
      if (result.notice) {
        setFeedback(result.notice.message);
      } else {
        const variantSummary = formatVariantSummary(selection);
        setFeedback(
          variantSummary ? `Añadido al carrito: ${variantSummary}.` : 'Producto añadido al carrito.'
        );
      }
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
