// src/FishTab.tsx
import React, { useMemo, useState } from "react";
import { styles } from "./styles";
import fishData from "./data/fish.json";

type FishEntry = {
  zone: string;
  area: string;
  catch: string;
  lvl: number | null;
  size: string;
  str: number | null;
  type: string;
  legendary: string | null;
  bestMoon: string;
  bestTime: string;
  bestSeason: string;
  rarity: string;
};

const FISH: FishEntry[] = fishData as FishEntry[];

type SortKey =
  | "zone"
  | "area"
  | "catch"
  | "lvl"
  | "size"
  | "str"
  | "type"
  | "legendary"
  | "bestMoon"
  | "bestTime"
  | "bestSeason"
  | "rarity";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "zone", label: "Zone" },
  { key: "area", label: "Area" },
  { key: "catch", label: "Catch" },
  { key: "lvl", label: "Lvl", numeric: true },
  { key: "size", label: "Size" },
  { key: "str", label: "Str", numeric: true },
  { key: "type", label: "Type" },
  { key: "legendary", label: "Legendary" },
  { key: "bestMoon", label: "Best Moon" },
  { key: "bestTime", label: "Best Time" },
  { key: "bestSeason", label: "Best Season" },
  { key: "rarity", label: "Rarity", numeric: true },
];

const MAX_VISIBLE_ROWS = 300;

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null && v !== ""))].sort((a, b) =>
    a.localeCompare(b)
  );
}

const ZONES = uniqueSorted(FISH.map((f) => f.zone));
const TYPES = uniqueSorted(FISH.map((f) => f.type));
const SIZES = uniqueSorted(FISH.map((f) => f.size));
const MOONS = uniqueSorted(FISH.map((f) => f.bestMoon));
const TIMES = uniqueSorted(FISH.map((f) => f.bestTime));
const SEASONS = uniqueSorted(FISH.map((f) => f.bestSeason));

/** Rarity like "x0.7" → 0.7; "-" (no penalty) sorts as 1. */
function rarityValue(rarity: string): number {
  const m = rarity.match(/x\s*([\d.]+)/i);
  return m ? Number(m[1]) : 1;
}

function compareEntries(a: FishEntry, b: FishEntry, key: SortKey, dir: SortDir): number {
  let cmp = 0;

  if (key === "lvl" || key === "str") {
    const av = a[key];
    const bv = b[key];
    // Nulls always sort last regardless of direction.
    if (av === null && bv === null) cmp = 0;
    else if (av === null) return 1;
    else if (bv === null) return -1;
    else cmp = av - bv;
  } else if (key === "rarity") {
    cmp = rarityValue(a.rarity) - rarityValue(b.rarity);
  } else {
    const av = (a[key] ?? "") as string;
    const bv = (b[key] ?? "") as string;
    cmp = av.localeCompare(bv);
  }

  return dir === "asc" ? cmp : -cmp;
}

const optionBaseStyle: React.CSSProperties = {
  backgroundColor: "#0c0c0c",
  color: "#eaeaea",
};

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#161616",
  color: "#eaeaea",
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
  borderBottom: "1px solid #444",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

