// src/MapView.tsx — renders an FFXI zone map with a highlightable coordinate grid cell.
import React, { useState } from "react";

export type MapDef = {
  id: string;
  zone: string;
  mapNo: number;
  name: string;
  file: string;
  cell: [number, number]; // grid cell size (x, y) as fractions of the image
  origin: [number, number];
};

export function cellRect(map: MapDef, coord: string): { left: number; top: number; w: number; h: number } | null {
  const m = coord.toUpperCase().match(/^([A-P])-(\d{1,2})$/);
  if (!m) return null;
  const col = m[1].charCodeAt(0) - 65;
  const row = parseInt(m[2], 10) - 1;
  const left = map.origin[0] + col * map.cell[0];
  const top = map.origin[1] + row * map.cell[1];
  if (left >= 1 || top >= 1) return null;
  return { left, top, w: map.cell[0], h: map.cell[1] };
}

export default function MapView({
  map,
  highlight,
  width = 420,
  showHoverCell = false,
}: {
  map: MapDef;
  highlight?: string | null;
  width?: number;
  /** Atlas mode: show the grid cell under the mouse cursor. */
  showHoverCell?: boolean;
}) {
  const [hoverCoord, setHoverCoord] = useState<string | null>(null);
  const rect = highlight ? cellRect(map, highlight) : null;
  const hoverRect = hoverCoord ? cellRect(map, hoverCoord) : null;

  const onMouseMove = showHoverCell
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const fx = (e.clientX - box.left) / box.width;
        const fy = (e.clientY - box.top) / box.height;
        const col = Math.floor((fx - map.origin[0]) / map.cell[0]);
        const row = Math.floor((fy - map.origin[1]) / map.cell[1]);
        if (col >= 0 && col < 16 && row >= 0 && row < 16) {
          setHoverCoord(`${String.fromCharCode(65 + col)}-${row + 1}`);
        } else setHoverCoord(null);
      }
    : undefined;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9aa0b8" }}>
        {map.name}
        {showHoverCell && hoverCoord && <span style={{ color: "#4dabf7" }}> — {hoverCoord}</span>}
        {!showHoverCell && highlight && rect && <span style={{ color: "#4dabf7" }}> — {highlight.toUpperCase()}</span>}
      </div>
      <div
        style={{ position: "relative", width, lineHeight: 0, border: "1px solid #2a2a2a", borderRadius: 6, overflow: "hidden", cursor: showHoverCell ? "crosshair" : "default" }}
        onMouseMove={onMouseMove}
        onMouseLeave={showHoverCell ? () => setHoverCoord(null) : undefined}
      >
        <img src={map.file} alt={map.name} style={{ width: "100%", display: "block" }} draggable={false} />
        {[rect, showHoverCell ? hoverRect : null].map(
          (r, i) =>
            r && (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${r.left * 100}%`,
                  top: `${r.top * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  background: "rgba(77, 171, 247, 0.30)",
                  border: "2px solid #1c7ed6",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            )
        )}
      </div>
    </div>
  );
}
