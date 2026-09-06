import { navigateToTab, getCurrentTab } from "./utils/tabNav";
import { npcKey } from "./utils/npcLinks";

export default function NpcLink({ name, zone, from }: { name: string; zone?: string | null; from?: string }) {
  return <button type="button" title={`View ${name}${zone ? ` in ${zone}` : ""}`} onClick={(event) => {
    event.stopPropagation();
    navigateToTab("npc", zone ? npcKey(name, zone) : name, from ?? getCurrentTab());
  }} style={{ background: "none", border: 0, padding: 0, color: "#7ec4e8", font: "inherit", textAlign: "left", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", overflowWrap: "anywhere" }}>{name}</button>;
}