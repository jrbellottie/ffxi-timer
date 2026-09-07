import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parse as parseYaml } from "yaml";
import { parseSql } from "./lib/item-data.mjs";
import { evaluateLuaData } from "./lib/lua-data.mjs";

const checkout = process.argv[2];
if (!checkout) throw new Error("Usage: node scripts/generate-phoenix.mjs <Phoenix checkout> [--check]");
const revision = "ace1415cf5643d8d45ff72067522d97f2ccb038f";
const inputs = {};
const source = (file) => {
  const content = execFileSync("git", ["-C", checkout, "show", `${revision}:${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  inputs[file] = createHash("sha256").update(content).digest("hex");
  return content;
};
const catalog = JSON.parse(readFileSync("src/data/itemInfo.json", "utf8"));
const fishing = Object.fromEntries(parseSql(source("sql/fishing_fish.sql"), "fishing_fish").map(row => [row.name, { skillCap: row.skill_level, item: Boolean(row.item), disabled: Boolean(row.disabled) }]));
const basic = parseSql(source("sql/item_basic.sql"), "item_basic");
const db = new DatabaseSync(":memory:");
const columns = Object.keys(basic[0]);
db.exec(`CREATE TABLE item_basic (${columns.map(column => `"${column}" ${typeof basic[0][column] === "number" ? "INTEGER" : "TEXT"}`).join(",")})`);
const insert = db.prepare(`INSERT INTO item_basic VALUES (${columns.map(() => "?").join(",")})`);
db.exec("BEGIN");
for (const row of basic) insert.run(...columns.map(column => row[column]));
db.exec("COMMIT");
const init = source("modules/init.txt");
if (!init.includes("phoenix/sql") || !init.includes("phoenix/lua")) throw new Error("Phoenix modules not enabled");
for (const file of ["pre_rmt_basesell_vendor_revert.sql", "pxi_item_basic.sql"]) {
  const sql = source(`modules/phoenix/sql/${file}`);
  const variables = new Map([...sql.matchAll(/^SET\s+(@\w+)\s*=\s*(\d+);/gm)].map(match => [match[1], match[2]]));
  const statements = sql.replace(/--[^\n]*/g, "").replace(/^SET[^;]+;/gm, "").split(";").map(statement => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    if (!/^UPDATE\s+`?item_basic`?\s+SET\s/i.test(statement)) throw new Error(`Unsupported item patch: ${statement}`);
    db.exec(statement.replace(/@\w+/g, variable => { if (!variables.has(variable)) throw new Error(`Unknown SQL variable ${variable}`); return variables.get(variable); }));
  }
}
const items = {};
for (const row of db.prepare("SELECT * FROM item_basic ORDER BY itemid").all()) {
  const original = catalog.items[row.itemid];
  if (original && (original.sell !== row.BaseSell || original.stack !== row.stackSize || (original.flags & 4096) !== (row.flags & 4096))) items[row.itemid] = { sell: row.BaseSell, stack: row.stackSize, flags: row.flags };
}

const enumValues = (file) => Object.fromEntries([...source(file).matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(\d+)\s*,/gm)].map(match => [match[1], Number(match[2])]));
const itemEnums = enumValues("scripts/enum/item.lua");
const zoneEnums = Object.fromEntries(Object.entries(parseYaml(source("data/enums/zone.yaml")).values).map(([name, id]) => [name.toUpperCase(), id]));
const ranks = ["Amateur", "Recruit", "Initiate", "Novice", "Apprentice", "Journeyman", "Craftsman", "Artisan", "Adept", "Veteran", "Expert"];
const luaTable = (object) => `{${Object.entries(object).map(([key, value]) => `[${JSON.stringify(key)}]=${value}`).join(",")}}`;
const bootstrap = `xi={item=${luaTable(itemEnums)},zone=${luaTable(zoneEnums)},craftRank=${luaTable(Object.fromEntries(ranks.map((rank,index)=>[rank.toUpperCase(),index])))},day={FIRESDAY=0,EARTHSDAY=1,WATERSDAY=2,WINDSDAY=3,ICEDAY=4,LIGHTNINGDAY=5,LIGHTSDAY=6,DARKSDAY=7},data={}}; Module={new=function() return {addOverride=function(self,name,callback) callback() end} end}; super=function() end`;
const names = new Map(Object.entries(itemEnums).map(([name, id]) => [id, catalog.items[id]?.name ?? name.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase())]));
const clamming = evaluateLuaData([bootstrap, source("scripts/globals/hobbies/clamming/data.lua")], "xi.clamming");
for (const id of Object.keys(clamming.itemData)) if (!catalog.items[id]) {
  const row = db.prepare("SELECT * FROM item_basic WHERE itemid = ?").get(Number(id));
  if (!row) throw new Error(`Missing clamming item ${id}`);
  items[id] = { name: row.name.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()), sell: row.BaseSell, stack: row.stackSize, flags: row.flags, category: 0 };
}
db.close();
source("scripts/globals/hobbies/clamming/logic.lua");
const digTable = evaluateLuaData([bootstrap, source("scripts/globals/hobbies/chocobo_digging/data.lua")], "xi.chocoboDig.digInfo");
const digLogic = source("scripts/globals/hobbies/chocobo_digging/logic.lua");
const allowed = [...digLogic.match(/local diggingZoneList\s*=\s*set\{([\s\S]*?)\}/)[1].replace(/--[^\n]*/g, "").matchAll(/xi\.zone\.([A-Z_]+)/g)].map(match => zoneEnums[match[1]]);
const zoneName = (id) => Object.entries(zoneEnums).find(([, value]) => value === Number(id))?.[0].toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()).replace("The Sanctuary Of Zitah", "The Sanctuary of Zi'Tah").replace("Carpenters Landing", "Carpenters' Landing");
const helmSetup = `xi.helmType={HARVESTING=1,EXCAVATION=2,LOGGING=3,MINING=4}; xi.emote=xi.helmType; xi.expansion={ABYSSEA=8,WOTG=4}; Module.new=function() return {addOverrideByEra=function(self,name,callbacks) for _,callback in pairs(callbacks) do callback() end end} end`;
const helmTable = evaluateLuaData([bootstrap, helmSetup, source("scripts/globals/hobbies/helm/data.lua"), source("modules/era/lua/globals/helm/helm_adjustments.lua")], "xi.helm.dataTable");
source("scripts/globals/hobbies/helm/logic.lua");
const helm = [];
const helmZones = [];
for (const table of Object.values(helmTable)) for (const [zone, data] of Object.entries(table.zone)) {
  const drops = Object.values(data.drops);
  const total = drops.reduce((sum, row) => sum + row[1], 0);
  helmZones.push({ kind: table.id.toLowerCase().replace(/^\w/, letter => letter.toUpperCase()), zone: zoneName(zone), zoneId: Number(zone), toolId: table.tool, tool: names.get(table.tool), obtainRate: data.obtainRate, breakRate: data.breakRate, minLevel: data.minLevel ?? 0, relocateRate: table.relocateRate, respawnTime: table.respawnTime, campMultiplier: table.campMultiplier, depletion: data.depletion ? { max: data.depletion.max, pool: Object.values(data.depletion.pool) } : null, points: Object.values(data.points).map(point => Object.values(point)), drops: drops.map(row => ({ itemId: row[2], name: names.get(row[2]), weight: row[1], dailyCap: data.dailyCap?.[row[2]] ?? null })) });
  for (const row of drops) helm.push({ kind: table.id.toLowerCase().replace(/^\w/, letter => letter.toUpperCase()), zone: zoneName(zone), n: names.get(row[2]), pct: 100 * row[1] / total, obtainRate: data.obtainRate, breakRate: data.breakRate, minLevel: data.minLevel ?? 0, dailyCap: data.dailyCap?.[row[2]] ?? null, depletion: data.depletion ?? null });
}
helm.sort((first, second) => first.kind.localeCompare(second.kind) || first.zone.localeCompare(second.zone) || first.n.localeCompare(second.n));
helmZones.sort((first, second) => first.kind.localeCompare(second.kind) || first.zone.localeCompare(second.zone));
const modEnums = parseYaml(source("data/enums/mod.yaml")).values;
const helmMods = new Map();
for (const kind of ["Harvesting", "Logging", "Mining"]) for (const quality of ["nq", "hq"]) {
  helmMods.set(modEnums[`${kind.toLowerCase()}_result_${quality}`], { kind, quality });
}
const gearByItem = new Map();
for (const row of parseSql(source("sql/item_mods.sql"), "item_mods")) {
  const mod = helmMods.get(row.modId);
  if (!mod) continue;
  const key = `${row.itemId}:${mod.kind}`;
  const name = catalog.items[row.itemId]?.name ?? names.get(row.itemId) ?? basic.find(item => item.itemid === row.itemId)?.name.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
  if (!name) throw new Error(`Unknown HELM gear item ${row.itemId}`);
  const gear = gearByItem.get(key) ?? { itemId: row.itemId, name, kind: mod.kind, nq: 0, hq: 0 };
  gear[mod.quality] += row.value;
  gearByItem.set(key, gear);
}
const helmGear = [...gearByItem.values()].sort((first, second) => first.kind.localeCompare(second.kind) || first.name.localeCompare(second.name));
const valerianoSource = source("modules/era/lua/globals/valeriano_shop_adjust.lua");
const valerianoStock = evaluateLuaData([bootstrap], `{${valerianoSource.match(/local stock\s*=\s*\{([\s\S]*?)\n    \}/)[1]}}`);
const valerianoOffers = ["Southern San d'Oria", "Port Bastok", "Windurst Woods"].flatMap(zone => Object.values(valerianoStock).map(row => ({ n: names.get(row[1]), npc: "Valeriano", zone, price: row[2] })));
const entries = [];
for (const zone of allowed) for (const [layer, rows] of Object.entries(digTable[zone] ?? {})) for (const row of Object.values(rows)) {
  if (!names.has(row[1])) throw new Error(`Unknown dig item ${row[1]}`);
  entries.push({ zone: zoneName(zone), item: names.get(row[1]), rate: row[2] / 10, rank: row[3] === 0 ? null : ranks[row[3]], mode: Number(layer) === 3 ? "burrow" : Number(layer) === 4 ? "bore" : null, layer: ["", "treasure", "regular", "burrow", "bore"][Number(layer)] });
}
entries.sort((first, second) => first.zone.localeCompare(second.zone) || first.layer.localeCompare(second.layer) || first.item.localeCompare(second.item));
const guilds = evaluateLuaData([bootstrap, source("scripts/data/guild_shops.lua"), source("modules/phoenix/lua/data/era_guild_shops.lua")], "xi.data.guildShops");
const shops = JSON.parse(readFileSync("src/data/shops.json", "utf8"));
const npcZones = new Map(shops.map(row => [row.npc.replaceAll(" ", "_"), row.zone]));
const npcPaths = execFileSync("git", ["-C", checkout, "ls-tree", "-r", "--name-only", revision, "scripts/zones"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
for (const match of npcPaths.matchAll(/scripts\/zones\/([^/]+)\/npcs\/([^/]+)\.lua/g)) if (!npcZones.has(match[2])) npcZones.set(match[2], match[1].replaceAll("_", " ").replace(/\bd([A-Z])/g, "d'$1"));
const guildOffers = [];
const guildPrice = (stock) => {
  const floor = stock.priceFloor ?? stock.maxStock * 0.75;
  const count = stock.targetStock ?? stock.maxStock;
  if (floor <= 0) return stock.buyMax;
  const knee = floor * 2 / 3;
  return count <= knee ? Math.floor(stock.buyMax * (125 - Math.floor(150 * count / floor)) / 125) : Math.floor(stock.buyMax * (200 - Math.floor(100 * (count - knee) / (stock.maxStock - knee))) / 1000);
};
for (const [npc, guild] of Object.entries(guilds)) {
  const stock = guilds[guild.sharedStock ?? npc]?.stock;
  if (!stock) throw new Error(`Unresolved guild stock ${npc}`);
  if (!npcZones.has(npc)) throw new Error(`Missing guild NPC zone ${npc}`);
  for (const row of Object.values(stock)) guildOffers.push({ n: names.get(row.id), npc: npc.replaceAll("_", " "), zone: npcZones.get(npc), price: guildPrice(row), initial: row.initial, restockRate: row.restockRate, stocked: row.initial > 0 || row.restockRate > 0 });
}
guildOffers.sort((first, second) => first.npc.localeCompare(second.npc) || first.n.localeCompare(second.n));
const output = { source: { repository: "https://github.com/phoenixffxi/Phoenix", revision, branch: "beta", eraScenario: "ToAU (pre-WotG)", inputs }, items, fishing, clamming, helm, helmZones, helmGear, valerianoOffers, guildNpcs: Object.keys(guilds).map(npc => npc.replaceAll("_", " ")).sort(), guildOffers, digging: { entries } };
const filename = "src/data/phoenix.json";
const text = JSON.stringify(output) + "\n";
if (process.argv.includes("--check")) { if (readFileSync(filename, "utf8") !== text) throw new Error("Phoenix snapshot differs; regenerate explicitly"); }
else writeFileSync(filename, text);
console.log(`Phoenix ${revision}: ${Object.keys(items).length} item overrides, ${guildOffers.length} guild offers, ${entries.length} digging entries in ${allowed.length} zones`);