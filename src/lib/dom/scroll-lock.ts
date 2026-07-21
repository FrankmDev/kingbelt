const activeLocks = new Set<string>();
let previousOverflow = '';

export const lockBodyScroll = (owner: string): void => {
  if (activeLocks.has(owner)) return;

  if (activeLocks.size === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  activeLocks.add(owner);
};

export const unlockBodyScroll = (owner: string): void => {
  activeLocks.delete(owner);

  if (activeLocks.size === 0) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = '';
  }
};
