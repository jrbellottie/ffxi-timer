import React, { useEffect, useMemo, useState } from "react";
import { styles } from "./styles";
import { loadJson, saveJson } from "./utils/storage";

type ClamItem = {
  key: string;
  name: string;
  weight: number;
  vendorGil: number;
  noSale?: boolean;
  /** Per-dig drop rate (%), base loot table. */
  ratePct: number;
  /** Per-dig drop rate (%) with +1 swimwear bottoms. */
  ratePlusPct: number;
};

type ClamState = {
  capacity: number;
  currentWeight: number;
  counts: Record<string, number>;
};

const CLAM_UI_KEY = "ffxi_clam_ui_v2";
const CAPACITY_STEPS = [50, 100, 150, 200] as const;

// One shared loot table for all 8 clamming points.
// Order: the four common named pulls first, then everything else alphabetical.
const CLAM_ITEMS: ClamItem[] = [
  { key: "bibikiSlug", name: "Bibiki Slug", weight: 3, vendorGil: 10, ratePct: 37.2, ratePlusPct: 10.8 },
  { key: "jacknife", name: "Jacknife", weight: 11, vendorGil: 55, ratePct: 25.1, ratePlusPct: 10.8 },
  { key: "pebble", name: "Pebble", weight: 7, vendorGil: 1, ratePct: 15.2, ratePlusPct: 10.9 },
  { key: "igneousRock", name: "Igneous Rock", weight: 35, vendorGil: 180, ratePct: 4.7, ratePlusPct: 14.1 },
  { key: "bibikiUrchin", name: "Bibiki Urchin", weight: 6, vendorGil: 750, ratePct: 0.1, ratePlusPct: 0.3 },
  { key: "brokenWillowRod", name: "Broken Willow Rod", weight: 6, vendorGil: 0, noSale: true, ratePct: 0.7, ratePlusPct: 2.1 },
  { key: "coralFragment", name: "Coral Fragment", weight: 6, vendorGil: 1750, ratePct: 0.3, ratePlusPct: 0.9 },
  { key: "crabShell", name: "Crab Shell", weight: 6, vendorGil: 383, ratePct: 0.8, ratePlusPct: 2.4 },
  { key: "elmLog", name: "Elm Log", weight: 6, vendorGil: 383, ratePct: 0.3, ratePlusPct: 0.9 },
  { key: "elshimoCoconut", name: "Elshimo Coconut", weight: 6, vendorGil: 43, ratePct: 0.7, ratePlusPct: 2.1 },
  { key: "fishScales", name: "Fish Scales", weight: 6, vendorGil: 24, ratePct: 1.2, ratePlusPct: 3.6 },
  { key: "goblinArmor", name: "Goblin Armor", weight: 6, vendorGil: 0, noSale: true, ratePct: 0.7, ratePlusPct: 2.1 },
  { key: "goblinMail", name: "Goblin Mail", weight: 6, vendorGil: 0, noSale: true, ratePct: 0.8, ratePlusPct: 2.4 },
  { key: "hobgoblinBread", name: "Hobgoblin Bread", weight: 6, vendorGil: 90, ratePct: 0.6, ratePlusPct: 1.8 },
  { key: "hobgoblinPie", name: "Hobgoblin Pie", weight: 6, vendorGil: 156, ratePct: 0.8, ratePlusPct: 2.4 },
  { key: "hqCrabShell", name: "HQ Crab Shell", weight: 6, vendorGil: 3325, ratePct: 0.1, ratePlusPct: 0.3 },
  { key: "hqPugilScales", name: "HQ Pugil Scales", weight: 6, vendorGil: 255, ratePct: 0.4, ratePlusPct: 1.2 },
  { key: "lacquerTreeLog", name: "Lacquer Tree Log", weight: 6, vendorGil: 3500, ratePct: 0.1, ratePlusPct: 0.3 },
  { key: "mapleLog", name: "Maple Log", weight: 6, vendorGil: 15, ratePct: 0.4, ratePlusPct: 1.2 },
  { key: "nebimonite", name: "Nebimonite", weight: 6, vendorGil: 52, ratePct: 0.9, ratePlusPct: 2.7 },
  { key: "pamamas", name: "Pamamas", weight: 6, vendorGil: 20, ratePct: 0.4, ratePlusPct: 1.2 },
  { key: "pamtamKelp", name: "Pamtam Kelp", weight: 6, vendorGil: 8, ratePct: 3.8, ratePlusPct: 11.4 },
  { key: "petrifiedLog", name: "Petrified Log", weight: 6, vendorGil: 2150, ratePct: 0.4, ratePlusPct: 1.2 },
  { key: "pieceOfOxblood", name: "Piece of Oxblood", weight: 6, vendorGil: 13250, ratePct: 0.1, ratePlusPct: 0.3 },
  { key: "rockSalt", name: "Rock Salt", weight: 6, vendorGil: 4, ratePct: 0.9, ratePlusPct: 2.7 },
  { key: "seashell", name: "Seashell", weight: 6, vendorGil: 30, ratePct: 0.5, ratePlusPct: 1.5 },
  { key: "shallShell", name: "Shall Shell", weight: 6, vendorGil: 300, ratePct: 2.1, ratePlusPct: 6.3 },
  { key: "titanictusShell", name: "Titanictus Shell", weight: 6, vendorGil: 350, ratePct: 0.3, ratePlusPct: 0.9 },
  { key: "tropicalClam", name: "Tropical Clam", weight: 20, vendorGil: 5040, ratePct: 0.3, ratePlusPct: 0.9 },
  { key: "turtleShell", name: "Turtle Shell", weight: 6, vendorGil: 1200, ratePct: 0.1, ratePlusPct: 0.3 },
];

