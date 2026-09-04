// Scratch: list recipe ingredients/results with no link target (not craftable, not in any Items-tab source).
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), "utf8"));
const recipes = read("recipes.json");
const drops = read("drops.json");
const shops = read("shops.json");
const guildShops = read("guildShops.json");
const helm = read("helm.json");
const bcnm = read("bcnm.json");
const fish = read("fish.json");
const dig = read("chocoboDig.json");
const cp = read("cpItems.json");

const ALIASES = { "scarlet linen cloth": "scarlet linen", "smooth velvet cloth": "smooth velvet" };
const norm = (n) => {
  const s = n
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[a-z]+ of (?!the )/, "");
  return ALIASES[s] ?? s;
};

const craftable = new Set(recipes.map((r) => norm(r.res.n)));
for (const r of recipes) if (r.d !== 1) for (const h of r.hq) craftable.add(norm(h.n));
const found = new Set();
{
  const droppedIds = new Set();
  for (const tuples of Object.values(drops.drops)) for (const t of tuples) if (t[3] > 0) droppedIds.add(t[3]);
  for (const id of droppedIds) {
    const info = drops.items[String(id)];
    if (info) found.add(norm(info.n));
  }
}
for (const r of shops) found.add(norm(r.n));
for (const r of guildShops) found.add(norm(r.n));
for (const r of helm) found.add(norm(r.n));
for (const r of cp) found.add(norm(r.n));
for (const r of dig.entries) found.add(norm(r.item));
for (const r of fish) found.add(norm(r.catch));
for (const bf of bcnm.battlefields)
  for (const slot of bf.slots) for (const le of slot.entries) if (le.item && le.item !== "Gil") found.add(norm(le.item));

const unlinked = new Map(); // norm -> { name, asIngredient, asResult }
for (const r of recipes) {
  for (const i of r.ing) {
    const n = norm(i.n);
    if (craftable.has(n) || found.has(n)) continue;
    const e = unlinked.get(n) ?? { name: i.n, ing: 0, res: 0 };
    e.ing++;
    unlinked.set(n, e);
  }
  {
    const n = norm(r.res.n);
    if (!found.has(n)) {
      const e = unlinked.get(n) ?? { name: r.res.n, ing: 0, res: 0 };
      e.res++;
      unlinked.set(n, e);
    }
  }
}

const rows = [...unlinked.values()].sort((a, b) => b.ing - a.ing || a.name.localeCompare(b.name));
console.log(`unlinked unique names: ${rows.length}`);
for (const r of rows) console.log(`${String(r.ing).padStart(4)} ing ${String(r.res).padStart(4)} res  ${r.name}`);
