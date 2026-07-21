type Cleanup = () => void;

async function createFooterMotion(root: HTMLElement): Promise<Cleanup> {
  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);

  gsap.registerPlugin(ScrollTrigger);

  const footerBottom = root.querySelector<HTMLElement>('[data-footer-bottom]');
  if (!footerBottom) return () => {};

  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: {
        trigger: footerBottom,
        start: 'top 90%',
        once: true,
      },
    });

    timeline
      .from(footerBottom.querySelector('.footer-accent-bar'), { scaleX: 0, opacity: 0, duration: 0.9, transformOrigin: 'center' })
      .from(footerBottom.querySelector('.footer-bg'), { opacity: 0, duration: 1.1 }, 0.05)
      .from(footerBottom.querySelector('.footer-top-rule'), { scaleX: 0, opacity: 0, duration: 0.75, transformOrigin: 'center' }, 0.15)
      .from(footerBottom.querySelector('.footer-cta'), { y: 18, opacity: 0, duration: 0.75 }, 0.22)
      .from(footerBottom.querySelector('.footer-brand-col'), { y: 18, opacity: 0, duration: 0.65 }, 0.3)
      .from(footerBottom.querySelector('.footer-nav-col'), { y: 18, opacity: 0, duration: 0.65 }, 0.38)
      .from(footerBottom.querySelector('.footer-help-col'), { y: 18, opacity: 0, duration: 0.65 }, 0.44)
      .from(footerBottom.querySelector('.footer-contact-col'), { y: 18, opacity: 0, duration: 0.65 }, 0.5)
      .from(footerBottom.querySelectorAll('.footer-meta-tag'), { y: 10, opacity: 0, duration: 0.45, stagger: 0.06 }, 0.58)
      .from(footerBottom.querySelector('.footer-giant'), { y: 36, opacity: 0, duration: 1.15 }, 0.52)
      .from(footerBottom.querySelector('.footer-bottom-bar'), { y: 10, opacity: 0, duration: 0.55 }, 0.72);

    const giant = footerBottom.querySelector('.footer-giant');
    if (giant) {
      gsap.to(giant, {
        y: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: footerBottom,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    }
  }, root);

  return () => context.revert();
}

export function initFooter(root: HTMLElement): Cleanup {
  if (root.dataset.footerInitialized === 'true') return () => {};

  root.dataset.footerInitialized = 'true';

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollToTopButton = root.querySelector<HTMLButtonElement>('[data-footer-scroll-top]');
  let visibilityFrame = 0;
  let disposed = false;
  let motionCleanup: Cleanup | undefined;
  let motionPromise: Promise<void> | undefined;

  const stopMotion = () => {
    motionCleanup?.();
    motionCleanup = undefined;
  };

  const startMotion = () => {
    if (reducedMotion.matches || motionCleanup || motionPromise || disposed) return;

    motionPromise = createFooterMotion(root)
      .then((cleanup) => {
        if (disposed || reducedMotion.matches) cleanup();
        else motionCleanup = cleanup;
      })
      .finally(() => {
        motionPromise = undefined;
      });
  };

  const syncMotionPreference = () => {
    if (reducedMotion.matches) stopMotion();
    else startMotion();
  };

  const updateButtonVisibility = () => {
    visibilityFrame = 0;
    if (!scrollToTopButton) return;
    const hidden = window.scrollY <= 400;
    if (scrollToTopButton.hidden !== hidden) scrollToTopButton.hidden = hidden;
  };

  const scheduleButtonVisibility = () => {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(updateButtonVisibility);
  };

  window.addEventListener('scroll', scheduleButtonVisibility, { passive: true, signal });
  scrollToTopButton?.addEventListener(
    'click',
    () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    },
    { signal }
  );
  reducedMotion.addEventListener('change', syncMotionPreference);

  updateButtonVisibility();
  syncMotionPreference();

  return () => {
    disposed = true;
    controller.abort();
    reducedMotion.removeEventListener('change', syncMotionPreference);
    if (visibilityFrame) cancelAnimationFrame(visibilityFrame);
    stopMotion();
    delete root.dataset.footerInitialized;
  };
}
