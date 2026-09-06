import data from "../data/purification.json";
import { normalizeItemName } from "./itemLinks";

type Purification = { result: string; abjuration: string };
const exchanges = new Map<string, Purification>();
const origins = new Map<string, { cursed: string; abjuration: string }>();
for (const [cursed, abjuration, result, hq] of data.exchanges as [string, string, string, string | null][]) {
  exchanges.set(normalizeItemName(cursed), { result, abjuration });
  origins.set(normalizeItemName(result), { cursed, abjuration });
  if (hq) {
    exchanges.set(normalizeItemName(`${cursed} -1`), { result: hq, abjuration });
    origins.set(normalizeItemName(hq), { cursed: `${cursed} -1`, abjuration });
  }
}

export function getPurificationOrigin(name: string) {
  return origins.get(normalizeItemName(name));
}

export function getPurification(name: string): Purification | undefined {
  return exchanges.get(normalizeItemName(name.replace(/\s*\(desynth\)$/i, "")));
}

export function purificationMatches(name: string, query: string): boolean {
  const exchange = getPurification(name);
  return !!exchange && [exchange.result, exchange.abjuration].some((value) => normalizeItemName(value).includes(query));
}