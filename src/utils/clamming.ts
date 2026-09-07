import phoenix from "../data/phoenix.json";

export function clammingRates(capacity: number, highTide: boolean): Record<string, number> {
  const tables = phoenix.clamming.lootTable as Record<string, Record<string, { "1": number; "2": number; "3": number }>>;
  const rows = Object.values(tables[capacity] ?? {});
  const total = rows.reduce((sum, row) => sum + row[highTide ? "3" : "2"], 0);
  const counts: Record<string, number> = {};
  for (let roll = 1; roll <= total; roll++) {
    let remaining = roll;
    let item = rows[rows.length - 1]["1"];
    for (const row of rows) {
      remaining -= row["2"];
      if (remaining <= 0) { item = row["1"]; break; }
    }
    counts[item] = (counts[item] ?? 0) + 100 / total;
  }
  return counts;
}

export function clammingLossChance(capacity: number, weight: number, highTide: boolean, swimsuitBody: boolean): number {
  const rates = clammingRates(capacity, highTide);
  const items = phoenix.clamming.itemData as Record<string, { "1": number }>;
  const overweight = Object.entries(rates).reduce((sum, [id, rate]) => sum + (weight + items[id]["1"] > capacity ? rate : 0), 0) / 100;
  const incident = capacity === 200 ? (swimsuitBody ? 0.32 : 0.37) : 0;
  return 100 * (incident + (1 - incident) * overweight);
}