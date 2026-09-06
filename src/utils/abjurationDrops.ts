import dropsData from "../data/drops.json";

type DropTuple = [number, number, number, number, number];
const data = dropsData as unknown as {
  drops: Record<string, DropTuple[]>;
  mobs: { name: string; drop: number; era: number }[];
};
const cache = new Map<number, string[]>();

export function abjurationMobs(itemId: number): string[] {
  const cached = cache.get(itemId);
  if (cached) return cached;
  const dropLists = new Set(Object.entries(data.drops)
    .filter(([, entries]) => entries.some(([type, , groupRate, id, rate]) =>
      id === itemId && rate > 0 && type !== 2 && type !== 4 && (type !== 1 || groupRate > 0)))
    .map(([id]) => Number(id)));
  const names = [...new Set(data.mobs
    .filter((mob) => mob.era === 1 && dropLists.has(mob.drop) && !/INSERT INTO|mob_spawn_points|NULL,NULL/.test(mob.name))
    .map((mob) => mob.name))].sort((first, second) => first.localeCompare(second));
  cache.set(itemId, names);
  return names;
}