import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const hash = (content) => createHash("sha256").update(content).digest("hex");
const maps = readJson("src/data/maps.json").maps;
const recipes = readJson("src/data/recipes.json");
const quests = readJson("src/data/quests.json");
const bestiary = readJson("src/data/bestiary.json");
const errors = [];
const warnings = [];
const normalizeZone = (zone) => zone.toLowerCase().replace(/^the /, "").replace(/#/g, "")
  .replace(/\s*\((?:north|south)\)$/, "").replace(/ (?:north|south)$/, "").trim().replace(/^bibiki bay - purgonorgo isle$/, "bibiki bay");
const registry = new Map();
const ids = new Set();
for (const map of maps) {
  if (ids.has(map.id)) errors.push(`Duplicate map ID: ${map.id}`);
  ids.add(map.id);
  if (!existsSync(path.join(root, "public", map.file))) errors.push(`Missing map image: ${map.file}`);
  if (![...(map.cell ?? []), ...(map.origin ?? [])].every(Number.isFinite) || map.cell?.length !== 2 || map.origin?.length !== 2 || map.cell.some((value) => value <= 0)) {
    errors.push(`Invalid grid: ${map.id}`);
  }
  const zone = normalizeZone(map.zone);
  if (!registry.has(zone)) registry.set(zone, new Set());
  registry.get(zone).add(map.mapNo);
}
const missingRefs = new Map();
const entries = [...quests.quests, ...quests.missions];
for (const entry of entries) {
  for (const ref of [...(entry.mapRefs ?? []), ...(entry.stepRefs ?? [])]) {
    const available = registry.get(normalizeZone(ref.zone));
    if (!available || (ref.mapNo != null && !available.has(ref.mapNo))) {
      const key = `${ref.zone} | map ${ref.mapNo ?? "any"}`;
      if (!missingRefs.has(key)) missingRefs.set(key, new Set());
      missingRefs.get(key).add(entry.pageTitle);
    }
  }
  for (const ref of entry.stepRefs ?? []) {
    if (!Number.isInteger(ref.step) || ref.step < 0 || ref.step >= entry.walkthrough.length) errors.push(`Invalid step ref: ${entry.pageTitle} step ${ref.step}`);
  }
}
const recipeIds = new Set();
const recipeEras = {};
const placeholderItems = new Set();
for (const recipe of recipes) {
  if (recipeIds.has(recipe.id)) errors.push(`Duplicate recipe ID: ${recipe.id}`);
  recipeIds.add(recipe.id);
  const era = recipe.era || "base";
  recipeEras[era] = (recipeEras[era] ?? 0) + 1;
  for (const item of [recipe.res, ...recipe.hq, ...recipe.ing]) {
    if (!item.n || !Number.isFinite(item.q) || item.q <= 0) errors.push(`Invalid recipe item: ${recipe.id}`);
    if (/^Item #\d+$/.test(item.n)) placeholderItems.add(item.n);
  }
}
for (const [name, command] of Object.entries(readJson("package.json").scripts)) {
  for (const match of command.matchAll(/\bnode\s+(scripts\/[^\s]+)/g)) {
    if (!existsSync(path.join(root, match[1]))) warnings.push(`Broken command ${name}: ${match[1]} is missing`);
  }
}
const dataFiles = readdirSync(path.join(root, "src/data")).filter((file) => file.endsWith(".json"));
const fingerprints = Object.fromEntries(dataFiles.map((file) => [file, hash(readFileSync(path.join(root, "src/data", file)))]));
const source = { bestiary: bestiary.source };
const serverArg = process.argv.indexOf("--lsb");
if (serverArg >= 0 && !process.argv[serverArg + 1]) throw new Error("--lsb requires a checkout path");
const checkout = path.resolve(serverArg >= 0 ? process.argv[serverArg + 1] : path.join(root, ".lsb-server"));
if (existsSync(path.join(checkout, ".git"))) {
  const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { maxBuffer: 64 * 1024 * 1024 });
  source.serverRevision = git("rev-parse", "HEAD").toString().trim();
  source.serverDirty = Boolean(git("status", "--porcelain").toString().trim());
  source.inputs = {};
  for (const file of ["sql/item_basic.sql", "sql/synth_recipes.sql", "src/map/utils/synthutils.cpp", "src/map/utils/fishingutils.cpp", "settings/default/map.lua"]) {
    try {
      const committed = git("show", `HEAD:${file}`);
      const workingPath = path.join(checkout, file);
      const working = existsSync(workingPath) ? readFileSync(workingPath) : committed;
      const record = { committedSha256: hash(committed), workingSha256: hash(working) };
      const snapshot = path.join(root, "scripts/lsb-data", path.basename(file));
      if (existsSync(snapshot)) {
        const normalizeText = (content) => content.toString("utf8").replace(/\r\n/g, "\n");
        record.snapshotMatches = hash(normalizeText(readFileSync(snapshot))) === hash(normalizeText(working));
        if (!record.snapshotMatches) warnings.push(`Source snapshot differs: ${file}`);
      }
      source.inputs[file] = record;
    } catch {
      warnings.push(`Cannot read server source: ${file}`);
    }
  }
  if (bestiary.source?.revision !== source.serverRevision) warnings.push("Bestiary revision differs from the selected server checkout; regeneration requires its missing generator.");
} else {
  warnings.push("No server checkout available; use --lsb <checkout> for source comparison.");
}
const report = {
  counts: { maps: maps.length, zones: registry.size, recipes: recipes.length, entries: entries.length },
  recipeEras,
  source,
  errors,
  warnings,
  placeholderItems: [...placeholderItems].sort(),
  unresolvedMapRefs: [...missingRefs].map(([reference, pages]) => ({ reference, pages: [...pages].sort() })),
  emptyMissionWalkthroughs: quests.missions.filter((entry) => !entry.walkthrough.length).map((entry) => entry.pageTitle),
  fingerprints,
};
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Maps: ${maps.length} in ${registry.size} zones; recipes: ${recipes.length}; quests/missions: ${entries.length}`);
  console.log(`Server revision: ${source.serverRevision ?? "unavailable"}; bestiary: ${bestiary.source?.revision ?? "unknown"}`);
  console.log(`Integrity errors: ${errors.length}; unresolved recipe item names: ${placeholderItems.size}`);
  for (const error of errors) console.log(`ERROR: ${error}`);
  for (const warning of warnings) console.log(`WARNING: ${warning}`);
  console.log(`Unresolved zone/map pairs: ${missingRefs.size}; empty mission walkthroughs: ${report.emptyMissionWalkthroughs.length}`);
  for (const { reference, pages } of report.unresolvedMapRefs) console.log(`  ${reference}: ${pages.slice(0, 2).join("; ")}${pages.length > 2 ? ` (+${pages.length - 2})` : ""}`);
  console.log("Use --json for full references and SHA-256 dataset fingerprints. Hash equality is not proof of gameplay accuracy.");
}
if (errors.length) process.exitCode = 1;