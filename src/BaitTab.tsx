// src/BaitTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import { styles } from "./styles";
import baitData from "./data/bait.json";
import fishData from "./data/fish.json";
import { loadJson, saveJson } from "./utils/storage";

type BaitEntry = {
  fish: string;
  lvl: number | null;
  size: string;
  bait: string | null;
  kind: string | null;
  bite: string | null;
  hookBonus: number | null;
  best: boolean;
  note: string | null;
};

type PoolEntry = {
  zone: string;
  area: string;
  fish: string;
  lvl: number | null;
  bait: string;
  kind: string;
  bite: string;
  hookBonus: number;
  sharePct: number;
  competing: string[];
};

type FishZoneEntry = {
  zone: string;
  area: string;
  catch: string;
  lvl: number | null;
  rarity: string;
  type: string;
};

const BAIT: BaitEntry[] = baitData as BaitEntry[];
const FISH_ZONES: FishZoneEntry[] = fishData as FishZoneEntry[];

/** Rarity like "x0.35" → 0.35; "-" (no penalty) = 1. */
function rarityValue(rarity: string): number {
  const m = String(rarity).match(/x\s*([\d.]+)/i);
  return m ? Number(m[1]) : 1;
}

/**
 * Compute every (zone, area, fish, bait) combination with its pool share.
 * Hook weight per fish = clamp((25 + hookBonus) × rarity, 20, 120), assuming
 * neutral time/moon and adequate skill — matches the source table's model.
 * Share = target weight / total weight of all pool fish that bite that bait.
 */
function buildSpots(): PoolEntry[] {
  const baitByFish = new Map<string, BaitEntry[]>();
  for (const b of BAIT) {
    if (!b.bait || b.hookBonus === null) continue;
    const list = baitByFish.get(b.fish);
    if (list) list.push(b);
    else baitByFish.set(b.fish, [b]);
  }

  const poolMembers = new Map<string, FishZoneEntry[]>();
  for (const f of FISH_ZONES) {
    const key = `${f.zone}|${f.area}`;
    const list = poolMembers.get(key);
    if (list) list.push(f);
    else poolMembers.set(key, [f]);
  }

  const spots: PoolEntry[] = [];

  for (const members of poolMembers.values()) {
    // All baits bitten by at least one member of this pool.
    const baitsInPool = new Set<string>();
    for (const m of members) {
      for (const row of baitByFish.get(m.catch) ?? []) baitsInPool.add(row.bait as string);
    }

    for (const baitName of baitsInPool) {
      // Everyone in this pool that bites this bait, with their hook weight.
      const biters: { member: FishZoneEntry; row: BaitEntry; weight: number }[] = [];
      for (const m of members) {
        const row = (baitByFish.get(m.catch) ?? []).find((r) => r.bait === baitName);
        if (!row) continue;
        const weight = Math.min(120, Math.max(20, (25 + (row.hookBonus as number)) * rarityValue(m.rarity)));
        biters.push({ member: m, row, weight });
      }

      const total = biters.reduce((sum, b) => sum + b.weight, 0);

      for (const b of biters) {
        spots.push({
          zone: b.member.zone,
          area: b.member.area,
          fish: b.member.catch,
          lvl: b.member.lvl ?? b.row.lvl,
          bait: baitName,
          kind: b.row.kind ?? "-",
          bite: b.row.bite ?? "-",
          hookBonus: b.row.hookBonus as number,
          sharePct: Math.round((1000 * b.weight) / total) / 10,
          competing: biters.filter((o) => o !== b).map((o) => o.member.catch),
        });
      }
    }
  }

  return spots;
}

const POOLS: PoolEntry[] = buildSpots();

type Mode = "affinity" | "spots";

type AffinityKey = "fish" | "lvl" | "size" | "bait" | "kind" | "bite" | "hookBonus" | "best" | "note";
type SpotKey = "zone" | "area" | "fish" | "lvl" | "bait" | "kind" | "bite" | "hookBonus" | "sharePct" | "competingCount";
type SortDir = "asc" | "desc";

