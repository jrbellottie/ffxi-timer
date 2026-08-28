const d = (await import("../src/data/quests.json", { with: { type: "json" } })).default;
const show = (page, snippets) => {
  const e = d.missions.find((x) => x.pageTitle === page);
  console.log(`== ${page} | start: ${e.startNpc} @ ${e.startZone} (${e.startCoord})`);
  console.log("   mapRefs:", JSON.stringify(e.mapRefs.slice(0, 8)));
  e.walkthrough.forEach((s, i) => {
    if (snippets.some((n) => s.includes(n))) {
      console.log(i, JSON.stringify(s.trim().slice(0, 140)));
      console.log("   ", JSON.stringify(e.stepRefs.filter((r) => r.step === i)));
    }
  });
};
show("Magicite (Bastok)", []);
show("The Pirate's Cove", ["lava puddle"]);
show("The Chains That Bind Us", ["through the caves to", "another weighted door"]);
