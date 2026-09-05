// src/utils/tabNav.ts — cross-tab navigation (Crafting <-> Drops item links).

import { captureScrollPosition, restoreScrollPosition, type ScrollPosition } from "./scrollPosition";

type BackEntry = { tab: string; seq: number; scroll: ScrollPosition; state: unknown };

let switchTab: ((tab: string) => void) | null = null;
let pending: { tab: string; query: string; recipeId?: number } | null = null;
let seq = 0;
const backStack: BackEntry[] = [];
const tabPositions = new Map<string, ScrollPosition>();
const tabStates = new Map<string, unknown>();
let restoredState: { tab: string; state: unknown } | null = null;

export function rememberTabState(tab: string, state: unknown) {
  tabStates.set(tab, state);
}

export function peekRestoredTabState<State>(tab: string): State | undefined {
  return restoredState?.tab === tab ? restoredState.state as State | undefined : undefined;
}

export function switchTabWithScroll(from: string, to: string) {
  if (from === to) return;
  tabPositions.set(from, captureScrollPosition());
  clearTabNav();
  restoredState = { tab: to, state: tabStates.get(to) };
  switchTab?.(to);
  restoreScrollPosition(tabPositions.get(to) ?? { left: 0, top: 0, panels: [] });
}

export function registerTabSwitcher(fn: (tab: string) => void) {
  switchTab = fn;
}

/** Monotonic counter shared with in-tab history so back-steps interleave in true order. */
export function nextNavSeq(): number {
  return ++seq;
}

/** Switch to `tab` searching for `query`; `from` is pushed on the cross-tab back stack. */
export function navigateToTab(tab: string, query: string, from: string, recipeId?: number) {
  const scroll = captureScrollPosition();
  tabPositions.set(from, scroll);
  backStack.push({ tab: from, seq: ++seq, scroll, state: tabStates.get(from) });
  restoredState = null;
  pending = { tab, query, recipeId };
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
  const entry = backStack.pop();
  if (entry) {
    if (pending) tabPositions.set(pending.tab, captureScrollPosition());
    pending = null;
    restoredState = { tab: entry.tab, state: entry.state };
    switchTab?.(entry.tab);
    restoreScrollPosition(entry.scroll);
  }
}

/** Manual tab switches reset cross-tab navigation. */
export function clearTabNav() {
  pending = null;
  restoredState = null;
  backStack.length = 0;
}
