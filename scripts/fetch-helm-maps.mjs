import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const wiki = "https://ffxiclopedia.fandom.com";
const headers = { "User-Agent": "kupo-app map importer (personal offline FFXI tool)" };
const kinds = ["Mining", "Harvesting", "Excavation", "Logging"];
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const zoneName = value => value.replace(/ S$/, " (S)").replace("Ifrits", "Ifrit's").replace(" Of ", " of ");
const snapshot = JSON.parse(await readFile(path.join(root, "src/data/phoenix.json"), "utf8"));
const zones = snapshot.helmZones.filter(zone => !zone.zone.startsWith("Abyssea "));
const output = path.join(root, "public/maps/helm");
await mkdir(output, { recursive: true });

async function api(params) {
  const url = new URL("/api.php", wiki);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

const images = new Map(kinds.map(kind => [kind, new Set()]));
let continuation = {};
do {
  const data = await api({ action: "query", prop: "images", titles: kinds.join("|"), imlimit: "500", ...continuation });
  for (const page of data.query?.pages ?? []) {
    for (const image of page.images ?? []) images.get(page.title)?.add(image.title);
  }
  continuation = data.continue;
} while (continuation);

const maps = [];
const missing = [];
for (const zone of zones) {
  const candidates = [...images.get(zone.kind)].flatMap(title => {
    const match = title.match(/^File:(.+?)(Mining|Harvesting|Excavation|Excavating|Logging)(\d*)\.(png|jpe?g|gif)$/i);
    if (!match) return [];
    const stem = normalize(match[1]);
    const matchesZone = stem === normalize(zone.zone) || (zone.zone === "West Sarutabaruta" && stem === "sarutabarutawest");
    const kind = /^excavat/i.test(match[2]) ? "Excavation" : match[2];
    return matchesZone && kind.toLowerCase() === zone.kind.toLowerCase() ? [{ title, sheet: Number(match[3] || 1) }] : [];
  }).sort((first, second) => first.sheet - second.sheet || first.title.localeCompare(second.title));
  if (!candidates.length) {
    missing.push({ kind: zone.kind, zone: zone.zone, zoneId: zone.zoneId });
    continue;
  }
  for (const candidate of candidates) {
    const data = await api({ action: "query", prop: "imageinfo", titles: candidate.title, iiprop: "url|timestamp" });
    const info = data.query?.pages?.[0]?.imageinfo?.[0];
    if (!info?.url) throw new Error(`Missing image URL: ${candidate.title}`);
    const response = await fetch(info.url, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${candidate.title}: HTTP ${response.status}`);
    const raw = Buffer.from(await response.arrayBuffer());
    const image = await sharp(raw).png({ compressionLevel: 9 }).toBuffer();
    const metadata = await sharp(image).metadata();
    if (metadata.width < 400 || metadata.height < 400) throw new Error(`Unexpected map dimensions: ${candidate.title}`);
    const id = `${zone.kind.toLowerCase()}-${zone.zoneId}-${candidate.sheet}`;
    if (maps.some(map => map.id === id)) throw new Error(`Duplicate map: ${id}`);
    const file = `maps/helm/${id}.png`;
    await writeFile(path.join(root, "public", file), image);
    maps.push({
      id, kind: zone.kind, zone: zone.zone, zoneId: zone.zoneId,
      name: `${zoneName(zone.zone)} - ${zone.kind}${candidates.length > 1 ? ` (sheet ${candidate.sheet})` : ""}`,
      file, width: metadata.width, height: metadata.height,
      wikiFile: candidate.title,
      sourceUrl: info.descriptionurl,
      activityUrl: `${wiki}/wiki/${zone.kind}`,
      imageUrl: info.url,
      imageRevision: info.timestamp,
      sha256: createHash("sha256").update(image).digest("hex"),
    });
    console.log(`${zone.kind}: ${zone.zone} / ${candidate.title}`);
  }
}
maps.sort((first, second) => first.kind.localeCompare(second.kind) || first.zone.localeCompare(second.zone) || first.id.localeCompare(second.id));
await writeFile(path.join(root, "src/data/helmMaps.json"), `${JSON.stringify({ source: wiki, maps, missing }, null, 2)}\n`);
console.log(`Bundled ${maps.length} gathering maps for ${zones.length - missing.length}/${zones.length} activity/zone combinations.`);
for (const zone of missing) console.log(`No annotated map found: ${zone.kind} / ${zone.zone}`);