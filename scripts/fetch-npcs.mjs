import { readFileSync, writeFileSync, existsSync } from "node:fs";
import wtf from "wtf_wikipedia";

const directory = new URL("../src/data/", import.meta.url);
const data = JSON.parse(readFileSync(new URL("npcs.json", directory), "utf8"));
const output = new URL("npcWiki.json", directory);
const cache = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : { source: { site: "https://ffxiclopedia.fandom.com", attribution: "FFXIclopedia contributors", license: "CC-BY-SA" }, npcs: {} };
const save = () => writeFileSync(output, JSON.stringify(cache, null, 2) + "\n");
const plain = (value) => typeof value === "string" ? wtf(value).text().trim() : "";
const names = [...new Set(data.npcs.map((npc) => npc.name))].filter((name) => process.argv.includes("--refresh") || !cache.npcs[name]);
for (let offset = 0; offset < names.length; offset += 40) {
  const batch = names.slice(offset, offset + 40);
  const url = new URL("https://ffxiclopedia.fandom.com/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "revisions", rvprop: "content|ids", rvslots: "main", redirects: "1", titles: batch.join("|") });
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Wiki HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.info);
  const redirects = new Map([...(result.query.normalized ?? []), ...(result.query.redirects ?? [])].map((entry) => [entry.from, entry.to]));
  for (const name of batch) {
    let title = name;
    const seen = new Set();
    while (redirects.has(title) && !seen.has(title)) { seen.add(title); title = redirects.get(title); }
    const page = result.query.pages.find((page) => page.title === title);
    const revision = page?.revisions?.[0];
    const raw = revision?.slots.main.content ?? "";
    const template = wtf(raw).templates().map((template) => template.json()).find((template) => template.template === "npc");
    if (!template) { cache.npcs[name] = { status: page?.missing ? "missing" : "no-npc-template" }; continue; }
    const fieldText = (field) => raw.match(new RegExp(`\\|\\s*${field}\\s*=([\\s\\S]*?)(?=\\n\\|\\s*[\\w ]+\\s*=|\\n\\}\\})`, "i"))?.[1]?.trim() ?? "";
    const locationText = fieldText("location");
    const locations = [...locationText.matchAll(/\{\{Location\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi)].map((match) => ({ zone: match[1].trim(), coord: match[2].trim() }));
    cache.npcs[name] = {
      status: "ok", title, revision: revision.revid,
      url: `https://ffxiclopedia.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      locations, location: plain(template.location),
      fields: Object.fromEntries(["gender", "race", "job", "affiliation", "occupation", "type"].map((key) => [key, plain(template[key])]).filter(([, value]) => value)),
      notes: plain(template.notes),
      related: ["starts quests", "involved in quests", "starts missions", "involved in missions"].flatMap((field) => {
        const value = fieldText(field);
        return wtf(value).links().map((link) => ({ name: link.page(), relation: field }));
      }),
    };
  }
  save();
  console.log(`NPC pages: ${Math.min(offset + 40, names.length)}/${names.length}`);
}
console.log(`Cached NPC profiles: ${Object.values(cache.npcs).filter((npc) => npc.status === "ok").length}`);