// src/utils/tabNav.ts — cross-tab navigation (Crafting <-> Drops item links).

type BackEntry = { tab: string; seq: number };

let switchTab: ((tab: string) => void) | null = null;
let pending: { tab: string; query: string; recipeId?: number } | null = null;
let seq = 0;
const backStack: BackEntry[] = [];

export function registerTabSwitcher(fn: (tab: string) => void) {
  switchTab = fn;
}

/** Monotonic counter shared with in-tab history so back-steps interleave in true order. */
export function nextNavSeq(): number {
  return ++seq;
}

/** Switch to `tab` searching for `query`; `from` is pushed on the cross-tab back stack. */
export function navigateToTab(tab: string, query: string, from: string, recipeId?: number) {
  pending = { tab, query, recipeId };
  backStack.push({ tab: from, seq: ++seq });
  switchTab?.(tab);
}

/** Non-destructive read (safe under StrictMode double-mount); cleared by back/manual navigation. */
export function peekNavQuery(tab: string): string | null {
  return pending && pending.tab === tab ? pending.query : null;
}

export function peekNavRecipeId(): number | undefined {
  return pending?.tab === "crafting" ? pending.recipeId : undefined;
}

/** Seq of the most recent cross-tab navigation, or -1 if the stack is empty. */
export function peekBackTabSeq(): number {
  return backStack.length > 0 ? backStack[backStack.length - 1].seq : -1;
}

export function hasBackTab(): boolean {
  return backStack.length > 0;
}

export function goBackTab() {
  pending = null;
  const entry = backStack.pop();
  if (entry) switchTab?.(entry.tab);
}

/** Manual tab switches reset cross-tab navigation. */
export function clearTabNav() {
  pending = null;
  backStack.length = 0;
}
