import { ArrowRight } from "lucide-react";
import "./PurificationInfo.css";
import { abjurationMobs } from "./utils/abjurationDrops";
import NpcLink from "./NpcLink";

type Preview = { name: string; image?: string };

export default function PurificationInfo({ cursed, purified, abjuration, abjurationId, onSelect }: {
  cursed: Preview; purified: Preview; abjuration: string; abjurationId: number; onSelect: (name: string) => void;
}) {
  const mobs = abjurationMobs(abjurationId);
  const preview = (item: Preview) => (
    <button type="button" className="purification-item" onClick={() => onSelect(item.name)} aria-label={`View ${item.name}`}>
      <span>{item.name}</span>
      {item.image && <img src={`${import.meta.env.BASE_URL}${item.image}`} alt={`${item.name} in-game item description`} />}
    </button>
  );
  return (
    <div className="purification-info">
      <div className="purification-pair">
        {preview(cursed)}
        <ArrowRight className="purification-arrow" size={24} aria-label="Purifies into" />
        {preview(purified)}
      </div>
      <div>Requires <button type="button" className="purification-link" onClick={() => onSelect(abjuration)}>{abjuration}</button>{mobs.length > 0 && <> from {mobs.join(", ")}</>}</div>
      <div>Purification: <NpcLink name="Alphollon C Meriard" zone="Northern San d'Oria" />, Northern San d'Oria</div>
    </div>
  );
}