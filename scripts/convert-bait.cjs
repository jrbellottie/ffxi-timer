// One-time converter: fish_bait_toau_era.html -> src/data/bait.json + src/data/baitPools.json
// Run: node scripts/convert-bait.cjs   (delete after use if desired)
const fs = require("fs");

const html = fs.readFileSync("fish_bait_toau_era.html", "utf8");

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseRows(chunk) {
  return [...chunk.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decode(c[1].replace(/<[^>]+>/g, "")))
  );
}

// ---- Section boundaries ----
const howIdx = html.indexOf("How Bait Works");
const poolIdx = html.indexOf("Best Bait to Target Each Fish per Zone/Area Pool");
if (howIdx < 0 || poolIdx < 0) throw new Error("Section headers not found");

// ---- Table 1: Fish x Bait ----
const affinity = [];
{
  const rows = parseRows(html.slice(0, howIdx));
  let started = false;
  for (const cells of rows) {
    if (!started) {
      if (cells[0] === "Fish" && cells[1] === "Lvl") started = true;
      continue;
    }
    if (cells.length === 0 || cells[0] === "") continue;

    const fish = cells[0];
    const lvl = Number(cells[1]);
    const size = cells[2];

    if (/no bait data/i.test(cells[3] ?? "")) {
      affinity.push({
        fish,
        lvl: Number.isFinite(lvl) ? lvl : null,
        size,
        bait: null,
        kind: null,
        bite: null,
        hookBonus: null,
        best: false,
        note: "No bait data",
      });
      continue;
    }
    if (cells.length < 8) continue;

    const bonusMatch = (cells[6] ?? "").match(/[+-]?\d+/);
    affinity.push({
      fish,
      lvl: Number.isFinite(lvl) ? lvl : null,
      size,
      bait: cells[3],
      kind: cells[4],
      bite: cells[5],
      hookBonus: bonusMatch ? Number(bonusMatch[0]) : null,
      best: /BEST/i.test(cells[7] ?? ""),
      note: (cells[8] ?? "").trim() || null,
    });
  }
}

// ---- Table 2: Best bait per zone/area pool ----
const pools = [];
{
  const rows = parseRows(html.slice(poolIdx));
  let started = false;
  for (const cells of rows) {
    if (!started) {
      if (cells[0] === "Zone" && cells[1] === "Area") started = true;
      continue;
    }
    if (cells.length < 7 || cells[0] === "") continue;

    const lvl = Number(cells[3]);
    const shareMatch = (cells[6] ?? "").match(/(\d+(?:\.\d+)?)\s*%/);
    const competingRaw = (cells[7] ?? "").trim();
    const competing = competingRaw
      ? competingRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    pools.push({
      zone: cells[0],
      area: cells[1],
      fish: cells[2],
      lvl: Number.isFinite(lvl) ? lvl : null,
      bait: cells[4],
      bite: cells[5],
      sharePct: shareMatch ? Number(shareMatch[1]) : null,
      competing,
    });
  }
}

fs.writeFileSync("src/data/bait.json", JSON.stringify(affinity, null, 1));
fs.writeFileSync("src/data/baitPools.json", JSON.stringify(pools, null, 1));

console.log("bait.json:", affinity.length, "rows");
console.log("baitPools.json:", pools.length, "rows");
console.log("Affinity kinds:", [...new Set(affinity.map((o) => o.kind).filter(Boolean))]);
console.log("Affinity bites:", [...new Set(affinity.map((o) => o.bite).filter(Boolean))]);
console.log("Pool bites:", [...new Set(pools.map((o) => o.bite))]);
console.log("Pool zones:", new Set(pools.map((o) => o.zone)).size);
console.log("Pool share range:", Math.min(...pools.map((p) => p.sharePct ?? 999)), "-", Math.max(...pools.map((p) => p.sharePct ?? -1)));
console.log("Sample pool:", JSON.stringify(pools[4]));
console.log("Max competing:", Math.max(...pools.map((p) => p.competing.length)));
