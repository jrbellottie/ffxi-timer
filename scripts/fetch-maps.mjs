// Downloads FFXI zone map images from ffxiclopedia into public/maps/ and writes src/data/maps.json.
// Zones are discovered from src/data/quests.json (start zones + walkthrough map references).
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { detectGrid } from "./detect-grid.mjs";

const FFXI = "https://ffxiclopedia.fandom.com/api.php";
const UA = "kupo-app map importer (personal offline FFXI tool)";

const root = path.resolve(import.meta.dirname, "..");
const slug = (s) => s.toLowerCase().replace(/[''’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zone-name aliases that appear in quest data but aren't the wiki page name
const ALIASES = new Map([
  ["The Sanctuary of Zi'Tah", "Sanctuary of Zi'Tah"],
  ["The Shrine of Ru'Avitau", "Shrine of Ru'Avitau"],
  ["Riverne - Site A01", "Riverne - Site #A01"],
  ["Windurst Waters North", "Windurst Waters"],
  ["Windurst Waters (North)", "Windurst Waters"],
  ["Bibiki Bay - Purgonorgo Isle", "Bibiki Bay"],
]);

// Known wiki filename quirks per zone
const EXTRA_NAMES = new Map([
  ["Pashhow Marshlands", ["Pashow Marshlands"]], // wiki filename typo
]);

// Maps that can't be discovered from the zone page; [mapNo, wiki file] pairs
const MAP_OVERRIDES = new Map([
  ["Palborough Mines", [[1, "File:Palborough1.png"], [2, "File:Palborough2.png"], [3, "File:Palborough3.png"]]],
  ["Alzadaal Undersea Ruins", [[1, "File:Alzadaal Undersea Ruins1a.jpg"], [2, "File:Alzadaal Undersea Ruins2a.jpg"], [3, "File:Alzadaal Undersea Ruins3a.jpg"], [4, "File:Alzadaal Undersea Ruins4a.jpg"], [5, "File:Alzadaal Undersea Ruins5a.jpg"], [6, "File:Alzadaal Undersea Ruins6a.jpg"], [7, "File:Alzadaal Undersea Ruins7a.jpg"]]],
  ["Grand Palace of Hu'Xzoi", [[1, "File:HuXzoi1.jpg"], [2, "File:HuXzoi2.jpg"], [3, "File:HuXzoi3.jpg"]]],
  ["Riverne - Site #A01", [[1, "File:RiverneSiteA01.png"]]],
  ["Riverne - Site B01", [[1, "File:RiverneSiteB01.png"]]],
  ["Ru'Aun Gardens", [[1, "File:RuAunGardensMain.png"]]],
  ["Shrine of Ru'Avitau", [[1, "File:RuAvitau1.png"], [2, "File:RuAvitau2.png"], [3, "File:RuAvitau3.png"], [4, "File:RuAvitau4.png"], [5, "File:RuAvitau5.png"], [6, "File:RuAvitau6.png"]]],
]);

/** Possible squashed filename stems for a zone (handles "Bastok-port", "Jeuno-lower", "Zitah-sanctuary"). */
function altSquashes(zone) {
  const names = new Set();
  const base = zone.replace(/^The /i, "");
  names.add(squash(zone));
  names.add(squash(base));
  const words = base.split(/[\s-]+/).filter((w) => !/^(?:of|the)$/i.test(w));
  if (words.length === 2) names.add(squash(words[1] + words[0])); // "Port Bastok" -> bastokport
  const lmu = base.match(/^(?:Lower|Middle|Upper) (.+)$/i);
  if (lmu) names.add(squash(lmu[1])); // shared dungeon maps: "Lower Delkfutt's Tower" -> delkfuttstower
  for (const extra of EXTRA_NAMES.get(zone) ?? []) names.add(squash(extra));
  return [...names];
}

async function api(params) {
  const url = `${FFXI}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}\n  -> ${e.message}`);
      await sleep(1000 * attempt);
    }
  }
}

// Zones referenced by the quest data
const questData = JSON.parse(await readFile(path.join(root, "src", "data", "quests.json"), "utf8"));
const zoneSet = new Set();
for (const e of [...questData.quests, ...questData.missions]) {
  if (e.startZone) zoneSet.add(e.startZone);
  for (const r of e.mapRefs ?? []) zoneSet.add(r.zone);
}
const zones = [...new Set([...zoneSet].map((z) => ALIASES.get(z) ?? z))].sort();
console.log(`${zones.length} candidate zones from quest data`);

const outDir = path.join(root, "public", "maps");
await mkdir(outDir, { recursive: true });

