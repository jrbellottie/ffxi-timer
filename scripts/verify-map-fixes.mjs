const data = (await import("../src/data/quests.json", { with: { type: "json" } })).default;
for (const [page, snippets] of Object.entries({
  "Prestige of the Papsque": ["Enter Bostaunieux Oubliette", "Hug the right wall"],
  "The Secret Weapon": ["Yughott Grotto Home Point"],
  "Coming of Age": ["H-10 entrance", "Now head west to D-9"],
  Lightbringer: ["main entrance of the temple", "zone into the Temple", "\"T\" intersection"],
  "Breaking Barriers": ["proceed to a ???", "Key Item #1", "use the Lever", "drop down the hole"],
})) {
  const entry = data.missions.find((mission) => mission.pageTitle === page);
  for (const snippet of snippets) {
    const step = entry.walkthrough.findIndex((text) => text.includes(snippet));
    console.log(page, step, JSON.stringify(entry.stepRefs.filter((ref) => ref.step === step)));
  }
}
const maps = (await import("../src/data/maps.json", { with: { type: "json" } })).default.maps;
console.log("Valley maps:", maps.filter((map) => map.zone === "Valley of Sorrows").map((map) => map.name));
