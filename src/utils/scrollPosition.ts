type PanelPosition = { path: number[]; left: number; top: number };
export type ScrollPosition = { left: number; top: number; panels: PanelPosition[] };

let cancelRestore: (() => void) | undefined;

export function captureScrollPosition(): ScrollPosition {
  cancelRestore?.();
  const root = document.querySelector("[data-scroll-root]");
  const panels: PanelPosition[] = [];
  if (root) {
    for (const element of root.querySelectorAll<HTMLElement>("*")) {
      const style = getComputedStyle(element);
      if (!/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
      const path: number[] = [];
      let current: Element = element;
      while (current !== root && current.parentElement) {
        path.unshift(Array.prototype.indexOf.call(current.parentElement.children, current));
        current = current.parentElement;
      }
      panels.push({ path, left: element.scrollLeft, top: element.scrollTop });
    }
  }
  return { left: window.scrollX, top: window.scrollY, panels };
}

export function restoreScrollPosition(position: ScrollPosition) {
  cancelRestore?.();
  let frame = 0;
  let observer: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  const root = document.querySelector("[data-scroll-root]");
  const stop = () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    resize?.disconnect();
    root?.removeEventListener("load", schedule, true);
    clearTimeout(deadline);
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.removeEventListener(event, stop, true);
    if (cancelRestore === stop) cancelRestore = undefined;
  };
  const apply = () => {
    const root = document.querySelector("[data-scroll-root]");
    if (!root) return;
    for (const panel of position.panels) {
      let element: Element | undefined = root;
      for (const index of panel.path) element = element?.children[index];
      if (element instanceof HTMLElement) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) {
          element.scrollTo({ left: panel.left, top: panel.top, behavior: "instant" });
          resize?.observe(element);
        }
      }
    }
    window.scrollTo({ left: position.left, top: position.top, behavior: "instant" });
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  };
  const deadline = window.setTimeout(stop, 3000);
  cancelRestore = stop;
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(event, stop, { capture: true, passive: true });
  observer = new MutationObserver(schedule);
  root?.addEventListener("load", schedule, true);
  if (root) observer.observe(root, { childList: true, subtree: true });
  resize = new ResizeObserver(schedule);
  resize.observe(document.body);
  schedule();
}