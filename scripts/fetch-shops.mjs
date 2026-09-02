// scripts/fetch-shops.mjs — extract NPC shops, guild shops, and HELM gathering
// tables from a local LandSandBoat checkout (.lsb-server, sparse clone) into
// src/data/shops.json, src/data/guildShops.json and src/data/helm.json.
//
// Usage: node scripts/fetch-shops.mjs [path-to-lsb-checkout]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LSB = path.resolve(process.argv[2] ?? path.join(ROOT, ".lsb-server"));
const OUT_DIR = path.join(ROOT, "src", "data");

if (!fs.existsSync(path.join(LSB, "scripts", "zones"))) {
  console.error(`LSB checkout not found at ${LSB} (need scripts/zones). Clone with:
  git clone --depth 1 --filter=blob:none --sparse https://github.com/LandSandBoat/server.git .lsb-server
  git -C .lsb-server sparse-checkout set scripts/zones scripts/globals scripts/enum`);
  process.exit(1);
}

// ---------------------------------------------------------------- era gating
// Phoenix is ToAU-era: drop WotG [S] zones, Abyssea, SoA and later content.
const POST_ERA_ZONE = new RegExp(
  [
    "_\\[S\\]$",
    "^Abyssea",
    "^Dynamis-(Buburimu|Qufim|Valkurm|Tavnazia)", // WotG dynamis
    "^(Western|Eastern)_Adoulin",
    "^(Rala_Waterways|Cirdas_Caverns|Yorcia_Weald|Marjami_Ravine|Kamihr_Drifts)",
    "^(Sih_Gates|Moh_Gates|Dho_Gates|Woh_Gates)",
    "^(Ceizak_Battlegrounds|Yahse_Hunting_Grounds|Foret_de_Hennetiel|Morimar_Basalt_Fields)",
    "^(Mog_Garden|Leafallia|Celennia_Memorial_Library|Silver_Knife)",
    "^Escha_",
    "^Reisenjima",
    "^(Outer_RaKaznar|RaKaznar)",
    "^Walk_of_Echoes",
    "^(Everbloom_Hollow|Ghoyus_Reverie|Ruhotz_Silvermines)",
  ].join("|")
);

// ------------------------------------------------------------- item id names
const LOWER_WORDS = new Set(["of", "the", "and", "de", "du", "des", "la", "no"]);
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/;

function displayFromConst(constName) {
  return constName
    .toLowerCase()
    .split("_")
    .map((w, i) => {
      if (ROMAN.test(w)) return w.toUpperCase();
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

const itemEnumSrc = fs.readFileSync(path.join(LSB, "scripts", "enum", "item.lua"), "utf8");
const itemNameByConst = new Map(); // CONST -> display name
const itemNameById = new Map(); // id -> display name
for (const m of itemEnumSrc.matchAll(/^\s{4}([A-Z0-9_]+)\s*=\s*(\d+),/gm)) {
  const [, cname, id] = m;
  const display = displayFromConst(cname);
  itemNameByConst.set(cname, display);
  if (!itemNameById.has(Number(id))) itemNameById.set(Number(id), display);
}
console.log(`item enum: ${itemNameByConst.size} constants`);

// Prefer drops.json display names when the id is known there (keeps apostrophes etc.)
const dropsJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "drops.json"), "utf8"));
const dropDisplayById = new Map(Object.entries(dropsJson.items).map(([id, v]) => [Number(id), v.n]));

function itemDisplay(idOrConst) {
  if (typeof idOrConst === "number") {
    return dropDisplayById.get(idOrConst) ?? itemNameById.get(idOrConst) ?? null;
  }
  const name = itemNameByConst.get(idOrConst) ?? null;
  return name;
}

function zoneDisplay(dirName) {
  return dirName.replace(/_/g, " ");
}

// --------------------------------------------------------------- NPC shops
const zonesDir = path.join(LSB, "scripts", "zones");
const shopRows = []; // { n, zone, npc, price }
let shopNpcs = 0;

