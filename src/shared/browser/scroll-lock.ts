const activeLocks = new Set<string>();

interface ScrollLockSnapshot {
  scrollY: number;
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
}

let snapshot: ScrollLockSnapshot | null = null;

export const lockBodyScroll = (owner: string): void => {
  if (activeLocks.has(owner)) return;

  if (activeLocks.size === 0) {
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    snapshot = {
      scrollY: window.scrollY,
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      bodyPaddingRight: document.body.style.paddingRight,
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${snapshot.scrollY}px`;
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      const paddingRight = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
    }
  }

  activeLocks.add(owner);
};

export const unlockBodyScroll = (owner: string): void => {
  activeLocks.delete(owner);
  if (activeLocks.size > 0 || !snapshot) return;

  const previous = snapshot;
  snapshot = null;
  document.documentElement.style.overflow = previous.htmlOverflow;
  document.body.style.overflow = previous.bodyOverflow;
  document.body.style.position = previous.bodyPosition;
  document.body.style.top = previous.bodyTop;
  document.body.style.width = previous.bodyWidth;
  document.body.style.paddingRight = previous.bodyPaddingRight;
  window.scrollTo(0, previous.scrollY);
};
