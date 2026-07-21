type Cleanup = () => void;

const normalize = (value: string) => value.trim().toLocaleLowerCase('es');

export function initFAQ(root: HTMLElement): Cleanup {
  if (root.dataset.faqInitialized === 'true') return () => {};

  root.dataset.faqInitialized = 'true';

  const controller = new AbortController();
  const { signal } = controller;
  const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('[data-faq-item]'));
  const accordionName = details[0]?.getAttribute('name') ?? '';
  const filterButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-faq-filter]')
  );
  const searchInput = root.querySelector<HTMLInputElement>('[data-faq-search]');
  const counterValue = root.querySelector<HTMLElement>('[data-faq-counter-value]');
  const counterLabel = root.querySelector<HTMLElement>('[data-faq-counter-label]');
  const expandButton = root.querySelector<HTMLButtonElement>('[data-faq-action="expand"]');
  const collapseButton = root.querySelector<HTMLButtonElement>('[data-faq-action="collapse"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hashFrame = 0;

  const restoreAccordion = () => {
    if (!accordionName) return;
    details.forEach((detail) => detail.setAttribute('name', accordionName));
  };

  const updateCounter = (visibleCount: number) => {
    if (counterValue && counterValue.textContent !== String(visibleCount)) {
      counterValue.textContent = String(visibleCount);
    }

    const label = visibleCount === 1 ? 'pregunta' : 'preguntas';
    if (counterLabel && counterLabel.textContent !== label) {
      counterLabel.textContent = label;
    }
  };

  const applyFilters = () => {
    const activeCategory =
      filterButtons.find((button) => button.dataset.active === 'true')?.dataset.faqFilter ??
      'all';
    const query = normalize(searchInput?.value ?? '');
    let visibleCount = 0;

    details.forEach((detail) => {
      const category = detail.dataset.category ?? '';
      const question = detail.querySelector('[data-faq-question]')?.textContent ?? '';
      const answer = detail.querySelector('[data-faq-answer]')?.textContent ?? '';
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch =
        query === '' || normalize(question).includes(query) || normalize(answer).includes(query);
      const visible = matchesCategory && matchesSearch;

      detail.hidden = !visible;
      if (!visible) detail.open = false;
      if (visible) visibleCount += 1;
    });

    updateCounter(visibleCount);
  };

  const openHashFAQ = () => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith('faq-')) return;

    const target = root.querySelector<HTMLDetailsElement>(`#${CSS.escape(id)}`);
    if (!target || target.hidden) return;

    target.open = true;
    if (hashFrame) cancelAnimationFrame(hashFrame);
    hashFrame = requestAnimationFrame(() => {
      hashFrame = 0;
      target.scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  filterButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        filterButtons.forEach((candidate) => {
          const active = candidate === button;
          candidate.dataset.active = String(active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        applyFilters();
      },
      { signal }
    );
  });

  searchInput?.addEventListener('input', applyFilters, { signal });

  root.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('[data-faq-summary]')) {
        restoreAccordion();
      }
    },
    { signal }
  );

  expandButton?.addEventListener(
    'click',
    () => {
      details.forEach((detail) => {
        if (!detail.hidden) {
          detail.removeAttribute('name');
          detail.open = true;
        }
      });
    },
    { signal }
  );

  collapseButton?.addEventListener(
    'click',
    () => {
      restoreAccordion();
      details.forEach((detail) => {
        detail.open = false;
      });
    },
    { signal }
  );

  window.addEventListener('hashchange', openHashFAQ, { signal });
  applyFilters();
  openHashFAQ();

  return () => {
    controller.abort();
    if (hashFrame) cancelAnimationFrame(hashFrame);
    delete root.dataset.faqInitialized;
  };
}
