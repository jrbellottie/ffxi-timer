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
const itemIdByConst = new Map(); // CONST -> id
const itemNameById = new Map(); // id -> display name
for (const m of itemEnumSrc.matchAll(/^\s{4}([A-Z0-9_]+)\s*=\s*(\d+),/gm)) {
  const [, cname, id] = m;
  const display = displayFromConst(cname);
  itemNameByConst.set(cname, display);
  itemIdByConst.set(cname, Number(id));
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
  const id = itemIdByConst.get(idOrConst);
  if (id !== undefined && dropDisplayById.has(id)) return dropDisplayById.get(id);
  return itemNameByConst.get(idOrConst) ?? null;
}

function zoneDisplay(dirName) {
  // "Southern_San_dOria" -> "Southern San d'Oria" (matches drops.json zone names)
  return dirName.replace(/_/g, " ").replace(/\bd([A-Z])/g, "d'$1");
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
    // Plain gil shops, nation (conquest-rank) shops, and Besieged (Al Zahbi) shops.
    if (!/xi\.shop\.(general|stack|nation)\s*\(|xi\.besieged\.shop\s*\(/.test(src)) continue;
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

// NPC script file name -> zone dir, for stock tables that live outside zone scripts.
const zoneByNpcFile = new Map(); // "Maqu_Molpih" -> zone dir
for (const zoneDir of fs.readdirSync(zonesDir)) {
  if (POST_ERA_ZONE.test(zoneDir)) continue;
  const npcsDir = path.join(zonesDir, zoneDir, "npcs");
  if (!fs.existsSync(npcsDir)) continue;
  for (const file of fs.readdirSync(npcsDir)) {
    if (file.endsWith(".lua")) zoneByNpcFile.set(file.replace(/\.lua$/, ""), zoneDir);
  }
}

// ------------------------------------------- conquest regional merchants
// Stock lives in shop.lua (regionalVendorTable + regionalStockTable), keyed by
// region; each vendor NPC's zone is found from its scripts/zones/*/npcs file.
const shopLuaSrc = fs.readFileSync(path.join(LSB, "scripts", "globals", "shop.lua"), "utf8");
{
  const stockByRegion = new Map();
  const stockSection = shopLuaSrc.slice(shopLuaSrc.indexOf("local regionalStockTable"));
  let region = null;
  for (const line of stockSection.split("\n")) {
    const r = line.match(/\[xi\.region\.([A-Z_]+)\]/);
    if (r) {
      region = r[1];
      stockByRegion.set(region, []);
      continue;
    }
    const row = line.match(/\{\s*xi\.item\.([A-Z0-9_]+)\s*,\s*(\d+)\s*,?\s*\}/);
    if (row && region) {
      const display = itemDisplay(row[1]);
      if (display) stockByRegion.get(region).push({ n: display, price: Number(row[2]) });
    }
    if (/^xi\.shop\./.test(line)) break; // end of the stock table
  }

  let vendorRows = 0;
  const vendorSection = shopLuaSrc.slice(shopLuaSrc.indexOf("local regionalVendorTable"));
  for (const m of vendorSection.matchAll(/\['([\w-]+)'\s*\]\s*=\s*\{\s*xi\.region\.([A-Z_]+)/g)) {
    const [, npcFile, region] = m;
    const zoneDir = zoneByNpcFile.get(npcFile);
    const stock = stockByRegion.get(region);
    if (!zoneDir || !stock) continue;
    const npc = npcFile.replace(/_/g, " ");
    for (const { n, price } of stock) {
      shopRows.push({ n, zone: zoneDisplay(zoneDir), npc, price });
      vendorRows++;
    }
  }
  console.log(`regional vendors: ${vendorRows} rows`);
}

// ------------------------------------------- guild counter shops (Lua data)
// Rotating-stock guild counters (scripts/data/guild_shops.lua). buyMax is the
// empty-shelf price; the familiar wiki price is the curve price at targetStock
// (each open settles stock there), so we compute that.
{
  const src = fs.readFileSync(path.join(LSB, "scripts", "data", "guild_shops.lua"), "utf8");

  // Port of calcBuyPrice in scripts/globals/guild_shops.lua.
  const buyPriceAt = (buyMax, priceFloor, maxStock, stock) => {
    if (priceFloor <= 0) return buyMax;
    const knee = (2 / 3) * priceFloor;
    if (stock <= knee) return Math.floor((buyMax * (125 - Math.floor((150 * stock) / priceFloor))) / 125);
    return Math.floor((buyMax * (200 - Math.floor((100 * (stock - knee)) / (maxStock - knee)))) / 1000);
  };

  const stockByNpc = new Map(); // npc file name -> [{ n, price }]
  const aliasByNpc = new Map(); // npc file name -> source npc (sharedStock)
  let npc = null;
  for (const line of src.split("\n")) {
    const h = line.match(/^\s{4}\['([\w-]+)'\]/);
    if (h) {
      npc = h[1];
      stockByNpc.set(npc, []);
      continue;
    }
    if (!npc) continue;
    const alias = line.match(/sharedStock\s*=\s*'([\w-]+)'/);
    if (alias) {
      aliasByNpc.set(npc, alias[1]);
      continue;
    }
    const row = line.match(/\{\s*id\s*=\s*xi\.item\.([A-Z0-9_]+)\s*,(.*)\}/);
    if (row) {
      const display = itemDisplay(row[1]);
      const field = (name) => {
        const m = row[2].match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`));
        return m ? Number(m[1]) : null;
      };
      const buyMax = field("buyMax");
      const maxStock = field("maxStock");
      if (!display || buyMax === null || maxStock === null) continue;
      const targetStock = field("targetStock") ?? maxStock;
      const priceFloor = field("priceFloor") ?? (maxStock * 3) / 4;
      stockByNpc.get(npc).push({ n: display, price: buyPriceAt(buyMax, priceFloor, maxStock, targetStock) });
    }
  }
  let counterRows = 0;
  for (const npcFile of stockByNpc.keys()) {
    const stock = stockByNpc.get(aliasByNpc.get(npcFile) ?? npcFile);
    const zoneDir = zoneByNpcFile.get(npcFile);
    if (!zoneDir || !stock || stock.length === 0) continue;
    const npcName = npcFile.replace(/_/g, " ");
    for (const { n, price } of stock) {
      shopRows.push({ n, zone: zoneDisplay(zoneDir), npc: npcName, price });
      counterRows++;
    }
  }
  console.log(`guild counters: ${counterRows} rows`);
}

// --------------------------------------------------- conquest point items
// Gate guard / overseer stock in scripts/globals/conquest.lua.
const cpRows = []; // { n, nation, rank, cp, lvl }
{
  const src = fs.readFileSync(path.join(LSB, "scripts", "globals", "conquest.lua"), "utf8");
  const NATION_NAMES = { SANDORIA: "San d'Oria", BASTOK: "Bastok", WINDURST: "Windurst" };
  const parseLine = (line, nation) => {
    const item = line.match(/item\s*=\s*xi\.item\.([A-Z0-9_]+)/);
    const cp = line.match(/cp\s*=\s*(\d+)/);
    if (!item || !cp) return;
    const display = itemDisplay(item[1]);
    if (!display) return;
    const lvl = line.match(/lvl\s*=\s*(\d+)/);
    const rank = line.match(/rank\s*=\s*(\d+)/);
    cpRows.push({
      n: display,
      nation,
      rank: rank ? Number(rank[1]) : null,
      cp: Number(cp[1]),
      lvl: lvl ? Number(lvl[1]) : null,
    });
  };

  const commonStart = src.indexOf("local overseerInvCommon");
  const nationStart = src.indexOf("local overseerInvNation");
  if (commonStart >= 0 && nationStart > commonStart) {
    for (const line of src.slice(commonStart, nationStart).split("\n")) parseLine(line, "All nations");
    let nation = null;
    for (const line of src.slice(nationStart).split("\n").slice(1)) {
      if (/^(local |xi\.)/.test(line)) break; // end of the table
      const n = line.match(/\[xi\.nation\.([A-Z_]+)\]/);
      if (n) {
        nation = NATION_NAMES[n[1]] ?? null;
        continue;
      }
      if (nation) parseLine(line, nation);
    }
  }
  console.log(`conquest point items: ${cpRows.length} rows`);
}

// --------------------------------------------------------------- guild shops
const shopLua = shopLuaSrc;
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
write("cpItems.json", cpRows);
