import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const snapshot = JSON.parse(readFileSync("src/data/phoenix.json", "utf8"));
const bundle = buildSync({ stdin: { contents: 'export * from "./src/utils/printingData"; export * from "./src/utils/phoenixData"; export * from "./src/utils/priceCatalog"; export * from "./src/utils/itemSources"; export { CLAM_ITEM_NAMES } from "./src/ClamTab";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm" });
const data = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("Phoenix source is pinned with economic values and stack changes shared by consumers", () => {
  assert.equal(snapshot.source.revision, "ace1415cf5643d8d45ff72067522d97f2ccb038f");
  for (const hash of Object.values(snapshot.source.inputs)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(data.printSellPrice("Black Ink", {}), 298);
  assert.equal(data.printItem("Gysahl Greens").stack, 12);
  assert.equal(data.printItem("Fire Cluster").stack, 1);
  for (const [id, item] of Object.entries(snapshot.items)) {
    assert.equal(data.catalogData.items[id].sell, item.sell);
    assert.equal(data.catalogData.items[id].stack, item.stack);
    assert.equal(data.printSellPrice(id, { [id]: 12345 }), 12345);
  }
});
test("automatic guild offers exclude empty non-restocking stock and retain verified stocked offers", () => {
  for (const offer of snapshot.guildOffers) {
    const active = data.shopsData.some(row => row.npc === offer.npc && row.n === offer.n && row.zone === offer.zone);
    assert.equal(active, offer.stocked, `${offer.npc}: ${offer.n}`);
  }
  assert.equal(snapshot.valerianoOffers.length, 24);
  assert.equal(data.shopsData.filter(row => row.npc === "Valeriano").length, 24);
});
test("Phoenix fish caps propagate to every bundled fishing surface", () => {
  for (const [name, cap] of [["Lik", 140], ["Gugrusaurus", 140], ["Ryugu Titan", 150], ["Cave Cherax", 130], ["Titanic Sawfish", 125]]) {
    assert.equal(data.phoenixFish[name].skillCap, cap);
    for (const row of data.fishData.filter(row => row.catch === name)) assert.equal(row.lvl, cap);
    for (const row of data.rodFishData.filter(row => row.fish === name)) assert.equal(row.skillCap, cap);
    for (const row of data.baitData.filter(row => row.fish === name)) assert.equal(row.lvl, cap);
  }
});
test("digging covers enabled layers, ore prices, and clamming aliases resolve to source item IDs", () => {
  assert.equal(new Set(snapshot.digging.entries.map(row => row.zone)).size, 26);
  assert.deepEqual(new Set(snapshot.digging.entries.map(row => row.layer)), new Set(["regular", "treasure", "burrow", "bore"]));
  for (const name of ["Fire Ore", "Dark Ore", "Translucent Rock"]) assert.equal(data.PRICE_CATALOG.find(row => row.key === data.printItemKey(name))?.digging, true);
  const clams = new Set(data.CLAM_ITEM_NAMES.map(data.printItemKey));
  for (const id of Object.keys(snapshot.clamming.itemData)) assert.ok(clams.has(id), `Missing clamming item ${id}`);
});
test("era HELM removes out-of-era items and normalizes fresh-pool weights", () => {
  const removed = [["Eastern Ginger Root", "Wajaom Woodlands"], ["Eastern Ginger Root", "Bhaflau Thickets"], ["Aquilaria Log", "Yhoator Jungle"], ["Aquilaria Log", "Yuhtunga Jungle"], ["Kapor Log", "Yhoator Jungle"], ["Butterpear", "Yhoator Jungle"], ["Sprig of Dyer's Woad", "Giddeus"], ["Sprig of Dyer's Woad", "West Sarutabaruta"]];
  for (const [name, zone] of removed) assert.ok(!snapshot.helm.some(row => row.n === name && row.zone === zone));
  const totals = new Map();
  for (const row of snapshot.helm) totals.set(`${row.kind}|${row.zone}`, (totals.get(`${row.kind}|${row.zone}`) ?? 0) + row.pct);
  for (const total of totals.values()) assert.ok(Math.abs(total - 100) < 1e-8);
});