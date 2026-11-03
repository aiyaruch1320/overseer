// Focus goes back to what opened a dialog when the dialog closes (a keyboard player would otherwise start again from the top of the page). The
// screens do not know each other: this watches the page for a layer that holds focus (`aria-modal`, the god's panel `.g-root`, the layers of
// Layers.tsx marked `data-return-focus`), remembers the element that was focused when it appeared, and gives focus back when it is gone.
import { useEffect } from 'preact/hooks';

const LAYER = '[aria-modal="true"], .g-root, [data-return-focus]';

const usable = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && el !== document.body && el.isConnected;

/** Starts the watch; the stop function ends it. Exported for a test with a DOM. */
export function watchFocusReturn(doc: Document = document): () => void {
  const openers = new Map<Element, HTMLElement | null>();
  // the last element a pointer or the keyboard worked on: a browser does not always focus a button that was clicked
  let last: HTMLElement | null = null;
  const note = (e: Event) => {
    const t = (e.target as Element | null)?.closest?.('button, a, [tabindex], input, select, textarea, summary') ?? null;
    if (usable(t)) last = t;
  };
  doc.addEventListener('focusin', note, true);
  doc.addEventListener('pointerdown', note, true);

  const scan = () => {
    const now = new Set(doc.querySelectorAll(LAYER));
    for (const el of now) {
      if (openers.has(el)) continue;
      const active = doc.activeElement;
      const from = usable(active) && !el.contains(active) ? active : usable(last) && !el.contains(last) ? last : null;
      openers.set(el, from);
    }
    for (const [el, from] of [...openers]) {
      if (now.has(el)) continue;
      openers.delete(el);
      // only when nothing else took the focus (the page lost it with the layer)
      const active = doc.activeElement;
      if (usable(from) && (!active || active === doc.body || !active.isConnected)) from.focus({ preventScroll: true });
    }
  };
  const mo = new MutationObserver(scan);
  mo.observe(doc.body, { childList: true, subtree: true });
  scan();
  return () => {
    mo.disconnect();
    doc.removeEventListener('focusin', note, true);
    doc.removeEventListener('pointerdown', note, true);
  };
}

export function useFocusReturn(): void {
  useEffect(() => watchFocusReturn(), []);
}
