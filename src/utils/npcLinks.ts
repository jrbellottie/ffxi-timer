export function normalizeNpcName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function npcKey(name: string, zone = ""): string {
  return `${normalizeNpcName(zone)}:${normalizeNpcName(name)}`;
}