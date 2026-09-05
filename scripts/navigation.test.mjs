import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function navigation() {
  let position = { left: 160, top: 180, panels: [{ path: [0, 2], left: 50, top: 1200 }] };
  let restored;
  let activeTab = "crafting";
  const exports = {};
  const source = readFileSync(new URL("../src/utils/tabNav.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require: () => ({
      captureScrollPosition: () => position,
      restoreScrollPosition: (next) => { restored = next; },
    }),
  });
  exports.registerTabSwitcher((tab) => { activeTab = tab; });
  return {
    nav: exports,
    get activeTab() { return activeTab; },
    get restored() { return restored; },
    get position() { return position; },
    set position(next) { position = next; },
  };
}

test("Back restores each visit's filters, expanded row, and both scroll axes", () => {
  const session = navigation();
  const { nav } = session;
  const originalState = { ui: { rResult: "", mode: "recipes" }, selectedRowKey: "recipes|123" };
  const originalPosition = session.position;
  nav.rememberTabState("crafting", originalState);
  nav.navigateToTab("drops", "Stone Arrowheads", "crafting");
  const itemState = { ui: { itemQuery: "Stone Arrowheads" }, openRow: 0 };
  nav.rememberTabState("drops", itemState);
  session.position = { left: 0, top: 40, panels: [] };
  const itemPosition = session.position;
  nav.navigateToTab("crafting", "Stone Arrow", "drops", 456);
  assert.equal(nav.peekNavRecipeId(), 456);
  nav.rememberTabState("crafting", { ui: { rResult: "Stone Arrow" }, selectedRowKey: null });
  nav.goBackTab();
  assert.equal(session.activeTab, "drops");
  assert.equal(nav.peekRestoredTabState("drops"), itemState);
  assert.equal(session.restored, itemPosition);
  assert.equal(nav.peekNavQuery("crafting"), null);
  nav.goBackTab();
  assert.equal(session.activeTab, "crafting");
  assert.equal(nav.peekRestoredTabState("crafting"), originalState);
  assert.equal(session.restored, originalPosition);
  assert.equal(nav.hasBackTab(), false);
});

test("manual tab return restores a position captured by an item link", () => {
  const session = navigation();
  const { nav } = session;
  const originalPosition = session.position;
  nav.navigateToTab("drops", "Stone Arrowheads", "crafting");
  session.position = { left: 0, top: 30, panels: [] };
  nav.switchTabWithScroll("drops", "crafting");
  assert.equal(session.activeTab, "crafting");
  assert.equal(session.restored, originalPosition);
  assert.equal(nav.hasBackTab(), false);
  assert.equal(nav.peekNavQuery("drops"), null);
});

test("new links discard restoration state and preserve navigation sequence ordering", () => {
  const { nav } = navigation();
  nav.rememberTabState("crafting", { selectedRowKey: "recipes|123" });
  nav.navigateToTab("drops", "Stone Arrowheads", "crafting");
  const crossTabSeq = nav.peekBackTabSeq();
  assert.ok(nav.nextNavSeq() > crossTabSeq);
  nav.goBackTab();
  assert.ok(nav.peekRestoredTabState("crafting"));
  nav.navigateToTab("drops", "Flint Stone", "crafting");
  assert.equal(nav.peekRestoredTabState("crafting"), undefined);
  assert.equal(nav.peekNavQuery("drops"), "Flint Stone");
});