import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseSql, normalizeName, displayName } from "./lib/item-data.mjs";
import { buildSync } from "esbuild";

const catalog = JSON.parse(readFileSync(new URL("../src/data/itemInfo.json", import.meta.url), "utf8"));
const wiki = JSON.parse(readFileSync(new URL("../src/data/itemWiki.json", import.meta.url), "utf8"));
const purification = JSON.parse(readFileSync(new URL("../src/data/purification.json", import.meta.url), "utf8"));
test("crystal family lists match bundled ToAU element assignments", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/crystalFamilies.json", import.meta.url), "utf8"));
  const bestiary = JSON.parse(readFileSync(new URL("../src/data/bestiary.json", import.meta.url), "utf8"));
  const elements = ["fire", "ice", "wind", "earth", "thunder", "water", "light", "dark"];
  assert.equal(data.source.bestiaryRevision, bestiary.source.revision);
  assert.equal(Object.keys(data.crystals).length, 8);
  for (const [index, element] of elements.entries()) {
    const crystal = data.crystals[4096 + index];
    const expected = [...new Set(bestiary.monsters.filter((monster) => monster.era === "TOAU" && monster.element === element).map((monster) => displayName(monster.family)))].sort();
    assert.deepEqual(crystal.families, expected);
    assert.ok(crystal.families.length > 0);
    assert.equal(catalog.names[normalizeName(crystal.name)], 4096 + index);
  }
  assert.ok(data.crystals[4096].families.includes("Orc"));
  assert.ok(data.crystals[4099].families.includes("Rabbit"));
  assert.ok(data.crystals[4100].families.includes("Coeurl"));
  assert.equal(data.crystals[4100].name, "Lightning Crystal");
});
test("abjuration mob sources use era drops and deduplicate repeated spawns", async () => {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL("../src/utils/abjurationDrops.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
  const { abjurationMobs } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
  const mobs = abjurationMobs(catalog.names[normalizeName("Earthen Abjuration: Body")]);
  assert.ok(mobs.includes("Nidhogg"));
  assert.equal(mobs.length, new Set(mobs).size);
  assert.deepEqual(abjurationMobs(-1), []);
  const missing = [...new Set(purification.exchanges.map(([, abjuration]) => abjuration))]
    .filter((name) => abjurationMobs(catalog.names[normalizeName(name)]).length === 0);
  assert.deepEqual(missing, [], "Every required abjuration should have a recorded mob source");
});
test("purification items have local metadata, descriptions and paired images", () => {
  const missing = [];
  for (const [cursed, abjuration, result, hq] of purification.exchanges) {
    for (const name of [cursed, result, ...(hq ? [`${cursed} -1`, hq] : [])]) {
      const id = catalog.names[normalizeName(name)];
      const entry = wiki.items[id];
      if (!catalog.items[id] || !entry?.image || entry.status !== "ok") missing.push(`${name}: ${id}, ${entry?.status}, ${entry?.image ?? "no image"}`);
    }
    const id = catalog.names[normalizeName(abjuration)];
    if (!catalog.items[id] || wiki.items[id]?.status !== "ok") missing.push(`${abjuration}: missing local details`);
  }
  assert.deepEqual(missing, []);
});
test("purification lookup normalizes item labels and searches rewards and abjurations", async () => {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL("../src/utils/purification.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
  const { getPurification, getPurificationOrigin, purificationMatches } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
  assert.deepEqual(getPurificationOrigin("Adaman Sollerets"), { cursed: "Cursed Sollerets", abjuration: "Earthen Abjuration: Feet" });
  assert.equal(getPurificationOrigin("Armada Sollerets").cursed, "Cursed Sollerets -1");
  assert.equal(getPurification("Cursed Hauberk -1").result, "Armada Hauberk");
  assert.equal(getPurification("Cursed Sune Ate -1").result, "Shura Sune-Ate +1");
  assert.equal(getPurification("Cursed Cuisses (desynth)").result, "Crimson Cuisses");
  assert.equal(getPurification("Bowl of Cursed Soup").result, "Ambrosia");
  assert.equal(getPurification("Bronze Sword"), undefined);
  assert.equal(purificationMatches("Cursed Hauberk -1", "armada"), true);
  assert.equal(purificationMatches("Cursed Hauberk", "earthen abjuration"), true);
  assert.equal(purificationMatches("Cursed Hauberk", "armada"), false);
  assert.equal(purificationMatches("Bronze Sword", "armada"), false);
});
test("every cursed recipe output has a distinct NQ/HQ purification mapping", () => {
  const exchanges = new Map();
  for (const [cursed, abjuration, result, hq] of purification.exchanges) {
    assert.match(abjuration, /Abjuration/);
    assert.ok(result);
    assert.ok(!exchanges.has(normalizeName(cursed)), `Duplicate ${cursed}`);
    exchanges.set(normalizeName(cursed), { abjuration, result });
    if (hq) {
      assert.notEqual(result, hq);
      exchanges.set(normalizeName(`${cursed} -1`), { abjuration, result: hq });
    }
  }
  assert.equal(exchanges.size, 82);
  const recipes = JSON.parse(readFileSync(new URL("../src/data/recipes.json", import.meta.url), "utf8"));
  for (const recipe of recipes) {
    if (recipe.d === 1) continue;
    for (const item of [recipe.res, ...recipe.hq]) {
      if (/\bcursed\b/i.test(item.n)) assert.ok(exchanges.has(normalizeName(item.n)), `Missing ${item.n}`);
    }
  }
  assert.equal(exchanges.get(normalizeName("Cursed Hauberk")).result, "Adaman Hauberk");
  assert.equal(exchanges.get(normalizeName("Cursed Hauberk -1")).result, "Armada Hauberk");
  assert.equal(exchanges.get(normalizeName("Cursed Cuisses")).result, "Crimson Cuisses");
  assert.equal(exchanges.get(normalizeName("Cursed Cuishes")).result, "Shadow Cuishes");
  assert.equal(exchanges.get(normalizeName("Bottle of Cursed Beverage")).result, "Amrita");
});
test("SQL reader decodes quotes, NULL, variables and flag masks without execution", () => {
  const sql = "SET @FLAG = 4;\nCREATE TABLE IF NOT EXISTS `items` (\n `id` int,\n `name` text,\n `flags` int,\n `optional` int\n);\nINSERT INTO `items` VALUES (1,'Bob''s \\'rod\\'',@FLAG | 8,NULL);";
  assert.deepEqual(parseSql(sql, "items"), [{ id: 1, name: "Bob's 'rod'", flags: 12, optional: null }]);
  assert.throws(() => parseSql(sql.replace("@FLAG | 8", "@UNKNOWN"), "items"), /Unsupported SQL row/);
});
test("Piccolo and its HQ keep distinct IDs and effects", () => {
  const normal = catalog.names[normalizeName("Piccolo")];
  const highQuality = catalog.names[normalizeName("Piccolo +1")];
  assert.notEqual(normal, highQuality);
  assert.equal(catalog.items[normal].equipment.level, 9);
  assert.equal(catalog.items[normal].equipment.jobs, 512);
  assert.ok(catalog.items[normal].modifiers.some(([modifier, value]) => modifier === 437 && value === 1));
  assert.ok(catalog.items[highQuality].modifiers.some(([modifier, value]) => modifier === 437 && value === 2));
  assert.match(wiki.items[highQuality].notes, /STR\+1/);
});
test("wiki descriptions, nested armor stats and food caps are preserved", () => {
  assert.equal(wiki.items[catalog.names[normalizeName("Piece of Holly Lumber")]].description, "Processed holly lumber.");
  const armor = wiki.items[catalog.names[normalizeName("Dusk Gloves +1")]];
  assert.match(armor.fields.bonuses, /haste \+4%/i);
  const food = wiki.items[catalog.names[normalizeName("Meat Mithkabob")]];
  assert.match(food.fields.bonuses, /Attack \+22% \(cap 60\)/);
  assert.equal(food.fields.duration, "30 minutes");
});
test("catalog aliases and cached image references are valid", () => {
  for (const id of Object.values(catalog.names)) assert.ok(catalog.items[id], `Unknown item ID ${id}`);
  for (const [id, entry] of Object.entries(wiki.items)) {
    assert.ok(catalog.items[id], `Wiki item ${id} not in catalog`);
    if (entry.image) {
      assert.match(entry.image, /^items\/\d+\.(png|webp)$/);
      assert.ok(existsSync(new URL(`../public/${entry.image}`, import.meta.url)), `Missing image ${entry.image}`);
    }
  }
});