import { Fragment } from "react";
import NpcLink from "./NpcLink";
import { NPCS } from "./utils/npcs";

const names = [...new Set(NPCS.map((npc) => npc.name).filter((name) => name.length >= 3 && /[a-z]/i.test(name)))].sort((first, second) => second.length - first.length);
const pattern = new RegExp(`(?<![\\w])(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w])`, "g");
const unique = new Map(names.map((name) => {
  const matches = NPCS.filter((npc) => npc.name === name);
  return [name, matches.length === 1 ? matches[0].zone : undefined];
}));

export default function NpcText({ text }: { text: string }) {
  return <>{text.split(pattern).map((part, index) => index % 2 ? <NpcLink key={index} name={part} zone={unique.get(part)} /> : <Fragment key={index}>{part}</Fragment>)}</>;
}