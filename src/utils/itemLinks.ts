// src/utils/itemLinks.ts — item-name lookups linking the Crafting and Drops tabs.
import recipesData from "../data/recipes.json";
import dropsData from "../data/drops.json";
import shopsData from "../data/shops.json";
import guildShopsData from "../data/guildShops.json";
import helmData from "../data/helm.json";
import bcnmData from "../data/bcnm.json";
import fishData from "../data/fish.json";
import chocoboDigData from "../data/chocoboDig.json";
import cpItemsData from "../data/cpItems.json";

type RecipeLite = { res: { n: string }; hq: { n: string }[]; d?: number };
type DropsLite = {
  items: Record<string, { n: string }>;
  drops: Record<string, [number, number, number, number, number][]>;
};

// LSB recipe names that differ from the item's name in every other dataset.
const NAME_ALIASES: Record<string, string> = {
  "scarlet linen cloth": "scarlet linen",
  "smooth velvet cloth": "smooth velvet",
};

/**
 * "Square of Coeurl Leather" -> "coeurl leather": container prefixes,
 * apostrophes, periods and hyphens differ between datasets (LSB vs wiki).
 */
export function normalizeItemName(name: string): string {
  const norm = name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[a-z]+ of (?!the )/, "");
  return NAME_ALIASES[norm] ?? norm;
}

const craftableByNorm = new Map<string, string>();
for (const r of recipesData as RecipeLite[]) {
  if (r.d === 1) continue;
  const norm = normalizeItemName(r.res.n);
  if (!craftableByNorm.has(norm)) craftableByNorm.set(norm, r.res.n);
}
// HQ results (e.g. "Gold Earring +1") map to their base recipe's result name.
for (const r of recipesData as RecipeLite[]) {
  if (r.d === 1) continue;
  for (const h of r.hq) {
    const norm = normalizeItemName(h.n);
    if (!craftableByNorm.has(norm)) craftableByNorm.set(norm, r.res.n);
  }
}

const droppedByNorm = new Map<string, string>();
{
  const data = dropsData as unknown as DropsLite;
  const droppedIds = new Set<number>();
  for (const tuples of Object.values(data.drops)) {
    for (const t of tuples) if (t[3] > 0) droppedIds.add(t[3]);
  }
  for (const id of droppedIds) {
    const info = data.items[String(id)];
    if (!info) continue;
    const norm = normalizeItemName(info.n);
    if (!droppedByNorm.has(norm)) droppedByNorm.set(norm, info.n);
  }
}

/** Recipe-browser display name for the item, or null if it isn't craftable. */
export function craftSearchName(itemName: string): string | null {
  return craftableByNorm.get(normalizeItemName(itemName)) ?? null;
}

/** Drops-tab display name for the item, or null if no mob drops it. */
export function dropSearchName(itemName: string): string | null {
  return droppedByNorm.get(normalizeItemName(itemName)) ?? null;
}

// Items obtainable from any non-drop source (shops, guilds, BCNM, gathering,
// fishing, digging) — these all have rows in the Items tab too.
const otherSourceByNorm = new Map<string, string>();
{
  const addName = (n: string) => {
    const norm = normalizeItemName(n);
    if (!otherSourceByNorm.has(norm)) otherSourceByNorm.set(norm, n);
  };
  for (const r of shopsData as { n: string }[]) addName(r.n);
  for (const r of guildShopsData as { n: string }[]) addName(r.n);
  for (const r of helmData as { n: string }[]) addName(r.n);
  for (const r of cpItemsData as { n: string }[]) addName(r.n);
  for (const r of (chocoboDigData as { entries: { item: string }[] }).entries) addName(r.item);
  for (const r of fishData as { catch: string }[]) addName(r.catch);
  for (const bf of (bcnmData as { battlefields: { slots: { entries: { item: string | null }[] }[] }[] }).battlefields) {
    for (const slot of bf.slots) for (const le of slot.entries) if (le.item && le.item !== "Gil") addName(le.item);
  }
  // Craft results (NQ and HQ) all get synthetic Items-tab rows via itemSources
  for (const r of recipesData as RecipeLite[]) {
    if (r.d === 1) continue;
    addName(r.res.n);
    for (const h of r.hq) addName(h.n);
  }
}

/** Items-tab display name if the item is findable there (drops or any other source), else null. */
export function findableName(itemName: string): string | null {
  const norm = normalizeItemName(itemName);
  return droppedByNorm.get(norm) ?? otherSourceByNorm.get(norm) ?? null;
}