const AFFINITY_COLUMNS: { key: AffinityKey; label: string }[] = [
  { key: "fish", label: "Fish" },
  { key: "lvl", label: "Lvl" },
  { key: "size", label: "Size" },
  { key: "bait", label: "Bait" },
  { key: "kind", label: "Kind" },
  { key: "bite", label: "Bite" },
  { key: "hookBonus", label: "Hook Bonus" },
  { key: "best", label: "Best" },
  { key: "note", label: "Note" },
];

const SPOT_COLUMNS: { key: SpotKey; label: string }[] = [
  { key: "zone", label: "Zone" },
  { key: "area", label: "Area" },
  { key: "fish", label: "Target Fish" },
  { key: "lvl", label: "Lvl" },
  { key: "bait", label: "Bait" },
  { key: "kind", label: "Kind" },
  { key: "bite", label: "Bite" },
  { key: "hookBonus", label: "Hook Bonus" },
  { key: "sharePct", label: "Pool Share" },
  { key: "competingCount", label: "Competing" },
];

const MAX_VISIBLE_ROWS = 300;
const BAIT_UI_KEY = "ffxi_bait_ui_v1";

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null && v !== ""))].sort((a, b) =>
    a.localeCompare(b)
  );
}

const KINDS = uniqueSorted(BAIT.map((b) => b.kind));
const BITES = uniqueSorted(BAIT.map((b) => b.bite));
const POOL_ZONES = uniqueSorted(POOLS.map((p) => p.zone));
const POOL_BITES = uniqueSorted(POOLS.map((p) => p.bite));

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

function shareColor(pct: number | null): React.CSSProperties {
  if (pct === null) return {};
  if (pct >= 100) return { color: "#8af6b0", fontWeight: 800 };
  if (pct >= 60) return { color: "#D8B04B", fontWeight: 700 };
  return { color: "#ff9c7a", fontWeight: 700 };
}

