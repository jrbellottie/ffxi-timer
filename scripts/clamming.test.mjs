import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const bundled = buildSync({ entryPoints: ["src/utils/clamming.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { clammingRates, clammingLossChance } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
test("clamming uses capacity tables and the committed low-column selection for both tides", () => {
  for (const capacity of [50, 100, 150, 200]) {
    const low = clammingRates(capacity, false);
    assert.ok(Math.abs(Object.values(low).reduce((sum, rate) => sum + rate, 0) - 100) < 1e-8);
    assert.deepEqual(clammingRates(capacity, true), low);
  }
  assert.notDeepEqual(clammingRates(50, false), clammingRates(150, false));
});
test("200-pz incidents precede overweight rolls and include the body reduction", () => {
  assert.equal(clammingLossChance(50, 0, false, false), 0);
  assert.equal(clammingLossChance(200, 0, false, false), 37);
  assert.equal(clammingLossChance(200, 0, false, true), 32);
  assert.ok(Math.abs(clammingLossChance(200, 200, false, true) - 100) < 1e-8);
});