import { bootstrapCartClient } from '@scripts/commerce/lazy-init-cart';
import { initHeader } from '@scripts/header';

bootstrapCartClient();

const cleanups = Array.from(document.querySelectorAll<HTMLElement>('[data-site-header]'))
  .map((root) => initHeader(root));

document.addEventListener(
  'astro:before-swap',
  () => cleanups.forEach((cleanup) => cleanup()),
  { once: true }
);