const entries = [];
const noMaps = [];
const urlCache = new Map(); // remote url -> local file (shared dungeon maps)
for (const zone of zones) {
  let candidates = [];
  if (MAP_OVERRIDES.has(zone)) {
    candidates = MAP_OVERRIDES.get(zone).map(([mapNo, file]) => ({ file, mapNo, label: "", ext: "png" }));
  } else {
    const q = await api({ action: "query", prop: "images", imlimit: "300", redirects: "1", titles: zone });
    const page = q.query?.pages?.[0];
    if (!page || page.missing) { noMaps.push(zone + " (no page)"); continue; }
    // e.g. SeaSerpentGrotto3.png, Quicksand-caves 2.png, Bastok-port.png, Windurst-waters-north.png
    const re = new RegExp(`^(?:${altSquashes(zone).join("|")})(?:map)?(north|south)?(\\d*)$`);
    for (const img of page.images ?? []) {
      const m = img.title.match(/^File:(.+)\.(png|jpe?g|gif)$/i);
      if (!m) continue;
      if (/-pic$/i.test(m[1].trim())) continue; // zone photos, not maps
      const hit = squash(m[1]).match(re);
      if (!hit) continue;
      const mapNo = hit[2] ? parseInt(hit[2], 10) : hit[1] === "north" ? 2 : 1;
      const label = hit[1] ? ` (${hit[1][0].toUpperCase()}${hit[1].slice(1)})` : "";
      candidates.push({ file: img.title, mapNo, label, ext: m[2].toLowerCase() });
    }
  }
  // Candidates per map number, best first (png and numbered names preferred; bare are often photos)
  const byNo = new Map();
  const pref = (c) => (c.ext === "png" ? 0 : 2) + (/\d$/.test(squash(c.file.replace(/\.[^.]+$/, ""))) ? 0 : 1);
  for (const c of candidates.sort((a, b) => pref(a) - pref(b))) {
    if (!byNo.has(c.mapNo)) byNo.set(c.mapNo, []);
    byNo.get(c.mapNo).push(c);
  }
  if (!byNo.size) { noMaps.push(zone); continue; }

  for (const [mapNo, cands] of [...byNo].sort((a, b) => a[0] - b[0])) {
    let done = false;
    for (const c of cands) {
      if (done) break;
      const info = await api({ action: "query", prop: "imageinfo", iiprop: "url", titles: c.file });
      const url = info.query?.pages?.[0]?.imageinfo?.[0]?.url;
      if (!url) continue;
      let local = urlCache.get(url);
      if (!local) {
        local = `${slug(zone)}-${mapNo}.png`;
        if (!existsSync(path.join(outDir, local))) {
          try {
            const raw = Buffer.from(await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer()));
            // Palette PNG keeps parchment maps small (~5x reduction, no visible loss)
            await writeFile(path.join(outDir, local), await sharp(raw).png({ palette: true, compressionLevel: 9 }).toBuffer());
          } catch (e) {
            console.log(`  ! download failed for ${c.file}: ${e.message}`);
            continue;
          }
          await sleep(120);
        }
        urlCache.set(url, local);
      }
      // Measure this map's grid pitch/phase; grid lines mark cell top-left corners
      const FALLBACK = { cell: 31.94 / 512, origin: 16.5 / 512 };
      let gx = FALLBACK, gy = FALLBACK;
      try {
        const meta = await sharp(path.join(outDir, local)).metadata();
        // Scenery screenshots masquerading as maps are never square
        if (Math.abs(meta.width - meta.height) / Math.max(meta.width, meta.height) > 0.05) {
          console.log(`  ! rejected non-square ${c.file} for ${zone} Map ${mapNo} (${meta.width}x${meta.height})`);
          urlCache.delete(url);
          await unlink(path.join(outDir, local)).catch(() => {});
          continue;
        }
        const g = await detectGrid(path.join(outDir, local));
        // Grid lines mark cell top-left corners: cell K spans [line_K, line_K+1]
        const toEdge = (a) => {
          if (!a) return null;
          const pitch = a.cell;
          let edge = a.origin % pitch;
          if (edge > pitch * 0.75) edge -= pitch;
          return { cell: pitch, origin: edge };
        };
        gx = toEdge(g.x) ?? FALLBACK;
        gy = toEdge(g.y) ?? FALLBACK;
      } catch { /* keep fallback */ }
      entries.push({
        id: `${slug(zone)}-${mapNo}`,
        zone,
        mapNo,
        name: byNo.size > 1 ? `${zone} - Map ${mapNo}${c.label}` : `${zone}${c.label}`,
        file: `maps/${local}`,
        cell: [+gx.cell.toFixed(5), +gy.cell.toFixed(5)],
        origin: [+gx.origin.toFixed(5), +gy.origin.toFixed(5)],
      });
      done = true;
    }
  }
  process.stdout.write(`\r  ${entries.length} maps collected (${zone})                              `);
  await sleep(120);
}
process.stdout.write("\n");

entries.sort((a, b) => a.zone.localeCompare(b.zone) || a.mapNo - b.mapNo);
await writeFile(path.join(root, "src", "data", "maps.json"), JSON.stringify({ maps: entries }, null, 1));
console.log(`Wrote src/data/maps.json (${entries.length} maps, ${new Set(entries.map((e) => e.zone)).size} zones)`);
console.log(`Zones with no maps found (${noMaps.length}):`);
for (const z of noMaps) console.log(`  - ${z}`);
