import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function loadUtility(name) {
  const source = readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const craft = await loadUtility("craftingSkillup");
const fishing = await loadUtility("fishingSkillup");

test("era crafting thresholds at 50 and 60", () => {
  assert.equal(craft.eraSkillupChance(499), 0.6);
  assert.equal(craft.eraSkillupChance(500), 0.25);
  assert.ok(craft.averageGainPerSkillup(599, 14) > 0.1);
  assert.equal(craft.averageGainPerSkillup(600, 14), 0.1);
});
test("era crafting cap and 15-level eligibility window", () => {
  assert.equal(craft.craftSkillupStats(500, 50, false).eligible, false);
  assert.equal(craft.craftSkillupStats(350, 50, false).craftable, true);
  assert.equal(craft.craftSkillupStats(349, 50, false).craftable, false);
  assert.equal(craft.craftSkillupStats(350, 50, false).chanceOnSuccessPct, 60);
});
test("broken synth skill-up window and desynthesis penalty", () => {
  assert.equal(craft.craftSkillupStats(450, 50, false).chanceOnFailPct, 30);
  assert.equal(craft.craftSkillupStats(440, 50, false).chanceOnFailPct, 0);
  assert.equal(craft.craftSkillupStats(450, 50, true).chanceOnSuccessPct, 30);
  assert.ok(Math.abs(craft.craftSkillupStats(450, 50, true).chanceOnFailPct - 20) < 1e-10);
});
test("support changes completion but not raw skill-up rolls", () => {
  const base = craft.craftSkillupStats(440, 50, false);
  const supported = craft.craftSkillupStats(440, 50, false, 3);
  assert.ok(supported.successPct > base.successPct);
  assert.equal(supported.chanceOnFailPct, 0);
  assert.equal(supported.chanceOnSuccessPct, base.chanceOnSuccessPct);
  assert.equal(supported.avgGain, base.avgGain);
  assert.equal(craft.craftSkillupStats(500, 50, false, 0, 1).successPct, 95 * 0.95);
});
test("neutral fishing eligibility window and base-skill truncation", () => {
  assert.equal(fishing.calculateSkillup(50, 50, "Selbina", "Composite Fishing Rod").eligible, false);
  assert.equal(fishing.calculateSkillup(50, 100, "Selbina", "Composite Fishing Rod").eligible, true);
  assert.equal(fishing.calculateSkillup(50, 101, "Selbina", "Composite Fishing Rod").eligible, false);
  assert.deepEqual(fishing.calculateSkillup(50.9, 61, "Selbina", "Composite Fishing Rod"), fishing.calculateSkillup(50, 61, "Selbina", "Composite Fishing Rod"));
});
test("neutral fishing city and Lu Shang penalties", () => {
  const city = fishing.calculateSkillup(40, 51, "Selbina", "Composite Fishing Rod");
  const outside = fishing.calculateSkillup(40, 51, "Buburimu Peninsula", "Composite Fishing Rod");
  const luShang = fishing.calculateSkillup(40, 51, "Selbina", "Lu Shang's Fishing Rod");
  assert.ok(Math.abs(city.chancePct - 100 * 17 / 83) < 1e-10);
  assert.ok(outside.chancePct > city.chancePct);
  assert.ok(luShang.chancePct < city.chancePct);
  assert.ok(Math.abs(city.expectedGainPerTargetHook - city.chancePct / 100 * 0.10625) < 1e-10);
});