export const setButtonPending = (button: HTMLButtonElement, pending: boolean): void => {
  button.classList.toggle('kb-btn-loading', pending);
  button.toggleAttribute('aria-busy', pending);
  button.disabled = pending;

  const existingSpinner = button.querySelector<HTMLElement>('[data-dynamic-spinner]');
  if (pending && !existingSpinner) {
    const spinner = document.createElement('span');
    spinner.className = 'kb-btn-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.setAttribute('data-dynamic-spinner', '');
    button.append(spinner);
  } else if (!pending) {
    existingSpinner?.remove();
  }
};
