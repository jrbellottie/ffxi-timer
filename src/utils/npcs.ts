import npcData from "../data/npcs.json";
import wikiData from "../data/npcWiki.json";
import questData from "../data/quests.json";
import { normalizeNpcName, npcKey } from "./npcLinks";
import { PHOENIX_GUILD_NPCS, shopsData } from "./phoenixData";

export type NpcQuest = { id: string; name: string; type: string; relation: string; requirements: string | null; reward: string | null };
export type Npc = {
  id: string; aliases: string[]; name: string; zone: string; coordinates: string[];
  positions: { id?: number; x: number; y: number; z: number }[];
  roles: string[]; inventory: { name: string; price: number; rank?: string }[];
  quests: NpcQuest[]; services: string[]; guild: string | null;
};
export type NpcProfile = { status: string; title?: string; url?: string; revision?: number; locations?: { zone: string; coord: string }[]; location?: string; fields?: Record<string, string>; notes?: string; related?: { name: string; relation: string }[] };
export const NPCS = (npcData.npcs as Npc[]).map(npc => {
  if (!PHOENIX_GUILD_NPCS.has(npc.name) && npc.name !== "Valeriano") return npc;
  const offers = shopsData.filter(row => npcKey(row.npc, row.zone) === npcKey(npc.name, npc.zone));
  return { ...npc, inventory: offers.map(row => ({ name: row.n, price: row.price })) };
});
const existingIds = new Set(NPCS.flatMap(npc => [npc.id, ...npc.aliases]));
for (const offer of shopsData) {
  const id = npcKey(offer.npc, offer.zone);
  if (existingIds.has(id)) continue;
  existingIds.add(id);
  NPCS.push({ id, aliases: [], name: offer.npc, zone: offer.zone, coordinates: [], positions: [], roles: ["Shop"], inventory: shopsData.filter(row => npcKey(row.npc, row.zone) === id).map(row => ({ name: row.n, price: row.price })), quests: [], services: [], guild: null });
}
const profiles = wikiData.npcs as Record<string, NpcProfile>;
const byId = new Map(NPCS.flatMap((npc) => [npc.id, ...npc.aliases].map((id) => [id, npc] as const)));
const quests = [...questData.quests, ...questData.missions];

export function findNpc(query: string): Npc | undefined {
  return byId.get(query) ?? NPCS.find((npc) => normalizeNpcName(npc.name) === normalizeNpcName(query));
}
export function npcProfile(npc: Npc): NpcProfile | undefined { return profiles[npc.name]; }
export function npcCoordinates(npc: Npc): string[] {
  const locations = npcProfile(npc)?.locations ?? [];
  return [...new Set([...npc.coordinates, ...locations.filter((location) => normalizeNpcName(location.zone) === normalizeNpcName(npc.zone)).map((location) => location.coord)])];
}
export function npcQuests(npc: Npc): NpcQuest[] {
  const result = new Map(npc.quests.map((quest) => [quest.id, quest]));
  for (const related of npcProfile(npc)?.related ?? []) {
    const matches = quests.filter((quest) => normalizeNpcName(quest.pageTitle) === normalizeNpcName(related.name) || normalizeNpcName(quest.name) === normalizeNpcName(related.name));
    for (const quest of matches) {
      if (!result.has(quest.id)) result.set(quest.id, { id: quest.id, name: quest.name, type: quest.type, relation: related.relation.startsWith("starts") ? "Starts" : "Involved", requirements: quest.requirements, reward: quest.reward });
    }
  }
  return [...result.values()].sort((first, second) => first.name.localeCompare(second.name));
}
export { npcKey };