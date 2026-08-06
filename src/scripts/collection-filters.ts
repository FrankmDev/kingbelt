import { normalizeFilterValue } from '../lib/commerce/catalog-filters';

const matchesPrice = (min: number, max: number, range: string): boolean => {
  if (!range) return true;
  if (range === 'lt-80') return min < 8_000;
  if (range === '80-90') return max >= 8_000 && min <= 9_000;
  if (range === 'gt-90') return max > 9_000;
  return true;
};

const bindCollectionCatalog = (root: HTMLElement): void => {
  if (root.dataset.filtersBound === 'true') return;
  const panel = root.querySelector<HTMLDetailsElement>('[data-collection-filters]');
  const form = root.querySelector<HTMLFormElement>('[data-collection-filters-form]');
  const items = [...root.querySelectorAll<HTMLElement>('[data-collection-product]')];
  const count = root.querySelector<HTMLElement>('[data-results-count]');
  const empty = root.querySelector<HTMLElement>('[data-results-empty]');
  const badge = root.querySelector<HTMLElement>('[data-active-count]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset-filters]');
  if (!panel || !form || !count || !empty) return;
  root.dataset.filtersBound = 'true';

  const desktopQuery = window.matchMedia('(min-width: 64rem)');
  const syncDisclosure = () => {
    panel.open = desktopQuery.matches;
    panel.querySelectorAll<HTMLDetailsElement>('[data-filter-group]').forEach((group) => {
      group.open = desktopQuery.matches;
    });
  };

  const selectedValues = (name: string): string[] =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)]
      .map((input) => normalizeFilterValue(input.value));

  const update = () => {
    const types = new Set(selectedValues('tipo'));
    const colors = new Set(selectedValues('color'));
    const price = form.querySelector<HTMLInputElement>('input[name="precio"]:checked')?.value ?? '';
    let visible = 0;

    items.forEach((item) => {
      let itemColors: string[] = [];
      try {
        const parsed: unknown = JSON.parse(item.dataset.filterColors ?? '[]');
        if (Array.isArray(parsed)) itemColors = parsed.filter((value): value is string => typeof value === 'string');
      } catch {
        itemColors = [];
      }
      const typeMatches = !types.size || types.has(normalizeFilterValue(item.dataset.filterType ?? ''));
      const colorMatches = !colors.size || itemColors.some((value) => colors.has(normalizeFilterValue(value)));
      const min = Number(item.dataset.filterPriceMin);
      const max = Number(item.dataset.filterPriceMax);
      const visibleItem = typeMatches && colorMatches && matchesPrice(min, max, price);
      item.hidden = !visibleItem;
      if (visibleItem) visible += 1;
    });

    const active = form.querySelectorAll<HTMLInputElement>('input:checked').length;
    count.textContent = `${visible} ${visible === 1 ? 'referencia' : 'referencias'}`;
    empty.hidden = visible !== 0;
    if (badge) {
      badge.textContent = String(active);
      badge.hidden = active === 0;
      badge.setAttribute('aria-label', active === 1 ? '1 filtro activo' : `${active} filtros activos`);
    }
    if (resetButton) resetButton.hidden = active === 0;
  };

  form.addEventListener('change', update);
  form.addEventListener('reset', () => window.requestAnimationFrame(update));
  desktopQuery.addEventListener('change', syncDisclosure);
  syncDisclosure();
  update();
};

export const initCollectionCatalogs = (): void => {
  document.querySelectorAll<HTMLElement>('[data-collection-catalog]').forEach(bindCollectionCatalog);
};
