// Validation: reproduce the HTML's precomputed pool shares from fish.json + bait.json
const bait = require("../src/data/bait.json");
const fish = require("../src/data/fish.json");
const pools = require("../src/data/baitPools.json");

function rarityVal(r) {
  const m = String(r).match(/x\s*([\d.]+)/i);
  return m ? Number(m[1]) : 1;
}

const baitByFish = new Map();
for (const b of bait) {
  if (!b.bait) continue;
  if (!baitByFish.has(b.fish)) baitByFish.set(b.fish, []);
  baitByFish.get(b.fish).push(b);
}

const poolsByKey = new Map();
for (const f of fish) {
  const k = f.zone + "|" + f.area;
  if (!poolsByKey.has(k)) poolsByKey.set(k, []);
  poolsByKey.get(k).push(f);
}

function weight(entry, baitRow) {
  return Math.min(120, Math.max(20, (25 + baitRow.hookBonus) * rarityVal(entry.rarity)));
}

function share(zone, area, fishName, baitName) {
  const members = poolsByKey.get(zone + "|" + area) || [];
  let target = null;
  let total = 0;
  const competing = [];
  for (const m of members) {
    const rows = baitByFish.get(m.catch) || [];
    const row = rows.find((r) => r.bait === baitName);
    if (!row) continue;
    const w = weight(m, row);
    total += w;
    if (m.catch === fishName) target = w;
    else competing.push(m.catch);
  }
  if (target === null) return null;
  return { pct: (100 * target) / total, competing };
}

let ok = 0;
let bad = 0;
let noPool = 0;
const badSamples = [];
for (const p of pools) {
  const r = share(p.zone, p.area, p.fish, p.bait);
  if (!r) {
    noPool++;
    continue;
  }
  if (Math.abs(Math.round(r.pct) - p.sharePct) <= 1) ok++;
  else {
    bad++;
    if (badSamples.length < 6) badSamples.push({ ...p, calc: r.pct.toFixed(1) });
  }
}
console.log("ok:", ok, "bad:", bad, "noPoolMatch:", noPool, "of", pools.length);
if (badSamples.length) console.log(JSON.stringify(badSamples, null, 1));
