import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import wtf from "wtf_wikipedia";
import sharp from "sharp";
import { displayName, normalizeName } from "./lib/item-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "src/data/itemWiki.json");
const catalog = JSON.parse(readFileSync(path.join(root, "src/data/itemInfo.json"), "utf8"));
const cache = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : { source: { site: "https://ffxiclopedia.fandom.com", license: "CC-BY-SA; individual image rights may differ", attribution: "FFXIclopedia contributors; FINAL FANTASY XI images: Square Enix" }, items: {} };
const onlyArg = process.argv.indexOf("--only");
if (onlyArg >= 0 && !process.argv[onlyArg + 1]) throw new Error("--only requires comma-separated item names");
const only = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1].split(",").map(normalizeName)) : process.argv.includes("--purification")
  ? new Set(JSON.parse(readFileSync(path.join(root, "src/data/purification.json"), "utf8")).exchanges.flat().filter(Boolean).map(normalizeName))
  : null;
const refresh = process.argv.includes("--refresh");
const images = process.argv.includes("--images");
const optimize = process.argv.includes("--optimize");
const imageDirectory = path.join(root, "public/items");
mkdirSync(imageDirectory, { recursive: true });
const save = () => writeFileSync(output, JSON.stringify(cache));
async function api(params) {
  const url = new URL("https://ffxiclopedia.fandom.com/api.php");
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { "User-Agent": "Kupo item reference importer" } });
  if (!response.ok) throw new Error(`Wiki HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.info);
  return data;
}
const wikiTitle = (item) => displayName(item.name.replace(/^[a-z]+ of (?!the )/i, "")).replace(/\bIi\b/g, "II").replace(/\bIii\b/g, "III").replace(/\bIv\b/g, "IV").replace(/\bVi\b/g, "VI");
const targets = Object.entries(catalog.items).filter(([id, item]) => !only || only.has(normalizeName(item.name)) || [...only].some((name) => catalog.names[name] === Number(id)));
if (only && targets.length !== only.size) throw new Error("Some requested names do not resolve uniquely in the item catalog");
const resolvedTitles = new Map();
if (process.argv.includes("--purification")) {
  for (const name of JSON.parse(readFileSync(path.join(root, "src/data/purification.json"), "utf8")).exchanges.flat().filter(Boolean)) {
    const id = String(catalog.names[normalizeName(name)]);
    if (cache.items[id]?.status === "missing") resolvedTitles.set(id, name);
  }
}
if (process.argv.includes("--resolve-missing")) {
  const missing = new Set(targets.filter(([id]) => cache.items[id]?.status === "missing").map(([, item]) => normalizeName(wikiTitle(item))));
  const candidates = new Map();
  let continuation = {};
  let count = 0;
  do {
    const data = await api({ action: "query", list: "allpages", apnamespace: "0", aplimit: "500", ...continuation });
    for (const page of data.query.allpages) {
      const normalized = normalizeName(page.title);
      if (missing.has(normalized)) {
        if (!candidates.has(normalized)) candidates.set(normalized, new Set());
        candidates.get(normalized).add(page.title);
      }
    }
    count += data.query.allpages.length;
    continuation = data.continue;
  } while (continuation);
  for (const [id, item] of targets) {
    const matches = candidates.get(normalizeName(wikiTitle(item)));
    if (cache.items[id]?.status === "missing" && matches?.size === 1) resolvedTitles.set(id, [...matches][0]);
  }
  console.log(`Title index: ${count} titles checked; ${resolvedTitles.size} unique punctuation matches`);
}
const pending = targets.filter(([id]) => refresh || !cache.items[id] || resolvedTitles.has(id));
console.log(`Wiki: ${pending.length} pages to check (${targets.length - pending.length} cached)`);
const text = (value) => typeof value === "string" ? value.replace(/\{\{[^}]*\}\}/g, "").trim() : "";
for (let offset = 0; offset < pending.length; offset += 40) {
  const batch = pending.slice(offset, offset + 40);
  try {
    const data = await api({ action: "query", prop: "revisions", titles: batch.map(([id, item]) => resolvedTitles.get(id) ?? (cache.items[id]?.url ? cache.items[id].title : wikiTitle(item))).join("|"), redirects: "1", rvprop: "content|ids", rvslots: "main" });
    const redirects = new Map([...(data.query.normalized ?? []), ...(data.query.redirects ?? [])].map((entry) => [entry.from, entry.to]));
    const resolve = (title) => {
      const seen = new Set();
      while (redirects.has(title) && !seen.has(title)) { seen.add(title); title = redirects.get(title); }
      return title;
    };
    for (const [id, item] of batch) {
      const title = resolve(resolvedTitles.get(id) ?? (cache.items[id]?.url ? cache.items[id].title : wikiTitle(item)));
      const page = data.query.pages.find((entry) => entry.title === title);
      if (!page || page.missing || !page.revisions?.length) {
        cache.items[id] = { title, status: "missing" };
        continue;
      }
      const revision = page.revisions[0];
      const doc = wtf(revision.slots.main.content);
      const stats = doc.sections().find((section) => /^statistics$/i.test(section.title()));
      const templates = (stats?.templates() ?? []).map((template) => template.json());
      const main = templates.find((template) => ["weapon", "armor", "armour", "item statistics", "shield"].includes(template.template));
      const image = doc.templates().map((template) => template.json()).find((template) => template.template === "item image");
      const fields = Object.fromEntries(Object.entries(main ?? {}).filter(([key, value]) => !["template", "name", "description"].includes(key) && text(value)).map(([key, value]) => [key, text(value)]));
      const effects = templates.filter((template) => ["stat", "effect"].includes(template.template)).map((template) => {
        const values = (template.list ?? []).filter((value) => !["Positive", "Negative", "Neutral"].includes(value));
        return `${values.join(" ")}${template.cap ? ` (cap ${template.cap})` : ""}${template["cap base"] ? `; base ${template["cap base"]}` : ""}`;
      });
      if (effects.length) fields.bonuses = effects.join("\n");
      for (const [key, value] of Object.entries(fields)) if (/^[*\s]*$/.test(value)) delete fields[key];
      const notes = stats?.text()?.trim() ?? "";
      cache.items[id] = {
        title: page.title,
        revision: revision.revid,
        status: stats ? "ok" : "no-statistics",
        url: `https://ffxiclopedia.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        description: text(main?.description), fields, notes,
        ...(image?.list?.[0] ? { imageTitle: `File:${image.list[0].replace(/^File:/i, "")}` } : {}),
        ...(cache.items[id]?.image && cache.items[id].imageTitle === `File:${image?.list?.[0]?.replace(/^File:/i, "")}` ? { image: cache.items[id].image, imageSource: cache.items[id].imageSource } : {}),
      };
    }
    save();
    if (offset % 400 === 0 || offset + 40 >= pending.length) console.log(`Pages checked: ${Math.min(offset + 40, pending.length)}/${pending.length}`);
  } catch (error) {
    save();
    throw new Error(`Stopped after ${offset} pages; rerun to resume. ${error.message}`);
  }
}
if (images) {
  const needed = targets.filter(([id]) => cache.items[id]?.imageTitle && (!cache.items[id].image || !existsSync(path.join(root, "public", cache.items[id].image))));
  console.log(`Tooltip images to cache: ${needed.length}`);
  for (let offset = 0; offset < needed.length; offset += 40) {
    const batch = needed.slice(offset, offset + 40);
    const data = await api({ action: "query", prop: "imageinfo", titles: [...new Set(batch.map(([id]) => cache.items[id].imageTitle))].join("|"), iiprop: "url", redirects: "1" });
    const normalized = new Map([...(data.query.normalized ?? []), ...(data.query.redirects ?? [])].map((entry) => [entry.from, entry.to]));
    for (let start = 0; start < batch.length; start += 4) {
      await Promise.all(batch.slice(start, start + 4).map(async ([id]) => {
        const entry = cache.items[id];
        let title = entry.imageTitle;
        const seen = new Set();
        while (normalized.has(title) && !seen.has(title)) { seen.add(title); title = normalized.get(title); }
        const info = data.query.pages.find((page) => page.title === title)?.imageinfo?.[0];
        if (!info) { entry.imageStatus = "unavailable"; return; }
        try {
          const response = await fetch(info.url, { signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          await sharp(buffer, { limitInputPixels: 16000000 }).webp({ lossless: true, effort: 4 }).toFile(path.join(imageDirectory, `${id}.webp`));
          entry.image = `items/${id}.webp`;
          entry.imageSource = info.descriptionurl;
          delete entry.imageStatus;
        } catch (error) { entry.imageStatus = error.message; }
      }));
    }
    save();
    if (offset % 400 === 0 || offset + 40 >= needed.length) console.log(`Images processed: ${Math.min(offset + 40, needed.length)}/${needed.length}`);
  }
}
if (optimize) {
  const { unlinkSync } = await import("node:fs");
  const existing = Object.entries(cache.items).filter(([, item]) => item.image?.endsWith(".png"));
  for (let offset = 0; offset < existing.length; offset += 4) {
    await Promise.all(existing.slice(offset, offset + 4).map(async ([id, item]) => {
      const original = path.join(root, "public", item.image);
      if (!existsSync(original)) return;
      await sharp(original).webp({ lossless: true, effort: 4 }).toFile(path.join(imageDirectory, `${id}.webp`));
      item.image = `items/${id}.webp`;
    }));
  }
  save();
  for (const [id] of existing) {
    const original = path.join(imageDirectory, `${id}.png`);
    if (cache.items[id].image.endsWith(".webp") && existsSync(original)) unlinkSync(original);
  }
  console.log(`Losslessly optimized ${existing.length} images`);
}
const entries = Object.values(cache.items);
console.log(JSON.stringify({ cached: entries.length, withStatistics: entries.filter((entry) => entry.status === "ok").length, missing: entries.filter((entry) => entry.status === "missing").length, images: entries.filter((entry) => entry.image).length }));