export default function BaitTab() {
  type BaitUiState = {
    mode: Mode;
    aGlobal: string;
    aFish: string;
    aBait: string;
    aKind: string;
    aBite: string;
    aBestOnly: boolean;
    aLvlMin: string;
    aLvlMax: string;
    aSortKey: AffinityKey;
    aSortDir: SortDir;
    sGlobal: string;
    sFish: string;
    sZone: string;
    sArea: string;
    sBait: string;
    sKind: string;
    sBite: string;
    sMinShare: string;
    sSoloOnly: boolean;
    sSortKey: SpotKey;
    sSortDir: SortDir;
  };

  const defaultUi: BaitUiState = {
    mode: "affinity",
    aGlobal: "",
    aFish: "",
    aBait: "",
    aKind: "",
    aBite: "",
    aBestOnly: false,
    aLvlMin: "",
    aLvlMax: "",
    aSortKey: "fish",
    aSortDir: "asc",
    sGlobal: "",
    sFish: "",
    sZone: "",
    sArea: "",
    sBait: "",
    sKind: "",
    sBite: "",
    sMinShare: "",
    sSoloOnly: false,
    sSortKey: "sharePct",
    sSortDir: "desc",
  };

  const loaded = loadJson<Partial<BaitUiState>>(BAIT_UI_KEY, {});
  const initialUi: BaitUiState = {
    ...defaultUi,
    ...loaded,
    mode: loaded.mode === "spots" ? "spots" : "affinity",
    aSortKey: AFFINITY_COLUMNS.some((c) => c.key === loaded.aSortKey)
      ? (loaded.aSortKey as AffinityKey)
      : defaultUi.aSortKey,
    aSortDir: loaded.aSortDir === "desc" ? "desc" : "asc",
    sSortKey: SPOT_COLUMNS.some((c) => c.key === loaded.sSortKey)
      ? (loaded.sSortKey as SpotKey)
      : defaultUi.sSortKey,
    sSortDir: loaded.sSortDir === "asc" ? "asc" : "desc",
  };

  const [mode, setMode] = useState<Mode>(initialUi.mode);

  // ---- Affinity (Fish x Bait) filters ----
  const [aGlobal, setAGlobal] = useState(initialUi.aGlobal);
  const [aFish, setAFish] = useState(initialUi.aFish);
  const [aBait, setABait] = useState(initialUi.aBait);
  const [aKind, setAKind] = useState(initialUi.aKind);
  const [aBite, setABite] = useState(initialUi.aBite);
  const [aBestOnly, setABestOnly] = useState(initialUi.aBestOnly);
  const [aLvlMin, setALvlMin] = useState(initialUi.aLvlMin);
  const [aLvlMax, setALvlMax] = useState(initialUi.aLvlMax);
  const [aSortKey, setASortKey] = useState<AffinityKey>(initialUi.aSortKey);
  const [aSortDir, setASortDir] = useState<SortDir>(initialUi.aSortDir);

  // ---- Best-spot (pool) filters ----
  const [sGlobal, setSGlobal] = useState(initialUi.sGlobal);
  const [sFish, setSFish] = useState(initialUi.sFish);
  const [sZone, setSZone] = useState(initialUi.sZone);
  const [sArea, setSArea] = useState(initialUi.sArea);
  const [sBait, setSBait] = useState(initialUi.sBait);
  const [sKind, setSKind] = useState(initialUi.sKind);
  const [sBite, setSBite] = useState(initialUi.sBite);
  const [sMinShare, setSMinShare] = useState(initialUi.sMinShare);
  const [sSoloOnly, setSSoloOnly] = useState(initialUi.sSoloOnly);
  const [sSortKey, setSSortKey] = useState<SpotKey>(initialUi.sSortKey);
  const [sSortDir, setSSortDir] = useState<SortDir>(initialUi.sSortDir);

  useEffect(() => {
    saveJson(BAIT_UI_KEY, {
      mode,
      aGlobal,
      aFish,
      aBait,
      aKind,
      aBite,
      aBestOnly,
      aLvlMin,
      aLvlMax,
      aSortKey,
      aSortDir,
      sGlobal,
      sFish,
      sZone,
      sArea,
      sBait,
      sKind,
      sBite,
      sMinShare,
      sSoloOnly,
      sSortKey,
      sSortDir,
    } satisfies BaitUiState);
  }, [
    mode,
    aGlobal,
    aFish,
    aBait,
    aKind,
    aBite,
    aBestOnly,
    aLvlMin,
    aLvlMax,
    aSortKey,
    aSortDir,
    sGlobal,
    sFish,
    sZone,
    sArea,
    sBait,
    sKind,
    sBite,
    sMinShare,
    sSoloOnly,
    sSortKey,
    sSortDir,
  ]);

  function onAffinityHeader(key: AffinityKey) {
    if (key === aSortKey) setASortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setASortKey(key);
      setASortDir(key === "hookBonus" || key === "best" ? "desc" : "asc");
    }
  }

  function onSpotHeader(key: SpotKey) {
    if (key === sSortKey) setSSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSSortKey(key);
      setSSortDir(key === "sharePct" || key === "hookBonus" ? "desc" : "asc");
    }
  }

  function clearAffinityFilters() {
    setAGlobal("");
    setAFish("");
    setABait("");
    setAKind("");
    setABite("");
    setABestOnly(false);
    setALvlMin("");
    setALvlMax("");
  }

  function clearSpotFilters() {
    setSGlobal("");
    setSFish("");
    setSZone("");
    setSArea("");
    setSBait("");
    setSKind("");
    setSBite("");
    setSMinShare("");
    setSSoloOnly(false);
  }

  /** Carry current affinity filters into the best-spot finder and switch views. */
  function findBestSpots() {
    setSFish(aFish.trim() !== "" ? aFish : aGlobal);
    setSBait(aBait);
    setSZone("");
    setSArea("");
    setSKind(aKind);
    setSBite("");
    setSGlobal("");
    setSMinShare("");
    setSSoloOnly(false);
    setSSortKey("sharePct");
    setSSortDir("desc");
    setMode("spots");
  }

  const affinityActive =
    aGlobal.trim() !== "" ||
    aFish.trim() !== "" ||
    aBait.trim() !== "" ||
    aKind !== "" ||
    aBite !== "" ||
    aBestOnly ||
    aLvlMin.trim() !== "" ||
    aLvlMax.trim() !== "";

  const spotActive =
    sGlobal.trim() !== "" ||
    sFish.trim() !== "" ||
    sZone !== "" ||
    sArea.trim() !== "" ||
    sBait.trim() !== "" ||
    sKind !== "" ||
    sBite !== "" ||
    sMinShare.trim() !== "" ||
    sSoloOnly;

  const affinityResults = useMemo(() => {
    const g = aGlobal.trim().toLowerCase();
    const fq = aFish.trim().toLowerCase();
    const bq = aBait.trim().toLowerCase();
    const min = aLvlMin.trim() === "" ? null : Number(aLvlMin);
    const max = aLvlMax.trim() === "" ? null : Number(aLvlMax);

    const filtered = BAIT.filter((b) => {
      if (aKind && b.kind !== aKind) return false;
      if (aBite && b.bite !== aBite) return false;
      if (aBestOnly && !b.best) return false;
      if (fq && !b.fish.toLowerCase().includes(fq)) return false;
      if (bq && !(b.bait ?? "").toLowerCase().includes(bq)) return false;
      if (min !== null && Number.isFinite(min) && (b.lvl === null || b.lvl < min)) return false;
      if (max !== null && Number.isFinite(max) && (b.lvl === null || b.lvl > max)) return false;

      if (g) {
        const hay = [
          b.fish,
          b.lvl === null ? "" : String(b.lvl),
          b.size,
          b.bait ?? "",
          b.kind ?? "",
          b.bite ?? "",
          b.hookBonus === null ? "" : String(b.hookBonus),
          b.best ? "best" : "",
          b.note ?? "",
        ]
          .join(" | ")
          .toLowerCase();
        if (!hay.includes(g)) return false;
      }
      return true;
    });

    return filtered.sort((x, y) => {
      let cmp = 0;
      if (aSortKey === "lvl" || aSortKey === "hookBonus") {
        const xv = x[aSortKey];
        const yv = y[aSortKey];
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (aSortKey === "best") {
        cmp = Number(x.best) - Number(y.best);
      } else {
        cmp = ((x[aSortKey] ?? "") as string).localeCompare((y[aSortKey] ?? "") as string);
      }
      return aSortDir === "asc" ? cmp : -cmp;
    });
  }, [aGlobal, aFish, aBait, aKind, aBite, aBestOnly, aLvlMin, aLvlMax, aSortKey, aSortDir]);

  const spotResults = useMemo(() => {
    const g = sGlobal.trim().toLowerCase();
    const fq = sFish.trim().toLowerCase();
    const aq = sArea.trim().toLowerCase();
    const bq = sBait.trim().toLowerCase();
    const minShare = sMinShare.trim() === "" ? null : Number(sMinShare);

    const filtered = POOLS.filter((p) => {
      if (sZone && p.zone !== sZone) return false;
      if (sKind && p.kind !== sKind) return false;
      if (sBite && p.bite !== sBite) return false;
      if (sSoloOnly && p.sharePct < 100) return false;
      if (fq && !p.fish.toLowerCase().includes(fq)) return false;
      if (aq && !p.area.toLowerCase().includes(aq)) return false;
      if (bq && !p.bait.toLowerCase().includes(bq)) return false;
      if (minShare !== null && Number.isFinite(minShare) && p.sharePct < minShare) return false;

      if (g) {
        const hay = [
          p.zone,
          p.area,
          p.fish,
          p.lvl === null ? "" : String(p.lvl),
          p.bait,
          p.kind,
          p.bite,
          `${p.sharePct}%`,
          p.competing.join(", "),
        ]
          .join(" | ")
          .toLowerCase();
        if (!hay.includes(g)) return false;
      }
      return true;
    });

    return filtered.sort((x, y) => {
      let cmp = 0;
      if (sSortKey === "lvl") {
        const xv = x.lvl;
        const yv = y.lvl;
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (sSortKey === "sharePct" || sSortKey === "hookBonus") {
        cmp = x[sSortKey] - y[sSortKey];
      } else if (sSortKey === "competingCount") {
        cmp = x.competing.length - y.competing.length;
      } else {
        cmp = x[sSortKey].localeCompare(y[sSortKey]);
      }
      if (cmp === 0) {
        // Tie-break: higher share first, then higher hook bonus, then fewer competitors.
        cmp = y.sharePct - x.sharePct;
        if (cmp !== 0) return cmp;
        cmp = y.hookBonus - x.hookBonus;
        if (cmp !== 0) return cmp;
        return x.competing.length - y.competing.length;
      }
      return sSortDir === "asc" ? cmp : -cmp;
    });
  }, [sGlobal, sFish, sZone, sArea, sBait, sKind, sBite, sMinShare, sSoloOnly, sSortKey, sSortDir]);

  const results = mode === "affinity" ? affinityResults : spotResults;
  const visibleCount = Math.min(results.length, MAX_VISIBLE_ROWS);

  const selectFilter = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options: string[],
    width = 170
  ) => (
    <div style={{ ...styles.field, width }}>
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

  const textFilter = (
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    width = 200
  ) => (
    <div style={{ ...styles.field, width }}>
      <div style={styles.label}>{label}</div>
      <input
        style={styles.inputCompact}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>{mode === "affinity" ? "Bait Affinity (Fish × Bait)" : "Best Fishing Spots (Pool Share)"}</h3>
        <div style={styles.sub}>
          {results.length.toLocaleString()} of{" "}
          {(mode === "affinity" ? BAIT.length : POOLS.length).toLocaleString()} entries
          {results.length > MAX_VISIBLE_ROWS ? ` (showing first ${MAX_VISIBLE_ROWS} — refine filters)` : ""}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={mode === "affinity" ? styles.buttonPrimaryCompact : styles.buttonCompact}
            onClick={() => setMode("affinity")}
          >
            Bait list
          </button>
          <button
            style={mode === "spots" ? styles.buttonPrimaryCompact : styles.buttonCompact}
            onClick={() => setMode("spots")}
          >
            Best spots
          </button>
        </div>

        {mode === "affinity" ? (
          <div style={styles.subCard}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {textFilter("Search everything", aGlobal, setAGlobal, "e.g. moat carp", 240)}
              {textFilter("Fish", aFish, setAFish, "e.g. carp")}
              {textFilter("Bait", aBait, setABait, "e.g. lugworm")}
              {selectFilter("Kind", aKind, setAKind, KINDS, 130)}
              {selectFilter("Bite", aBite, setABite, BITES, 140)}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ ...styles.field, width: 90 }}>
                <div style={styles.label}>Lvl min</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={aLvlMin}
                  onChange={(e) => setALvlMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={{ ...styles.field, width: 90 }}>
                <div style={styles.label}>Lvl max</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={aLvlMax}
                  onChange={(e) => setALvlMax(e.target.value)}
                  placeholder="120"
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
                <input type="checkbox" checked={aBestOnly} onChange={(e) => setABestOnly(e.target.checked)} />
                Best bait only
              </label>

              <button
                style={{ ...styles.buttonCompact, ...(affinityActive ? {} : styles.buttonDisabled) }}
                onClick={clearAffinityFilters}
                disabled={!affinityActive}
              >
                Clear filters
              </button>

              <button
                style={styles.buttonPrimaryCompact}
                onClick={findBestSpots}
                title="Find the zones/areas where the filtered fish is easiest to target (fewest competing fish on the same bait)"
              >
                Find best spot →
              </button>
            </div>

            <div style={{ marginTop: 8, ...styles.sub }}>
              “Best” here = highest hook bonus for that fish. Use “Find best spot” to factor in pool competition —
              where other fish steal bites on the same bait.
            </div>
          </div>
        ) : (
          <div style={styles.subCard}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {textFilter("Search everything", sGlobal, setSGlobal, "e.g. moat carp", 240)}
              {textFilter("Target fish", sFish, setSFish, "e.g. carp")}
              {selectFilter("Zone", sZone, setSZone, POOL_ZONES, 200)}
              {textFilter("Area", sArea, setSArea, "e.g. whole zone", 160)}
              {textFilter("Bait", sBait, setSBait, "e.g. lugworm", 160)}
              {selectFilter("Kind", sKind, setSKind, KINDS, 120)}
              {selectFilter("Bite", sBite, setSBite, POOL_BITES, 140)}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ ...styles.field, width: 120 }}>
                <div style={styles.label}>Min share %</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={sMinShare}
                  onChange={(e) => setSMinShare(e.target.value)}
                  placeholder="e.g. 80"
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
                <input type="checkbox" checked={sSoloOnly} onChange={(e) => setSSoloOnly(e.target.checked)} />
                100% pools only (no competition)
              </label>

              <button
                style={{ ...styles.buttonCompact, ...(spotActive ? {} : styles.buttonDisabled) }}
                onClick={clearSpotFilters}
                disabled={!spotActive}
              >
                Clear filters
              </button>
            </div>

            <div style={{ marginTop: 8, ...styles.sub }}>
              Lists every zone/area/bait combination for each fish. Pool Share = your target&apos;s estimated share of
              bites on that bait in that spot (neutral time/moon, adequate skill).{" "}
              <span style={shareColor(100)}>100%</span> = only your target bites it there;{" "}
              <span style={shareColor(70)}>60–99%</span> = minor competition; <span style={shareColor(30)}>&lt;60%</span>{" "}
              = crowded pool. A lower-share bait can still be the practical pick if it&apos;s cheaper or easier to get
              (e.g. Meatball vs Drill Calamary for Gugrusaurus).
            </div>
          </div>
        )}

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            overflow: "auto",
            maxHeight: "62vh",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          {mode === "affinity" ? (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {AFFINITY_COLUMNS.map((col) => {
                    const active = col.key === aSortKey;
                    return (
                      <th
                        key={col.key}
                        style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                        onClick={() => onAffinityHeader(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {active ? (aSortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleCount === 0 ? (
                  <tr>
                    <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={AFFINITY_COLUMNS.length}>
                      No matches. Try clearing some filters.
                    </td>
                  </tr>
                ) : (
                  affinityResults.slice(0, MAX_VISIBLE_ROWS).map((b, i) => (
                    <tr key={`${b.fish}|${b.bait}|${i}`}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{b.fish}</td>
                      <td style={tdStyle}>{b.lvl ?? "-"}</td>
                      <td style={tdStyle}>{b.size}</td>
                      <td style={tdStyle}>{b.bait ?? "—"}</td>
                      <td style={tdStyle}>{b.kind ?? "-"}</td>
                      <td style={tdStyle}>{b.bite ?? "-"}</td>
                      <td style={tdStyle}>{b.hookBonus !== null ? `+${b.hookBonus}` : "-"}</td>
                      <td style={{ ...tdStyle, ...(b.best ? { color: "#8af6b0", fontWeight: 800 } : {}) }}>
                        {b.best ? "BEST" : ""}
                      </td>
                      <td style={{ ...tdStyle, opacity: 0.85 }}>{b.note ?? ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {SPOT_COLUMNS.map((col) => {
                    const active = col.key === sSortKey;
                    return (
                      <th
                        key={col.key}
                        style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                        onClick={() => onSpotHeader(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {active ? (sSortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    );
                  })}
                  <th style={{ ...thStyle, cursor: "default" }}>Competing Fish</th>
                </tr>
              </thead>
              <tbody>
                {visibleCount === 0 ? (
                  <tr>
                    <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={SPOT_COLUMNS.length + 1}>
                      No matches. Try clearing some filters.
                    </td>
                  </tr>
                ) : (
                  spotResults.slice(0, MAX_VISIBLE_ROWS).map((p, i) => (
                    <tr key={`${p.zone}|${p.area}|${p.fish}|${p.bait}|${i}`}>
                      <td style={tdStyle}>{p.zone}</td>
                      <td style={tdStyle}>{p.area}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{p.fish}</td>
                      <td style={tdStyle}>{p.lvl ?? "-"}</td>
                      <td style={tdStyle}>{p.bait}</td>
                      <td style={tdStyle}>{p.kind}</td>
                      <td style={tdStyle}>{p.bite}</td>
                      <td style={tdStyle}>+{p.hookBonus}</td>
                      <td style={{ ...tdStyle, ...shareColor(p.sharePct) }}>{p.sharePct}%</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{p.competing.length}</td>
                      <td style={{ ...tdStyle, opacity: 0.85, whiteSpace: "normal", minWidth: 200 }}>
                        {p.competing.length > 0 ? p.competing.join(", ") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
