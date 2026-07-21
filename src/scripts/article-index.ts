type Cleanup = () => void;

const DESKTOP_QUERY = '(min-width: 64rem)';

export function initArticleIndex(root: HTMLElement): Cleanup {
  if (root.dataset.articleInitialized === 'true') return () => {};

  root.dataset.articleInitialized = 'true';

  const sections = Array.from(
    root.querySelectorAll<HTMLElement>('[data-article-section]')
  );
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-index-link]'));
  const layers = Array.from(root.querySelectorAll<HTMLElement>('[data-index-layer]'));
  const disclosure = root.querySelector<HTMLDetailsElement>('[data-article-index-disclosure]');
  const media = window.matchMedia(DESKTOP_QUERY);
  const controller = new AbortController();
  const { signal } = controller;
  let observer: IntersectionObserver | undefined;
  let frame = 0;
  let activeId: string | null = null;

  const setActive = (nextId: string | null) => {
    if (nextId === activeId) return;
    activeId = nextId;

    links.forEach((link) => {
      const active = link.dataset.sectionTarget === nextId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    layers.forEach((layer) => {
      layer.classList.toggle('is-active', layer.dataset.sectionId === nextId);
    });

    sections.forEach((section) => {
      section.classList.toggle('is-active', section.id === nextId);
    });
  };

  const resolveActiveSection = () => {
    if (!sections.length) return null;

    const activationLine = window.innerHeight * 0.32;
    let active = sections[0];

    for (const section of sections) {
      if (section.getBoundingClientRect().top <= activationLine) active = section;
      else break;
    }

    return active?.id ?? null;
  };

  const update = () => {
    frame = 0;
    if (media.matches && disclosure && !disclosure.open) disclosure.open = true;
    setActive(resolveActiveSection());
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  if ('IntersectionObserver' in window && sections.length) {
    observer = new IntersectionObserver(schedule, {
      rootMargin: '-20% 0px -62% 0px',
      threshold: [0, 0.15, 0.35, 0.55],
    });
    sections.forEach((section) => observer?.observe(section));
  }

  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', schedule, { passive: true, signal });
  media.addEventListener('change', schedule);
  update();

  return () => {
    controller.abort();
    media.removeEventListener('change', schedule);
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    setActive(null);
    delete root.dataset.articleInitialized;
  };
}
