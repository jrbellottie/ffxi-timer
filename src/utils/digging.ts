export type DigLayer = "treasure" | "regular" | "burrow" | "bore";
export function nextDigReset(nowMs: number): number {
  const dayMs = 86_400_000;
  const jstOffset = 9 * 3_600_000;
  return (Math.floor((nowMs + jstOffset) / dayMs) + 1) * dayMs - jstOffset;
}
export type DigCandidate = { item: string; rate: number; layer: DigLayer };
export const ORE_ZONES = ["La Theine Plateau", "Jugner Forest", "Batallia Downs", "Konschtat Highlands", "Pashhow Marshlands", "Rolanberry Fields", "Tahrongi Canyon", "Meriphataud Mountains", "Sauromugue Champaign"];
export const DIG_DAY_ITEMS: Record<string, [string, string]> = {
  Firesday: ["Red Rock", "Fire Ore"], Earthsday: ["Yellow Rock", "Earth Ore"],
  Watersday: ["Blue Rock", "Water Ore"], Windsday: ["Green Rock", "Wind Ore"],
  Iceday: ["Translucent Rock", "Ice Ore"], Lightningday: ["Purple Rock", "Lightning Ore"],
  Lightsday: ["White Rock", "Light Ore"], Darksday: ["Black Rock", "Dark Ore"],
};

export function digRollChance(rate: number, moon: number): number {
  const multiplier = 1.5 - Math.abs(Math.max(0, Math.min(100, moon)) - 50) / 50;
  const threshold = Math.round(rate * 10);
  let successes = 0;
  for (let roll = 1; roll <= 1000; roll++) if (Math.max(1, Math.min(1000, Math.floor(roll * multiplier))) <= threshold) successes++;
  return successes / 1000;
}

export function digLayerChances(probabilities: number[]): number[] {
  return probabilities.map((probability, target) => {
    let counts = [1];
    probabilities.forEach((other, index) => {
      if (index === target) return;
      const next = Array(counts.length + 1).fill(0) as number[];
      counts.forEach((value, count) => { next[count] += value * (1 - other); next[count + 1] += value * other; });
      counts = next;
    });
    return probability * counts.reduce((sum, value, count) => sum + value / (count + 1), 0);
  });
}

export function diggingDistribution(candidates: DigCandidate[], moon: number) {
  const rewards = candidates.map(() => 0);
  const success: Record<DigLayer, number> = { treasure: 0, regular: 0, burrow: 0, bore: 0 };
  for (const layer of ["treasure", "regular", "burrow", "bore"] as const) {
    const indices = candidates.flatMap((entry, index) => entry.layer === layer ? [index] : []);
    const probabilities = indices.map((index) => digRollChance(candidates[index].rate, moon));
    success[layer] = 1 - probabilities.reduce((none, probability) => none * (1 - probability), 1);
    const chosen = digLayerChances(probabilities);
    indices.forEach((index, offset) => { rewards[index] = chosen[offset] * (layer === "treasure" ? 1 : 1 - success.treasure); });
  }
  const successChance = success.treasure + (1 - success.treasure) * (1 - (1 - success.regular) * (1 - success.burrow) * (1 - success.bore));
  return { rewards, successChance, expectedItems: rewards.reduce((sum, chance) => sum + chance, 0) };
}

export function diggingExtras(zone: string, rank: number, moon: number, day: string, weatherItem: string): DigCandidate[] {
  const result: DigCandidate[] = [];
  const items = DIG_DAY_ITEMS[day];
  if (weatherItem) result.push({ item: weatherItem, rate: 10, layer: "regular" });
  if (rank >= 3 && items) result.push({ item: items[0], rate: 5, layer: "regular" });
  if (rank >= 6 && items && weatherItem && moon >= 7 && moon <= 21 && ORE_ZONES.includes(zone)) result.push({ item: items[1], rate: 10, layer: "regular" });
  return result;
}