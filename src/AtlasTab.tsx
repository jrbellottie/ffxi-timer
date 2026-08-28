// src/AtlasTab.tsx — browse FFXI zone maps with a hoverable coordinate grid.
import React, { useMemo, useState } from "react";
import MapView, { MapDef } from "./MapView";
import mapData from "./data/maps.json";

const MAPS = (mapData as { maps: MapDef[] }).maps;

const inputStyle: React.CSSProperties = {
  background: "#0c0c0c",
  color: "#eaeaea",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
};

export default function AtlasTab() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coord, setCoord] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? MAPS.filter((m) => m.name.toLowerCase().includes(q)) : MAPS;
  }, [query]);

  const selected = MAPS.find((m) => m.id === selectedId) ?? filtered[0] ?? null;
  const coordValid = /^[A-Pa-p]-\d{1,2}$/.test(coord.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, minWidth: 220 }}
          placeholder="Search maps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={inputStyle} value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
          {filtered.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          style={{ ...inputStyle, width: 150 }}
          placeholder="Highlight cell (H-9)"
          title="Type a coordinate like H-9 to highlight that grid cell on the map"
          value={coord}
          onChange={(e) => setCoord(e.target.value)}
        />
        <span style={{ color: "#9aa0b8", fontSize: 12 }}>{MAPS.length} maps — hover the map to read coordinates</span>
      </div>

      {selected && (
        <MapView map={selected} width={560} showHoverCell highlight={coordValid ? coord.trim() : null} />
      )}
    </div>
  );
}
