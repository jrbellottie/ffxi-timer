import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseSql } from "./lib/item-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const checkout = path.resolve(process.argv[2] ?? path.join(root, ".lsb-server"));
const load = (name) => JSON.parse(readFileSync(path.join(root, "src/data", `${name}.json`), "utf8"));
const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const key = (name, zone) => `${normalize(zone)}:${normalize(name)}`;
const zoneName = (name) => name.replace(/_/g, " ").replace(/\bd([A-Z])/g, "d'$1");
const canonicalZones = new Map();
for (const zone of [...load("maps").maps.map((map) => map.zone), ...load("shops").map((shop) => shop.zone), ...readdirSync(path.join(checkout, "scripts/zones")).map(zoneName)]) {
  if (!canonicalZones.has(normalize(zone))) canonicalZones.set(normalize(zone), zone);
}
const canonicalZone = (value) => {
  const zone = (value ?? "").replace(/\s*\(?(?:North|South)\)?$/i, "").split(" - ").pop();
  return canonicalZones.get(normalize(value ?? "")) ?? canonicalZones.get(normalize(zone)) ?? "";
};
const wikiPath = path.join(root, "src/data/npcWiki.json");
const wiki = existsSync(wikiPath) ? JSON.parse(readFileSync(wikiPath, "utf8")).npcs : {};
const entries = new Map();
const add = (name, zone) => {
  const alias = key(name, zone ?? "");
  const wikiZones = [...new Set((wiki[name]?.locations ?? []).map((location) => canonicalZone(location.zone)).filter(Boolean))];
  zone = canonicalZone(zone) || (wikiZones.length === 1 ? wikiZones[0] : "");
  const id = key(name, zone);
  if (!entries.has(id)) entries.set(id, { id, aliases: [], name, zone, coordinates: [], positions: [], roles: [], inventory: [], quests: [], services: [], guild: null });
  if (!entries.get(id).aliases.includes(alias)) entries.get(id).aliases.push(alias);
  return entries.get(id);
};
const role = (npc, value) => { if (!npc.roles.includes(value)) npc.roles.push(value); };
for (const shop of load("shops")) {
  const npc = add(shop.npc, shop.zone);
  role(npc, "Vendor");
  if (!npc.inventory.some((item) => item.name === shop.n && item.price === shop.price)) npc.inventory.push({ name: shop.n, price: shop.price });
}
const quests = load("quests");
for (const quest of [...quests.quests, ...quests.missions]) {
  if (!quest.startNpc || !quest.startZone) continue;
  const npc = add(quest.startNpc, quest.startZone);
  role(npc, quest.type === "mission" ? "Mission" : "Quest");
  npc.quests.push({ id: quest.id, name: quest.name, type: quest.type, relation: "Starts", requirements: quest.requirements, reward: quest.reward });
  if (quest.startCoord && !npc.coordinates.includes(quest.startCoord)) npc.coordinates.push(quest.startCoord);
}
const purifier = add("Alphollon C Meriard", "Northern San d'Oria");
role(purifier, "Purification");
purifier.services.push("Purifies cursed equipment and consumables when traded with the matching abjuration.");
const zonesDirectory = path.join(checkout, "scripts/zones");
const knownZones = new Set([...entries.values()].map((npc) => normalize(npc.zone)));
for (const zone of readdirSync(zonesDirectory)) {
  if (!knownZones.has(normalize(zoneName(zone)))) continue;
  const directory = path.join(zonesDirectory, zone, "npcs");
  if (!existsSync(directory)) continue;
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".lua"))) {
    const name = filename.slice(0, -4).replace(/_/g, " ");
    const source = readFileSync(path.join(directory, filename), "utf8");
    const guild = /xi\.shop\.generalGuildStock/.test(source) ? source.match(/guildSkillId\s*=\s*xi\.skill\.([A-Z_]+)/)?.[1] : undefined;
    const type = source.match(/^--\s*Type:\s*(.+)/m)?.[1]?.trim();
    const isService = type && /guild|shop|merchant|vendor|teleport|home point|survival guide|auction|delivery|storage|porter|outpost|conquest|signet|sanction/i.test(type);
    let npc = entries.get(key(name, zoneName(zone)));
    if (!npc && !guild && !isService) continue;
    npc ??= add(name, zoneName(zone));
    const position = source.match(/!pos\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
    if (position) npc.positions.push({ x: Number(position[1]), y: Number(position[2]), z: Number(position[3]) });
    if (type && !npc.services.includes(type)) npc.services.push(type);
    if (isService) role(npc, "Service");
    if (guild) {
      npc.guild = guild[0] + guild.slice(1).toLowerCase();
      role(npc, "Guild vendor");
      for (const item of load("guildShops").filter((item) => normalize(item.guild) === normalize(guild))) {
        npc.inventory.push({ name: item.n, price: item.price, rank: item.rank });
      }
    }
  }
}
const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const revision = git("rev-parse", "HEAD").trim();
const zones = new Map(parseSql(git("show", `${revision}:sql/zone_settings.sql`), "zone_settings").map((zone) => [zone.zoneid, zoneName(zone.name)]));
for (const row of parseSql(git("show", `${revision}:sql/npc_list.sql`), "npc_list")) {
  const zone = zones.get((row.npcid >>> 12) & 0xfff);
  if (!zone) continue;
  const npc = entries.get(key(row.name, zone)) ?? entries.get(key(row.polutils_name ?? "", zone));
  if (!npc || (row.pos_x === 0 && row.pos_y === 0 && row.pos_z === 0)) continue;
  const position = { id: row.npcid, x: row.pos_x, y: row.pos_y, z: row.pos_z };
  if (!npc.positions.some((entry) => entry.x === position.x && entry.y === position.y && entry.z === position.z)) npc.positions.push(position);
}
for (const npc of entries.values()) {
  npc.inventory.sort((first, second) => first.name.localeCompare(second.name));
  npc.quests.sort((first, second) => first.name.localeCompare(second.name));
  npc.roles.sort();
}
const npcs = [...entries.values()].sort((first, second) => first.name.localeCompare(second.name) || first.zone.localeCompare(second.zone));
writeFileSync(path.join(root, "src/data/npcs.json"), JSON.stringify({ source: { revision, inputs: ["shops.json", "guildShops.json", "quests.json", "maps.json", "npcWiki.json (when cached)", "LandSandBoat NPC scripts", "npc_list.sql"] }, npcs }, null, 2) + "\n");
console.log(`NPCs: ${npcs.length}; vendors: ${npcs.filter((npc) => npc.inventory.length).length}; with positions: ${npcs.filter((npc) => npc.positions.length).length}; with quests: ${npcs.filter((npc) => npc.quests.length).length}`);