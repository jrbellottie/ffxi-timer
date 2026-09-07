import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
const bundle = buildSync({ entryPoints: ["src/utils/digging.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { nextDigReset, digRollChance, digLayerChances, diggingDistribution, diggingExtras, ORE_ZONES } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
test("digging reset is the next midnight JST, independent of local timezone", () => {
  assert.equal(nextDigReset(Date.parse("2026-09-05T14:59:59Z")), Date.parse("2026-09-05T15:00:00Z"));
  assert.equal(nextDigReset(Date.parse("2026-09-05T15:00:00Z")), Date.parse("2026-09-06T15:00:00Z"));
});

test("digging rolls reproduce integer moon thresholds and choose one candidate per layer", () => {
  close(digRollChance(10, 25), 0.1);
  close(digRollChance(10, 0), 0.201);
  close(digRollChance(10, 50), 0.067);
  assert.deepEqual(digLayerChances([1, 1]), [0.5, 0.5]);
  const result = diggingDistribution([{ item: "first", rate: 10, layer: "regular" }, { item: "second", rate: 10, layer: "regular" }], 25);
  close(result.successChance, 0.19);
  close(result.rewards[0], 0.095);
  close(result.expectedItems, 0.19);
});

test("treasure suppresses other layers and fatigue counts successful attempts, not items", () => {
  const result = diggingDistribution([{ item: "treasure", rate: 50, layer: "treasure" }, { item: "regular", rate: 100, layer: "regular" }, { item: "burrow", rate: 100, layer: "burrow" }], 25);
  close(result.successChance, 1);
  close(result.expectedItems, 1.5);
  assert.deepEqual(result.rewards, [0.5, 0.5, 0.5]);
});

test("ore needs Craftsman, elemental weather, 7-21 percent moon, and an eligible zone; element follows day", () => {
  assert.equal(ORE_ZONES.length, 9);
  const extras = (zone = ORE_ZONES[0], rank = 6, moon = 7, weather = "Ice Crystal") => diggingExtras(zone, rank, moon, "Firesday", weather);
  assert.deepEqual(extras().map(item => item.item), ["Ice Crystal", "Red Rock", "Fire Ore"]);
  assert.ok(extras(undefined, 6, 21).some(item => item.item === "Fire Ore"));
  for (const rows of [extras(undefined, 5), extras(undefined, 6, 6), extras(undefined, 6, 22), extras(undefined, 6, 7, ""), extras("Valkurm Dunes")]) assert.ok(!rows.some(item => item.item === "Fire Ore"));
  assert.equal(extras(undefined, 2).length, 1);
});