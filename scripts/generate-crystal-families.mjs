import { readFileSync, writeFileSync } from "node:fs";
import { displayName } from "./lib/item-data.mjs";

const bestiary = JSON.parse(readFileSync(new URL("../src/data/bestiary.json", import.meta.url), "utf8"));
const elements = ["fire", "ice", "wind", "earth", "lightning", "water", "light", "dark"];
const crystals = Object.fromEntries(elements.map((element, index) => {
  const families = [...new Set(bestiary.monsters
    .filter((monster) => monster.era === "TOAU" && monster.element === (element === "lightning" ? "thunder" : element))
    .map((monster) => displayName(monster.family)))].sort();
  if (!families.length) throw new Error(`No families found for ${element}`);
  return [4096 + index, { name: `${displayName(element)} Crystal`, families }];
}));
const output = {
  source: { bestiaryRevision: bestiary.source.revision, era: "TOAU", rule: "Monster crystal element; src/map/entities/mob_entity.cpp awards item 4095 + m_Element. Family assignments may vary by monster." },
  crystals,
};
writeFileSync(new URL("../src/data/crystalFamilies.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
for (const crystal of Object.values(crystals)) console.log(`${crystal.name}: ${crystal.families.join(", ")}`);