import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL("../src/utils/npcs.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
const { NPCS, findNpc, npcKey, npcCoordinates, npcQuests } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const phoenix = load("phoenix");
const shops = [...load("shops").filter(row => !phoenix.guildNpcs.includes(row.npc) && row.npc !== "Valeriano"), ...phoenix.guildOffers.filter(row => row.stocked), ...phoenix.valerianoOffers];

test("every shop NPC resolves by zone and retains every recorded item and price", () => {
  assert.equal(new Set(NPCS.map((npc) => npc.id)).size, NPCS.length);
  for (const shop of shops) {
    const npc = findNpc(npcKey(shop.npc, shop.zone));
    assert.ok(npc, `${shop.npc} in ${shop.zone}`);
    assert.ok(npc.inventory.some((item) => item.name === shop.n && item.price === shop.price), `${npc.name}: ${shop.n}`);
  }
});
test("NPC keys tolerate punctuation and keep same names in different zones separate", () => {
  assert.equal(npcKey("Alphollon C. Meriard", "Northern San d'Oria"), npcKey("Alphollon_C_Meriard", "Northern_San_dOria"));
  assert.notEqual(npcKey("Moogle", "Port Jeuno"), npcKey("Moogle", "Lower Jeuno"));
  assert.equal(findNpc("Not a real NPC"), undefined);
  const knownZones = new Set(load("maps").maps.map((map) => map.zone));
  assert.ok(NPCS.every((npc) => !/^\d+\)/.test(npc.zone) && (!npc.zone.includes(" - ") || knownZones.has(npc.zone))));
  const ajuu = findNpc(npcKey("Ajuu", "Ajuu - Windurst Waters"));
  if (ajuu) assert.ok(knownZones.has(ajuu.zone));
  for (const npc of NPCS) for (const alias of npc.aliases) assert.equal(findNpc(alias).id, npc.id);
});
test("Bajahb retains its verified grid location; Phoenix guilds use shared era stock", () => {
  const vendor = findNpc(npcKey("Bajahb", "Aht Urhgan Whitegate"));
  assert.ok(npcCoordinates(vendor).includes("J-11"));
  assert.ok(vendor.inventory.some((item) => item.name === "Iron Mask" && item.price === 10260));
  const guild = findNpc(npcKey("Chomo Jinjahl", "Windurst Waters"));
  assert.equal(guild.guild, "Cooking");
  const expected = phoenix.guildOffers.filter(row => row.npc === "Chomo Jinjahl" && row.stocked);
  assert.deepEqual(guild.inventory, expected.map(row => ({ name: row.n, price: row.price })));
  assert.ok(guild.inventory.every(item => item.rank === undefined));
});
test("quest links resolve to bundled quest IDs and purification NPC has a service and location", () => {
  const quests = load("quests");
  const ids = new Set([...quests.quests, ...quests.missions].map((quest) => quest.id));
  for (const npc of NPCS) for (const quest of npcQuests(npc)) assert.ok(ids.has(quest.id), `${npc.name}: ${quest.id}`);
  const nanaa = findNpc(npcKey("Nanaa Mihgo", "Windurst Woods"));
  assert.ok(npcQuests(nanaa).length > 0);
  const purifier = findNpc("Alphollon C Meriard");
  assert.ok(purifier.services.some((service) => service.includes("Purifies")));
  assert.ok(purifier.positions.length > 0);
});