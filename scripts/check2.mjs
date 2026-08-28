const d = (await import("../src/data/quests.json", { with: { type: "json" } })).default;
const MAPS = (await import("../src/data/maps.json", { with: { type: "json" } })).default.maps;
const normZone = (z) =>
  z.toLowerCase().replace(/^the /, "").replace(/#/g, "").replace(/\s*\((?:north|south)\)$/, "").replace(/ (?:north|south)$/, "").trim();

const e = d.missions.find((x) => x.pageTitle === "Magicite (Bastok)");
const refs = [...(e.mapRefs ?? []), ...(e.stepRefs ?? [])];
if (e.startZone && !refs.some((r) => normZone(r.zone) === normZone(e.startZone))) {
  refs.unshift({ zone: e.startZone, mapNo: null, pos: e.startCoord ?? "" });
}
// shownMaps as the UI builds them
const shown = [];
for (const ref of refs) {
  for (const m of MAPS) {
    if (normZone(m.zone) !== normZone(ref.zone)) continue;
    if (ref.mapNo != null && m.mapNo !== ref.mapNo) continue;
    if (!shown.includes(m)) shown.push(m);
  }
}
console.log("shownMaps:", shown.map((m) => m.name));
// start NPC H-10 hover: global refs matching pos
const rs = refs.filter((r) => r.pos === "H-10");
console.log("H-10 refs:", JSON.stringify(rs));
const resolved = MAPS.filter((m) => rs.some((r) => normZone(r.zone) === normZone(m.zone) && (r.mapNo == null || r.mapNo === m.mapNo)));
console.log("H-10 resolves to:", resolved.map((m) => m.name));