/** For the Items tab source index. */
export const CLAM_ITEM_NAMES: string[] = CLAM_ITEMS.map((i) => i.name);

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
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

type SortKey = "name" | "weight" | "vendorGil" | "ratePct" | "ratePlusPct";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Item" },
  { key: "weight", label: "Weight" },
  { key: "vendorGil", label: "Vendor Value" },
  { key: "ratePct", label: "Drop Rate" },
  { key: "ratePlusPct", label: "With +1 Bottoms" },
];

function nextCapacity(current: number): number | null {
  const idx = CAPACITY_STEPS.findIndex((v) => v === current);
  if (idx < 0 || idx >= CAPACITY_STEPS.length - 1) return null;
  return CAPACITY_STEPS[idx + 1] ?? null;
}

function defaultCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of CLAM_ITEMS) out[item.key] = 0;
  return out;
}

function formatGil(value: number): string {
  return `${value.toLocaleString()} g`;
}

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function normalizeState(raw: unknown): ClamState {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawCapacity = Number(obj.capacity);
  const capacity = CAPACITY_STEPS.includes(rawCapacity as (typeof CAPACITY_STEPS)[number]) ? rawCapacity : 50;
  const countsInput =
    obj.counts && typeof obj.counts === "object" ? (obj.counts as Record<string, unknown>) : ({} as Record<string, unknown>);

  const counts = defaultCounts();
  for (const item of CLAM_ITEMS) {
    const n = Number(countsInput[item.key]);
    counts[item.key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  const calcWeight = CLAM_ITEMS.reduce((sum, item) => sum + item.weight * (counts[item.key] ?? 0), 0);
  const rawCurrent = Number(obj.currentWeight);
  const currentWeight = Number.isFinite(rawCurrent) ? Math.max(0, Math.floor(rawCurrent)) : calcWeight;

  // Keep state coherent if manual storage edits drift counts vs total.
  const coherentWeight = currentWeight === calcWeight ? currentWeight : calcWeight;

  return {
    capacity,
    currentWeight: coherentWeight,
    counts,
  };
}

export default function ClamTab() {
  const initial = normalizeState(loadJson<unknown>(CLAM_UI_KEY, null));

  const [capacity, setCapacity] = useState<number>(initial.capacity);
  const [currentWeight, setCurrentWeight] = useState<number>(initial.currentWeight);
  const [counts, setCounts] = useState<Record<string, number>>(initial.counts);
  const [status, setStatus] = useState<string>("Ready to clam.");
  const [sortKey, setSortKey] = useState<SortKey>("ratePct");
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  useEffect(() => {
    saveJson(CLAM_UI_KEY, {
      capacity,
      currentWeight,
      counts,
    } satisfies ClamState);
  }, [capacity, currentWeight, counts]);

  const isBroken = currentWeight > capacity;
  const atRiskOfBreak = currentWeight >= capacity - 5;
  const canExpand = atRiskOfBreak && capacity < 200;
  const remaining = capacity - currentWeight;
  const nextCap = nextCapacity(capacity);
  const towardUpgrade = Math.max(capacity - 5 - currentWeight, 0);
  const riskEntries = useMemo(() => {
    const sixPzItems = CLAM_ITEMS.filter((item) => item.weight === 6);
    const weightedRisks = [
      { label: "Bibiki Slug 3pz", weight: 3, ratePct: 37.2, ratePlusPct: 10.8 },
      {
        label: "6pz items",
        weight: 6,
        ratePct: sixPzItems.reduce((sum, item) => sum + item.ratePct, 0),
        ratePlusPct: sixPzItems.reduce((sum, item) => sum + item.ratePlusPct, 0),
      },
      { label: "Pebble 7pz", weight: 7, ratePct: 15.2, ratePlusPct: 10.9 },
      { label: "Jacknife 11pz", weight: 11, ratePct: 25.1, ratePlusPct: 10.8 },
      { label: "Tropical Clam 20pz", weight: 20, ratePct: 0.3, ratePlusPct: 0.9 },
      { label: "Igneous Rock 35pz", weight: 35, ratePct: 4.7, ratePlusPct: 14.1 },
    ];

    return weightedRisks.filter((item) => currentWeight + item.weight > capacity);
  }, [capacity, currentWeight]);

  const riskTotals = useMemo(() => {
    return riskEntries.reduce(
      (totals, item) => ({
        ratePct: totals.ratePct + item.ratePct,
        ratePlusPct: totals.ratePlusPct + item.ratePlusPct,
      }),
      { ratePct: 0, ratePlusPct: 0 }
    );
  }, [capacity, currentWeight]);

  const bucketContents = useMemo(() => {
    return CLAM_ITEMS.map((item) => {
      const count = counts[item.key] ?? 0;
      return {
        ...item,
        count,
        totalWeight: count * item.weight,
        totalGil: count * item.vendorGil,
      };
    }).filter((row) => row.count > 0);
  }, [counts]);

  const bucketValue = useMemo(() => {
    let totalGil = 0;
    for (const item of CLAM_ITEMS) {
      totalGil += item.vendorGil * (counts[item.key] ?? 0);
    }
    return totalGil;
  }, [counts]);

  const sortedDropTable = useMemo(() => {
    const rows = [...CLAM_ITEMS];
    rows.sort((a, b) => {
      const cmp =
        sortKey === "name" ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
      return sortDesc ? -cmp : cmp;
    });
    return rows;
  }, [sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  }

  function resetRun(message = "Bucket reset to 50 pz.") {
    setCapacity(50);
    setCurrentWeight(0);
    setCounts(defaultCounts());
    setStatus(message);
  }

  function addItem(item: ClamItem) {
    const nextWeight = currentWeight + item.weight;
    setCounts((prev) => ({ ...prev, [item.key]: (prev[item.key] ?? 0) + 1 }));
    setCurrentWeight(nextWeight);
    if (nextWeight > capacity) {
      setStatus(`Bucket broke at ${nextWeight}/${capacity} pz after adding ${item.name}.`);
    } else {
      setStatus(`Added ${item.name} (+${item.weight} pz).`);
    }
  }

  function removeItem(item: ClamItem) {
    const count = counts[item.key] ?? 0;
    if (count <= 0) {
      setStatus(`No ${item.name} in bucket to remove.`);
      return;
    }

    setCounts((prev) => ({ ...prev, [item.key]: Math.max(0, (prev[item.key] ?? 0) - 1) }));
    setCurrentWeight((prev) => Math.max(0, prev - item.weight));
    setStatus(`Removed ${item.name} (-${item.weight} pz).`);
  }

  function expandBucket() {
    const target = nextCapacity(capacity);
    if (!target) {
      setStatus("Bucket is already maxed at 200 pz.");
      return;
    }
    if (!atRiskOfBreak) {
      setStatus(`Get within 5 pz of ${capacity} first to unlock expansion.`);
      return;
    }

    setCapacity(target);
    setStatus(`Bucket upgraded to ${target} pz.`);
  }

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>Clam Bucket Planner</h3>
        <div style={styles.sub}>Track bucket weight, upgrade windows, and profitable targets</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        {isBroken ? (
          <div
            style={{
              border: "1px solid #d95757",
              borderRadius: 12,
              padding: 10,
              background: "rgba(217,87,87,0.14)",
            }}
          >
            <div style={{ color: "#ff8d8d", fontWeight: 800, fontSize: 13 }}>
              Bucket broken: current load is {currentWeight}/{capacity} pz.
            </div>
            <div style={{ marginTop: 6, color: "#ffc1c1", fontSize: 13 }}>
              Remove items or expand the bucket to recover.
            </div>
          </div>
        ) : canExpand ? (
          <div
            style={{
              border: "1px solid #4ba36d",
              borderRadius: 12,
              padding: 10,
              background: "rgba(82, 184, 123, 0.14)",
            }}
          >
            <div style={{ color: "#9cf2be", fontWeight: 800, fontSize: 13 }}>
              Upgrade bucket available now: you are within 5 pz of {capacity}.
            </div>
            <div style={{ marginTop: 6, color: "#cff9de", fontSize: 13 }}>
              Use Expand bucket (+50 pz) to move to {nextCap ?? capacity} pz capacity.
            </div>
          </div>
        ) : riskEntries.length > 0 ? (
          <div
            style={{
              border: "1px solid #b9952f",
              borderRadius: 12,
              padding: 10,
              background: "rgba(216,176,75,0.12)",
            }}
          >
            <div style={{ color: "#ffd166", fontWeight: 800, fontSize: 13 }}>
              Bucket break risk: any pull heavier than {remaining} pz will break your bucket right now.
            </div>
            <div style={{ marginTop: 6, color: "#ffe7a6", fontSize: 13 }}>
              At risk ({formatRate(riskTotals.ratePct)} | <span style={{ color: "#ffa552" }}>{formatRate(riskTotals.ratePlusPct)}</span>):{" "}
              {riskEntries.map((item) => item.label).join(" | ")}
            </div>
          </div>
        ) : null}

        <div style={styles.subCard}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {currentWeight} / {capacity} pz
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#8af6b0" }}>
              Bucket value: {formatGil(bucketValue)}
            </div>
            <div style={{ ...styles.sub, fontSize: 13 }}>
              {remaining >= 0 ? `Remaining: ${remaining} pz` : `Over by: ${Math.abs(remaining)} pz`}
            </div>
            <div style={{ ...styles.sub, fontSize: 13 }}>
              {nextCap ? `Next cap: ${nextCap} pz` : "Max cap reached"}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: canExpand ? "#8af6b0" : "#D8B04B",
              }}
            >
              {canExpand
                ? "Upgrade available now"
                : towardUpgrade === 0
                ? "Upgrade check ready"
                : `${towardUpgrade} pz until upgrade window`}
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...styles.buttonCompact, ...(canExpand ? {} : styles.buttonDisabled) }}
              onClick={expandBucket}
              disabled={!canExpand}
            >
              Expand bucket (+50 pz)
            </button>
            <button style={styles.buttonCompact} onClick={() => resetRun("Manual reset complete.")}>Reset bucket</button>
          </div>

          <div style={{ marginTop: 8, ...styles.sub }}>{status}</div>
          {capacity === 200 ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#ffb3a1" }}>
              At 200 pz, every dig has a 10% incident chance that dumps the whole bucket (5% with a +1 swimwear top).
            </div>
          ) : null}
          <div style={{ marginTop: 4, ...styles.sub }}>
            Reference: 10s delay between digs. All 8 points share one loot table. The bucket survives zoning and logout.
          </div>
        </div>

        <div style={styles.subCard}>
          <div style={styles.titleRow}>
            <div style={{ fontWeight: 800 }}>Weight buttons (add / subtract)</div>
            <div style={styles.sub}>
              Use + to simulate dig results; use - to adjust mistakes |{" "}
              <span style={{ color: "#ffa552", fontWeight: 700 }}>summer gear drop rate</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {CLAM_ITEMS.map((item) => {
              const count = counts[item.key] ?? 0;
              return (
                <div
                  key={item.key}
                  style={{
                    display: "grid",
                    gap: 6,
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 8,
                    background: count > 0 ? "rgba(138,246,176,0.04)" : "rgba(255,255,255,0.01)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                    <div style={{ ...styles.sub, fontSize: 12, whiteSpace: "nowrap" }}>
                      {item.weight} pz | {item.noSale ? "no NPC sale" : formatGil(item.vendorGil)} |{" "}
                      <span style={{ color: "#eaeaea" }}>{item.ratePct}%</span>
                      {" | "}
                      <span style={{ color: "#ffa552", fontWeight: 700 }}>{item.ratePlusPct}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button style={styles.buttonCompact} onClick={() => addItem(item)}>
                      +
                    </button>
                    <button
                      style={{ ...styles.buttonCompact, ...(count > 0 ? {} : styles.buttonDisabled) }}
                      onClick={() => removeItem(item)}
                      disabled={count <= 0}
                    >
                      -
                    </button>
                    <div style={{ marginLeft: "auto", fontSize: 13, opacity: 0.85 }}>x{count}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, minWidth: 90, textAlign: "right" }}>
                      {formatGil(item.vendorGil * count)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, ...styles.sub }}>
            Running bucket value: {formatGil(bucketValue)}
          </div>
        </div>

        <div style={styles.subCard}>
          <div style={styles.titleRow}>
            <div style={{ fontWeight: 800 }}>Bucket contents so far</div>
            <div style={styles.sub}>Live list of what you have entered this run</div>
          </div>

          {bucketContents.length === 0 ? (
            <div style={{ marginTop: 10, ...styles.sub }}>Bucket is empty.</div>
          ) : (
            <div
              style={{
                marginTop: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                overflow: "auto",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Weight</th>
                    <th style={thStyle}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketContents.map((row) => (
                    <tr key={row.key}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{row.name}</td>
                      <td style={tdStyle}>{row.count}</td>
                      <td style={tdStyle}>{row.totalWeight} pz</td>
                      <td style={tdStyle}>{formatGil(row.totalGil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={styles.subCard}>
          <div style={styles.titleRow}>
            <div style={{ fontWeight: 800 }}>Shared drop table (all 8 points)</div>
            <div style={styles.sub}>Every point rolls the same table; +1 swimwear bottoms triple non-trash rates</div>
          </div>

          <div
            style={{
              marginTop: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              overflow: "auto",
              maxHeight: "56vh",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {SORT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort(col.key)}
                      title="Click to sort"
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDesc ? " \u25BC" : " \u25B2") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDropTable.map((item) => (
                  <tr key={item.key}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{item.name}</td>
                    <td style={tdStyle}>{item.weight} pz</td>
                    <td style={tdStyle}>{item.noSale ? "0 g (no NPC sale)" : formatGil(item.vendorGil)}</td>
                    <td style={tdStyle}>{item.ratePct}%</td>
                    <td style={{ ...tdStyle, color: "#ffa552", fontWeight: 700 }}>{item.ratePlusPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.subCard}>
          <div style={styles.titleRow}>
            <div style={{ fontWeight: 800 }}>Run notes</div>
            <div style={styles.sub}>Logistics and strategy from the server guide</div>
          </div>

          <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13, color: "#cfcfcf" }}>
            <li>Clamming Kit: 500 g from Toh Zonikki on Purgonorgo Isle. Manaclipper ticket: 80 g single / 500 g for 10 rides (Tswe Panipahr, Bibiki Bay).</li>
            <li>Boat to Purgonorgo departs 05:30 and 17:30 game time; return trip is free at 09:15 and 21:15.</li>
            <li>Upgrade path: dig to ~45 at 50 pz, take the free +50 upgrade; again at ~95 for 150 pz. At 150 pz, dig to ~140-145 and cash out.</li>
            <li>The 200 pz upgrade is usually negative EV without a +1 swimwear top (10% incident per dig, 5% with the top).</li>
            <li>Average pull is ~7-8 pz. Expect roughly 1,200-1,400 g per bucket base (~2,500-2,800 g with +1 bottoms) against ~580 g overhead.</li>
            <li>Overweight digs break the bucket and lose everything. If your bags are full when turning in, Zonikki holds the overflow.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
