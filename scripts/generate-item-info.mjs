import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSql, displayName, normalizeName } from "./lib/item-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkout = path.resolve(process.argv[2] ?? path.join(root, ".lsb-server"));
const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const revision = git("rev-parse", "HEAD").trim();
const hashes = {};
const source = (filename) => {
  const text = git("show", `${revision}:${filename}`);
  hashes[filename] = createHash("sha256").update(text).digest("hex");
  return text;
};
const read = (table) => parseSql(source(`sql/${table}.sql`), table);
const basic = read("item_basic");
const equipment = new Map(read("item_equipment").map((row) => [row.itemId, row]));
const weapons = new Map(read("item_weapon").map((row) => [row.itemId, row]));
const usable = new Map(read("item_usable").map((row) => [row.itemid, row]));
const furnishing = new Map(read("item_furnishing").map((row) => [row.itemid, row]));
const latentSql = source("sql/item_latents.sql");
const latentNotes = new Map([...latentSql.matchAll(/^INSERT INTO `item_latents` VALUES \(([^)]+)\);\s*--\s*(.*)/gm)].map((match) => [match[1], match[2].trim()]));
const latents = new Map();
for (const row of parseSql(latentSql, "item_latents")) {
  if (!latents.has(row.itemId)) latents.set(row.itemId, []);
  latents.get(row.itemId).push({ mod: row.modId, value: row.value, condition: row.latentId, param: row.latentParam, note: latentNotes.get(Object.values(row).join(",")) ?? "" });
}
const modifierSql = source("sql/item_mods.sql");
const modifierNames = {};
for (const match of modifierSql.matchAll(/VALUES \(\d+,(\d+),-?\d+\);\s*--\s*([A-Z][A-Z\d_]+):/g)) modifierNames[match[1]] = match[2];
const modifiers = new Map();
for (const row of parseSql(modifierSql, "item_mods")) {
  if (!modifiers.has(row.itemId)) modifiers.set(row.itemId, []);
  modifiers.get(row.itemId).push([row.modId, row.value]);
}
const requested = new Set();
const collect = (value) => {
  if (typeof value === "string" && value.length < 100) requested.add(normalizeName(value));
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
};
for (const file of ["drops", "recipes", "shops", "guildShops", "helm", "bcnm", "fish", "bait", "rods", "chocoboDig", "cpItems"]) collect(JSON.parse(readFileSync(path.join(root, "src/data", `${file}.json`), "utf8")));
const aliases = new Map();
const addAlias = (name, id) => {
  const key = normalizeName(name);
  if (!aliases.has(key)) aliases.set(key, new Set());
  aliases.get(key).add(id);
};
for (const row of basic) {
  addAlias(displayName(row.name), row.itemid);
  addAlias(displayName(row.sortname), row.itemid);
}
const recipeSnapshot = readFileSync(path.join(root, "scripts/lsb-data/synth_recipes.sql"), "utf8");
hashes["recipe-alias-snapshot/synth_recipes.sql"] = createHash("sha256").update(recipeSnapshot).digest("hex");
const synth = new Map(parseSql(recipeSnapshot, "synth_recipes").map((row) => [Number(Object.values(row)[0]), Object.values(row)]));
const recipes = JSON.parse(readFileSync(path.join(root, "src/data/recipes.json"), "utf8"));
for (const recipe of recipes) {
  const row = synth.get(recipe.id);
  if (!row) continue;
  addAlias(recipe.res.n, row[21]);
  recipe.hq.forEach((item, tier) => addAlias(item.n, row[22 + tier]));
}
const names = {};
for (const [name, ids] of aliases) if (requested.has(name) && ids.size === 1) names[name] = [...ids][0];
const wanted = new Set(Object.values(names));
const items = {};
const dropNames = JSON.parse(readFileSync(path.join(root, "src/data/drops.json"), "utf8")).items;
for (const row of basic) {
  if (!wanted.has(row.itemid)) continue;
  const equip = equipment.get(row.itemid);
  const weapon = weapons.get(row.itemid);
  items[row.itemid] = {
    name: dropNames[row.itemid]?.n ?? displayName(row.name), stack: row.stackSize, sell: row.BaseSell, flags: row.flags, category: row.aH,
    ...(equip ? { equipment: { level: equip.level, itemLevel: equip.ilevel, jobs: equip.jobs, slots: equip.slot, shieldSize: equip.shieldSize } } : {}),
    ...(weapon ? { weapon: { skill: weapon.skill, damage: weapon.dmg, delay: weapon.delay, damageType: weapon.dmgType, hits: weapon.hit } } : {}),
    ...(modifiers.has(row.itemid) ? { modifiers: modifiers.get(row.itemid) } : {}),
    ...(usable.has(row.itemid) ? { usable: usable.get(row.itemid) } : {}),
    ...(furnishing.has(row.itemid) ? { furnishing: furnishing.get(row.itemid) } : {}),
    ...(latents.has(row.itemid) ? { latents: latents.get(row.itemid) } : {}),
  };
}
const output = { source: { repository: "LandSandBoat/server", revision, inputs: hashes }, names, modifierNames, items };
mkdirSync(path.join(root, "src/data"), { recursive: true });
writeFileSync(path.join(root, "src/data/itemInfo.json"), JSON.stringify(output));
console.log(`Item metadata: ${Object.keys(items).length} IDs, ${Object.keys(names).length} aliases; source ${revision}`);
for (const name of ["Piccolo", "Piccolo +1", "Holly Lumber"]) console.log(name, items[names[normalizeName(name)]]);