const bindProductGallery = (root: HTMLElement): void => {
  if (root.dataset.galleryBound === 'true') return;
  const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-gallery-choice]')];
  const slides = [...root.querySelectorAll<HTMLElement>('[data-gallery-slide]')];
  const thumbs = [...root.querySelectorAll<HTMLElement>('[data-gallery-thumb]')];
  if (!inputs.length || inputs.length !== slides.length || inputs.length !== thumbs.length) return;
  root.dataset.galleryBound = 'true';

  const select = (index: number) => {
    slides.forEach((slide, current) => slide.toggleAttribute('hidden', current !== index));
    thumbs.forEach((thumb, current) => {
      if (current === index) thumb.setAttribute('data-selected', 'true');
      else thumb.removeAttribute('data-selected');
    });
  };
  inputs.forEach((input, index) => input.addEventListener('change', () => {
    if (input.checked) select(index);
  }));
  select(Math.max(0, inputs.findIndex((input) => input.checked)));
};

export const initProductGalleries = (): void => {
  document.querySelectorAll<HTMLElement>('[data-product-gallery]').forEach(bindProductGallery);
};
