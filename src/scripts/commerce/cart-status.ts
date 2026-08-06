/** Utilidades DOM mínimas para mensajes de estado; sin dependencias del store. */
export const setCartStatusMessage = (
  target: HTMLElement | null,
  message: string,
  persistent = false,
  isError = false
): void => {
  if (!target) return;
  target.textContent = message;
  target.removeAttribute('hidden');
  target.toggleAttribute('data-persistent-message', persistent);
  target.toggleAttribute('data-status-error', isError);
  target.setAttribute('role', isError ? 'alert' : 'status');
  if (persistent || isError) target.setAttribute('tabindex', '-1');
  else target.removeAttribute('tabindex');
};

export const clearCartStatusMessage = (target: HTMLElement | null): void => {
  if (!target) return;
  target.textContent = '';
  target.setAttribute('hidden', '');
  target.removeAttribute('data-persistent-message');
  target.removeAttribute('data-status-error');
  target.setAttribute('role', 'status');
  target.removeAttribute('tabindex');
};
