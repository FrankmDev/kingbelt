import {
  AVAILABLE_ONLY_FACET_VALUE,
  matchesCatalogSelection,
  normalizeFilterValue,
  parseCatalogFilterParams,
  serializeCatalogFilterParams,
} from '@commerce/domain/catalog-filters';
import type {
  CatalogFilterSelection,
  CatalogFilterable,
} from '@commerce/domain/catalog-filters';

interface FilterableItem {
  element: HTMLElement;
  facet: CatalogFilterable;
}

/** Lee los campos de filtro de una tarjeta una sola vez, al vincular el catálogo. */
const parseFilterable = (element: HTMLElement): CatalogFilterable => {
  let colors: string[] = [];
  try {
    const parsed: unknown = JSON.parse(element.dataset.filterColors ?? '[]');
    if (Array.isArray(parsed)) {
      colors = parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    colors = [];
  }
  const min = Number(element.dataset.filterPriceMin);
  return {
    productType: element.dataset.filterType ?? '',
    colors: colors.map((label) => ({ label })),
    fromPriceMinor: Number.isFinite(min) ? min : 0,
    purchasable: element.dataset.filterPurchasable === 'true',
  };
};

const resultCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'referencia' : 'referencias'}`;

const bindCollectionCatalog = (root: HTMLElement): void => {
  if (root.dataset.filtersBound === 'true') return;
  const panel = root.querySelector<HTMLDetailsElement>('[data-collection-filters]');
  const form = root.querySelector<HTMLFormElement>('[data-collection-filters-form]');
  const items = [...root.querySelectorAll<HTMLElement>('[data-collection-product]')];
  const count = root.querySelector<HTMLElement>('[data-results-count]');
  const empty = root.querySelector<HTMLElement>('[data-results-empty]');
  const badge = root.querySelector<HTMLElement>('[data-active-count]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset-filters]');
  const emptyReset = root.querySelector<HTMLButtonElement>('[data-empty-reset]');
  const loadMore = root.querySelector<HTMLButtonElement>('[data-load-more]');
  if (!panel || !form || !count || !empty) return;
  root.dataset.filtersBound = 'true';

  const parsedPageSize = Number.parseInt(root.dataset.pageSize ?? '', 10);
  const pageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 24;
  const model: FilterableItem[] = items.map((element) => ({
    element,
    facet: parseFilterable(element),
  }));
  let page = 1;

  const desktopQuery = window.matchMedia('(min-width: 64rem)');
  const syncDisclosure = () => {
    panel.open = desktopQuery.matches;
    panel.querySelectorAll<HTMLDetailsElement>('[data-filter-group]').forEach((group) => {
      group.open = desktopQuery.matches;
    });
  };

  const selectedValues = (name: string): string[] =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)]
      .map((input) => input.value);

  const selectionFromForm = (): CatalogFilterSelection => ({
    productTypes: selectedValues('tipo'),
    colors: selectedValues('color'),
    priceRange:
      form.querySelector<HTMLInputElement>('input[name="precio"]:checked')?.value ?? undefined,
    availableOnly: selectedValues('disponible').length > 0,
  });

  const writeSelectionToUrl = (selection: CatalogFilterSelection): void => {
    const query = serializeCatalogFilterParams(selection).toString();
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  };

  const setCheckedByNormalizedValue = (
    name: string,
    values: readonly string[] | undefined
  ): void => {
    if (!values?.length) return;
    const wanted = new Set(values.map(normalizeFilterValue));
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((input) => {
      if (wanted.has(normalizeFilterValue(input.value))) input.checked = true;
    });
  };

  const setExactChecked = (name: string, value: string | undefined): void => {
    if (!value) return;
    form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((input) => {
      if (input.value === value) input.checked = true;
    });
  };

  /** Restaura la selección del formulario desde la URL (hidratación inicial). */
  const applySelectionToForm = (selection: CatalogFilterSelection): void => {
    setCheckedByNormalizedValue('tipo', selection.productTypes);
    setCheckedByNormalizedValue('color', selection.colors);
    setExactChecked('precio', selection.priceRange);
    if (selection.availableOnly) setExactChecked('disponible', AVAILABLE_ONLY_FACET_VALUE);
  };

  const hydrateFromUrl = (): void => {
    const selection = parseCatalogFilterParams(window.location.search);
    if (
      !selection.productTypes?.length &&
      !selection.colors?.length &&
      !selection.priceRange &&
      !selection.availableOnly
    ) {
      return;
    }
    applySelectionToForm(selection);
  };

  const apply = (updateUrl: boolean): void => {
    const selection = selectionFromForm();
    const matches: FilterableItem[] = [];
    model.forEach((item) => {
      item.element.hidden = true;
      if (matchesCatalogSelection(item.facet, selection)) matches.push(item);
    });
    const visibleLimit = page * pageSize;
    matches.slice(0, visibleLimit).forEach((item) => {
      item.element.hidden = false;
    });

    count.textContent = resultCountLabel(matches.length);
    empty.hidden = matches.length !== 0;

    const active = form.querySelectorAll<HTMLInputElement>('input:checked').length;
    if (badge) {
      badge.textContent = String(active);
      badge.hidden = active === 0;
      badge.setAttribute('aria-label', active === 1 ? '1 filtro activo' : `${active} filtros activos`);
    }
    if (resetButton) resetButton.hidden = active === 0;

    if (loadMore) {
      const remaining = matches.length - visibleLimit;
      loadMore.hidden = remaining <= 0;
      loadMore.textContent = remaining > 0 ? `Mostrar más (quedan ${remaining})` : 'Mostrar más';
    }

    if (updateUrl) writeSelectionToUrl(selection);
  };

  form.addEventListener('change', () => {
    page = 1;
    apply(true);
  });
  form.addEventListener('reset', () => {
    window.requestAnimationFrame(() => {
      page = 1;
      apply(true);
    });
  });
  loadMore?.addEventListener('click', () => {
    page += 1;
    apply(false);
  });
  emptyReset?.addEventListener('click', () => {
    form.reset();
  });
  desktopQuery.addEventListener('change', syncDisclosure);

  hydrateFromUrl();
  syncDisclosure();
  apply(false);
};

export const initCollectionCatalogs = (): void => {
  document.querySelectorAll<HTMLElement>('[data-collection-catalog]').forEach(bindCollectionCatalog);
};
