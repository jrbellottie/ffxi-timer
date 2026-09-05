import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseSql, normalizeName } from "./lib/item-data.mjs";

const catalog = JSON.parse(readFileSync(new URL("../src/data/itemInfo.json", import.meta.url), "utf8"));
const wiki = JSON.parse(readFileSync(new URL("../src/data/itemWiki.json", import.meta.url), "utf8"));
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