for (const zoneDir of fs.readdirSync(zonesDir)) {
  if (POST_ERA_ZONE.test(zoneDir)) continue;
  const npcsDir = path.join(zonesDir, zoneDir, "npcs");
  if (!fs.existsSync(npcsDir)) continue;
  for (const file of fs.readdirSync(npcsDir)) {
    if (!file.endsWith(".lua")) continue;
    const src = fs.readFileSync(path.join(npcsDir, file), "utf8");
    if (!/xi\.shop\.(general|stack)\s*\(/.test(src)) continue;
    const npc = file.replace(/\.lua$/, "").replace(/_/g, " ");
    // { xi.item.CONST, price } rows and legacy { 4148, 316 } rows
    const best = new Map(); // display name -> min price
    for (const m of src.matchAll(/\{\s*(?:xi\.item\.([A-Z0-9_]+)|(\d{3,6}))\s*,\s*(\d+)\s*[,}]/g)) {
      const [, cname, rawId, price] = m;
      const display = cname ? itemDisplay(cname) : itemDisplay(Number(rawId));
      if (!display) continue;
      const p = Number(price);
      const prev = best.get(display);
      if (prev === undefined || p < prev) best.set(display, p);
    }
    if (best.size === 0) continue;
    shopNpcs++;
    for (const [n, price] of best) shopRows.push({ n, zone: zoneDisplay(zoneDir), npc, price });
  }
}
console.log(`npc shops: ${shopNpcs} npcs, ${shopRows.length} rows`);

// --------------------------------------------------------------- guild shops
const shopLua = fs.readFileSync(path.join(LSB, "scripts", "globals", "shop.lua"), "utf8");
const guildRows = []; // { n, guild, price, rank }
{
  const start = shopLua.indexOf("xi.shop.generalGuildStock");
  if (start >= 0) {
    const src = shopLua.slice(start);
    let currentGuild = null;
    for (const line of src.split("\n")) {
      const g = line.match(/\[xi\.skill\.([A-Z_]+)\]/);
      if (g) {
        currentGuild = displayFromConst(g[1]);
        continue;
      }
      const row = line.match(/\{\s*xi\.item\.([A-Z0-9_]+)\s*,\s*(\d+)\s*,\s*xi\.craftRank\.([A-Z_]+)/);
      if (row && currentGuild) {
        const display = itemDisplay(row[1]);
        if (display) {
          guildRows.push({ n: display, guild: currentGuild, price: Number(row[2]), rank: displayFromConst(row[3]) });
        }
      }
      // stop at the end of the assignment (next top-level statement)
      if (/^xi\.shop\.[a-zA-Z]+\s*=/.test(line) && !line.includes("generalGuildStock")) break;
    }
  }
}
console.log(`guild shops: ${guildRows.length} rows`);

// ---------------------------------------------------------------- HELM data
const helmSrc = fs.readFileSync(path.join(LSB, "scripts", "globals", "hobbies", "helm", "data.lua"), "utf8");
const helmRows = []; // { kind, zone, n, pct }
{
  let kind = null;
  let zone = null;
  let obtainRate = 100;
  let drops = []; // { weight, name }
  let zoneEra = true;

  const flushZone = () => {
    if (!kind || !zone || drops.length === 0 || !zoneEra) {
      drops = [];
      return;
    }
    const total = drops.reduce((s, d) => s + d.weight, 0);
    for (const d of drops) {
      helmRows.push({
        kind,
        zone,
        n: d.name,
        pct: Math.round((d.weight / total) * obtainRate * 100) / 100,
      });
    }
    drops = [];
  };

  for (const line of helmSrc.split("\n")) {
    const k = line.match(/\[xi\.helmType\.([A-Z_]+)\]/);
    if (k) {
      flushZone();
      kind = displayFromConst(k[1]);
      zone = null;
      continue;
    }
    const z = line.match(/\[xi\.zone\.([A-Z0-9_]+)\]/);
    if (z) {
      flushZone();
      zone = displayFromConst(z[1]);
      zoneEra = !POST_ERA_ZONE.test(z[1].replace(/ /g, "_")) && !/^ABYSSEA|_S$/.test(z[1]);
      obtainRate = 100;
      continue;
    }
    const or = line.match(/obtainRate\s*=\s*([\d.]+)/);
    if (or) obtainRate = Number(or[1]);
    const d = line.match(/\{\s*(\d+)\s*,\s*xi\.item\.([A-Z0-9_]+)\s*\}/);
    if (d) {
      const name = itemDisplay(d[2]);
      if (name) drops.push({ weight: Number(d[1]), name });
    }
  }
  flushZone();
}
console.log(`helm: ${helmRows.length} rows`);

// -------------------------------------------------------------------- write
const write = (file, data) => {
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data, null, 1) + "\n");
  console.log(`wrote src/data/${file}`);
};
write("shops.json", shopRows);
write("guildShops.json", guildRows);
write("helm.json", helmRows);