export default function FishTab() {
  // Text filters (substring, case-insensitive)
  const [qGlobal, setQGlobal] = useState("");
  const [qCatch, setQCatch] = useState("");
  const [qArea, setQArea] = useState("");

  // Dropdown filters ("" = any)
  const [fZone, setFZone] = useState("");
  const [fType, setFType] = useState("");
  const [fSize, setFSize] = useState("");
  const [fMoon, setFMoon] = useState("");
  const [fTime, setFTime] = useState("");
  const [fSeason, setFSeason] = useState("");
  const [fLegendaryOnly, setFLegendaryOnly] = useState(false);

  // Level range (useful for "what can I catch at my skill?")
  const [lvlMin, setLvlMin] = useState("");
  const [lvlMax, setLvlMax] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("catch");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setQGlobal("");
    setQCatch("");
    setQArea("");
    setFZone("");
    setFType("");
    setFSize("");
    setFMoon("");
    setFTime("");
    setFSeason("");
    setFLegendaryOnly(false);
    setLvlMin("");
    setLvlMax("");
  }

  const anyFilterActive =
    qGlobal.trim() !== "" ||
    qCatch.trim() !== "" ||
    qArea.trim() !== "" ||
    fZone !== "" ||
    fType !== "" ||
    fSize !== "" ||
    fMoon !== "" ||
    fTime !== "" ||
    fSeason !== "" ||
    fLegendaryOnly ||
    lvlMin.trim() !== "" ||
    lvlMax.trim() !== "";

  const results = useMemo(() => {
    const g = qGlobal.trim().toLowerCase();
    const c = qCatch.trim().toLowerCase();
    const a = qArea.trim().toLowerCase();
    const min = lvlMin.trim() === "" ? null : Number(lvlMin);
    const max = lvlMax.trim() === "" ? null : Number(lvlMax);
    const minOk = min === null || Number.isFinite(min);
    const maxOk = max === null || Number.isFinite(max);

    const filtered = FISH.filter((f) => {
      if (fZone && f.zone !== fZone) return false;
      if (fType && f.type !== fType) return false;
      if (fSize && f.size !== fSize) return false;
      if (fMoon && f.bestMoon !== fMoon) return false;
      if (fTime && f.bestTime !== fTime) return false;
      if (fSeason && f.bestSeason !== fSeason) return false;
      if (fLegendaryOnly && f.legendary !== "YES") return false;

      if (c && !f.catch.toLowerCase().includes(c)) return false;
      if (a && !f.area.toLowerCase().includes(a)) return false;

      if (minOk && min !== null && (f.lvl === null || f.lvl < min)) return false;
      if (maxOk && max !== null && (f.lvl === null || f.lvl > max)) return false;

      if (g) {
        const haystack = [
          f.zone,
          f.area,
          f.catch,
          f.lvl === null ? "" : String(f.lvl),
          f.size,
          f.str === null ? "" : String(f.str),
          f.type,
          f.legendary ?? "",
          f.bestMoon,
          f.bestTime,
          f.bestSeason,
          f.rarity,
        ]
          .join(" | ")
          .toLowerCase();
        if (!haystack.includes(g)) return false;
      }

      return true;
    });

    return filtered.sort((x, y) => compareEntries(x, y, sortKey, sortDir));
  }, [qGlobal, qCatch, qArea, fZone, fType, fSize, fMoon, fTime, fSeason, fLegendaryOnly, lvlMin, lvlMax, sortKey, sortDir]);

  const visible = results.slice(0, MAX_VISIBLE_ROWS);

  const selectFilter = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options: string[]
  ) => (
    <div style={{ ...styles.field, width: 170 }}>
      <div style={styles.label}>{label}</div>
      <select style={styles.selectCompact} value={value} onChange={(e) => setter(e.target.value)}>
        <option value="" style={optionBaseStyle}>
          Any
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={optionBaseStyle}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>Fish Finder</h3>
        <div style={styles.sub}>
          {results.length.toLocaleString()} of {FISH.length.toLocaleString()} entries
          {results.length > MAX_VISIBLE_ROWS ? ` (showing first ${MAX_VISIBLE_ROWS} — refine filters)` : ""}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <div style={styles.subCard}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ ...styles.field, width: 260 }}>
              <div style={styles.label}>Search everything</div>
              <input
                style={styles.inputCompact}
                value={qGlobal}
                onChange={(e) => setQGlobal(e.target.value)}
                placeholder="e.g. shining trout"
              />
            </div>

            <div style={{ ...styles.field, width: 200 }}>
              <div style={styles.label}>Catch</div>
              <input
                style={styles.inputCompact}
                value={qCatch}
                onChange={(e) => setQCatch(e.target.value)}
                placeholder="e.g. carp"
              />
            </div>

            <div style={{ ...styles.field, width: 200 }}>
              <div style={styles.label}>Area</div>
              <input
                style={styles.inputCompact}
                value={qArea}
                onChange={(e) => setQArea(e.target.value)}
                placeholder="e.g. whole zone"
              />
            </div>

            {selectFilter("Zone", fZone, setFZone, ZONES)}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {selectFilter("Type", fType, setFType, TYPES)}
            {selectFilter("Size", fSize, setFSize, SIZES)}
            {selectFilter("Best Moon", fMoon, setFMoon, MOONS)}
            {selectFilter("Best Time", fTime, setFTime, TIMES)}
            {selectFilter("Best Season", fSeason, setFSeason, SEASONS)}

            <div style={{ ...styles.field, width: 90 }}>
              <div style={styles.label}>Lvl min</div>
              <input
                style={styles.inputCompact}
                type="number"
                inputMode="numeric"
                value={lvlMin}
                onChange={(e) => setLvlMin(e.target.value)}
                placeholder="0"
              />
            </div>

            <div style={{ ...styles.field, width: 90 }}>
              <div style={styles.label}>Lvl max</div>
              <input
                style={styles.inputCompact}
                type="number"
                inputMode="numeric"
                value={lvlMax}
                onChange={(e) => setLvlMax(e.target.value)}
                placeholder="100"
              />
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 32,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={fLegendaryOnly}
                onChange={(e) => setFLegendaryOnly(e.target.checked)}
              />
              Legendary only
            </label>

            <button
              style={{ ...styles.buttonCompact, ...(anyFilterActive ? {} : styles.buttonDisabled) }}
              onClick={clearFilters}
              disabled={!anyFilterActive}
            >
              Clear filters
            </button>
          </div>

          <div style={{ marginTop: 8, ...styles.sub }}>
            All filters combine (AND). Click a column header to sort; click again to flip ascending/descending.
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            overflow: "auto",
            maxHeight: "62vh",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const active = col.key === sortKey;
                  return (
                    <th
                      key={col.key}
                      style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                      onClick={() => onHeaderClick(col.key)}
                      title={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={COLUMNS.length}>
                    No matches. Try clearing some filters.
                  </td>
                </tr>
              ) : (
                visible.map((f, i) => (
                  <tr key={`${f.zone}|${f.area}|${f.catch}|${i}`}>
                    <td style={tdStyle}>{f.zone}</td>
                    <td style={tdStyle}>{f.area}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{f.catch}</td>
                    <td style={tdStyle}>{f.lvl ?? "-"}</td>
                    <td style={tdStyle}>{f.size}</td>
                    <td style={tdStyle}>{f.str ?? "-"}</td>
                    <td style={tdStyle}>{f.type}</td>
                    <td style={{ ...tdStyle, ...(f.legendary ? { color: "#D8B04B", fontWeight: 800 } : {}) }}>
                      {f.legendary ?? "-"}
                    </td>
                    <td style={tdStyle}>{f.bestMoon}</td>
                    <td style={tdStyle}>{f.bestTime}</td>
                    <td style={tdStyle}>{f.bestSeason}</td>
                    <td style={tdStyle}>{f.rarity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
