// src/DropsTab.tsx — mob drop tables generated from LandSandBoat SQL
// (src/data/drops.json via scripts/convert-drops.cjs).
import React, { useMemo, useState } from "react";
import { styles } from "./styles";
import { loadJson, saveJson } from "./utils/storage";
import dropsData from "./data/drops.json";

type ItemInfo = {
  /** Display name. */
  n: string;
  /** Stack size. */
  st: number;
  /** Vendor sell price (LSB BaseSell). */
  sell: number;
  /** 1 = listable on the auction house. */
  ah: number;
};

/** [dropType, groupId, groupRate, itemId, itemRate] — rates are per-mille. */
type DropTuple = [number, number, number, number, number];

type MobEntry = {
  name: string;
  zone: string;
  drop: number;
  lv: [number, number] | null;
  nm: number;
  /** 1 = available on a Nov-2007-era (pre-WotG) server. */
  era: number;
};

type DropsData = {
  items: Record<string, ItemInfo>;
  drops: Record<string, DropTuple[]>;
  mobs: MobEntry[];
};

const DATA = dropsData as unknown as DropsData;

type DropKind = "Drop" | "Steal" | "Despoil";

type Row = {
  item: string;
  itemId: number;
  mob: string;
  zone: string;
  lv: [number, number] | null;
  kind: DropKind;
  /** Effective drop chance in percent. */
  rate: number;
  /** True for grouped drops (one item of the group is picked). */
  grouped: boolean;
  stack: number;
  sell: number;
  ah: boolean;
  nm: boolean;
  era: boolean;
};

function kindOf(dropType: number): DropKind {
  if (dropType === 2) return "Steal";
  if (dropType === 4) return "Despoil";
  return "Drop";
}

// Flatten mobs x droplist into searchable rows once at module load.
// Grouped entries (dropType 1): groupRate/1000 chance the group drops at all,
// then itemRate acts as a weight within the group.
function buildRows(): Row[] {
  const rows: Row[] = [];
  // Per-dropId group weight totals: key `${dropId}|${groupId}` -> total weight.
  const groupTotals = new Map<string, number>();
  for (const [dropId, tuples] of Object.entries(DATA.drops)) {
    for (const [type, groupId, , , itemRate] of tuples) {
      if (type !== 1) continue;
      const key = `${dropId}|${groupId}`;
      groupTotals.set(key, (groupTotals.get(key) ?? 0) + itemRate);
    }
  }

  for (const mob of DATA.mobs) {
    const tuples = DATA.drops[String(mob.drop)];
    if (!tuples) continue;
    for (const [type, groupId, groupRate, itemId, itemRate] of tuples) {
      if (itemId === 0) continue; // "nothing" slot inside a group
      const info = DATA.items[String(itemId)];
      if (!info) continue;
      let rate: number;
      if (type === 1) {
        const total = groupTotals.get(`${mob.drop}|${groupId}`) ?? 0;
        rate = total > 0 ? (groupRate / 1000) * (itemRate / total) * 100 : 0;
      } else {
        rate = itemRate / 10;
      }
      rows.push({
        item: info.n,
        itemId,
        mob: mob.name,
        zone: mob.zone,
        lv: mob.lv,
        kind: kindOf(type),
        rate,
        grouped: type === 1,
        stack: info.st,
        sell: info.sell,
        ah: info.ah === 1,
        nm: mob.nm === 1,
        era: mob.era === 1,
      });
    }
  }
  return rows;
}

const ROWS: Row[] = buildRows();
const ZONES: string[] = [...new Set(ROWS.map((r) => r.zone))].sort((a, b) => a.localeCompare(b));
const ERA_ZONES: string[] = [...new Set(ROWS.filter((r) => r.era).map((r) => r.zone))].sort((a, b) =>
  a.localeCompare(b)
);

const KINDS: DropKind[] = ["Drop", "Steal", "Despoil"];

const KIND_COLORS: Record<DropKind, string> = {
  Drop: "#7ec4e8",
  Steal: "#ffa552",
  Despoil: "#c9a2ff",
};

const NM_MODES = [
  { id: "all", label: "All mobs" },
  { id: "nm", label: "NMs only" },
  { id: "normal", label: "Normal only" },
] as const;

type NmMode = (typeof NM_MODES)[number]["id"];

type SortKey = "item" | "mob" | "zone" | "lv" | "kind" | "rate" | "stack" | "sell" | "ah";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "mob", label: "Mob" },
  { key: "zone", label: "Zone" },
  { key: "lv", label: "Lv" },
  { key: "kind", label: "Type" },
  { key: "rate", label: "Rate" },
  { key: "stack", label: "Stack" },
  { key: "sell", label: "Vendor" },
  { key: "ah", label: "AH" },
];

const UI_KEY = "ffxi_drops_ui_v1";

type DropsUiState = {
  itemQuery: string;
  mobQuery: string;
  zone: string; // "" = all
  kinds: DropKind[]; // empty = all
  nmMode: NmMode;
  eraOnly: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
};

const DEFAULT_UI: DropsUiState = {
  itemQuery: "",
  mobQuery: "",
  zone: "",
  kinds: [],
  nmMode: "all",
  eraOnly: true,
  sortKey: "item",
  sortDir: "asc",
};

function normalizeState(raw: unknown): DropsUiState {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    itemQuery: typeof obj.itemQuery === "string" ? obj.itemQuery : DEFAULT_UI.itemQuery,
    mobQuery: typeof obj.mobQuery === "string" ? obj.mobQuery : DEFAULT_UI.mobQuery,
    zone: typeof obj.zone === "string" && ZONES.includes(obj.zone) ? obj.zone : DEFAULT_UI.zone,
    kinds: Array.isArray(obj.kinds)
      ? (obj.kinds.filter((k) => KINDS.includes(k as DropKind)) as DropKind[])
      : DEFAULT_UI.kinds,
    nmMode: NM_MODES.some((m) => m.id === obj.nmMode) ? (obj.nmMode as NmMode) : DEFAULT_UI.nmMode,
    eraOnly: typeof obj.eraOnly === "boolean" ? obj.eraOnly : DEFAULT_UI.eraOnly,
    sortKey: COLUMNS.some((c) => c.key === obj.sortKey) ? (obj.sortKey as SortKey) : DEFAULT_UI.sortKey,
    sortDir: obj.sortDir === "desc" ? "desc" : "asc",
  };
}

const MAX_ROWS = 500;

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#161616",
  color: "#eaeaea",
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 800,
  borderBottom: "1px solid #444",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 8px",
  fontSize: 12,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

const highlightStyle: React.CSSProperties = {
  background: "#8af6b0",
  color: "#0c0c0c",
  borderRadius: 3,
  padding: "0 1px",
  fontWeight: 700,
};

/** Wraps every case-insensitive occurrence of q in text with a highlight span. */
function highlightText(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let idx = lower.indexOf(q);
  while (idx >= 0) {
    if (idx > pos) parts.push(text.slice(pos, idx));
    parts.push(
      <span key={idx} style={highlightStyle}>
        {text.slice(idx, idx + q.length)}
      </span>
    );
    pos = idx + q.length;
    idx = lower.indexOf(q, pos);
  }
  if (parts.length === 0) return text;
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}

function formatRate(p: number): string {
  if (p >= 100) return "100%";
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 1) return `${p.toFixed(2)}%`;
  return `${p.toFixed(3).replace(/0$/, "")}%`;
}

function formatLv(lv: [number, number] | null): string {
  if (!lv) return "—";
  return lv[0] === lv[1] ? String(lv[0]) : `${lv[0]}–${lv[1]}`;
}

function kindValue(k: DropKind): number {
  return k === "Drop" ? 0 : k === "Steal" ? 1 : 2;
}

function compareRows(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  if (key === "rate") cmp = a.rate - b.rate;
  else if (key === "stack") cmp = a.stack - b.stack;
  else if (key === "sell") cmp = a.sell - b.sell;
  else if (key === "ah") cmp = Number(a.ah) - Number(b.ah);
  else if (key === "lv") cmp = (a.lv ? a.lv[0] : -1) - (b.lv ? b.lv[0] : -1);
  else if (key === "kind") cmp = kindValue(a.kind) - kindValue(b.kind);
  else cmp = a[key].localeCompare(b[key]);
  if (cmp === 0) cmp = a.item.localeCompare(b.item);
  if (cmp === 0) cmp = a.mob.localeCompare(b.mob);
  if (cmp === 0) cmp = a.zone.localeCompare(b.zone);
  return dir === "asc" ? cmp : -cmp;
}

export default function DropsTab() {
  const [ui, setUi] = useState<DropsUiState>(() => normalizeState(loadJson<unknown>(UI_KEY, {})));

  const update = (patch: Partial<DropsUiState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      saveJson(UI_KEY, next);
      return next;
    });
  };

  const itemQ = ui.itemQuery.trim().toLowerCase();
  const mobQ = ui.mobQuery.trim().toLowerCase();

  const toggleKind = (k: DropKind) => {
    const next = ui.kinds.includes(k) ? ui.kinds.filter((x) => x !== k) : [...ui.kinds, k];
    update({ kinds: next });
  };

  const onHeaderClick = (key: SortKey) => {
    if (key === ui.sortKey) update({ sortDir: ui.sortDir === "asc" ? "desc" : "asc" });
    else update({ sortKey: key, sortDir: key === "rate" || key === "sell" ? "desc" : "asc" });
  };

  const filtered = useMemo(() => {
    const out: Row[] = [];
    for (const r of ROWS) {
      if (ui.eraOnly && !r.era) continue;
      if (ui.zone && r.zone !== ui.zone) continue;
      if (ui.kinds.length > 0 && !ui.kinds.includes(r.kind)) continue;
      if (ui.nmMode === "nm" && !r.nm) continue;
      if (ui.nmMode === "normal" && r.nm) continue;
      if (itemQ && !r.item.toLowerCase().includes(itemQ)) continue;
      if (mobQ && !r.mob.toLowerCase().includes(mobQ) && !r.zone.toLowerCase().includes(mobQ)) continue;
      out.push(r);
    }
    out.sort((a, b) => compareRows(a, b, ui.sortKey, ui.sortDir));
    return out;
  }, [ui.eraOnly, ui.zone, ui.kinds, ui.nmMode, itemQ, mobQ, ui.sortKey, ui.sortDir]);

  const shown = filtered.length > MAX_ROWS ? filtered.slice(0, MAX_ROWS) : filtered;

  const uniqueItems = useMemo(() => new Set(filtered.map((r) => r.itemId)).size, [filtered]);
  const uniqueMobs = useMemo(() => new Set(filtered.map((r) => `${r.zone}|${r.mob}`)).size, [filtered]);

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>Mob Drops</h3>
        <div style={styles.sub}>
          Drop, steal and despoil tables from LandSandBoat ({ROWS.length.toLocaleString()} entries)
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <div style={styles.subCard}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={styles.field}>
              <label style={styles.label}>Item search</label>
              <input
                type="text"
                placeholder="e.g. bounding boots"
                value={ui.itemQuery}
                onChange={(e) => update({ itemQuery: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Mob / zone search</label>
              <input
                type="text"
                placeholder="e.g. leaping lizzy"
                value={ui.mobQuery}
                onChange={(e) => update({ mobQuery: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Zone</label>
              <select value={ui.zone} onChange={(e) => update({ zone: e.target.value })} style={styles.select}>
                <option value="">All zones</option>
                {(ui.eraOnly ? ERA_ZONES : ZONES).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  style={{
                    ...styles.buttonCompact,
                    ...(ui.kinds.length === 0 ? { borderColor: "#8af6b0", color: "#8af6b0" } : {}),
                  }}
                  onClick={() => update({ kinds: [] })}
                >
                  All
                </button>
                {KINDS.map((k) => (
                  <button
                    key={k}
                    style={{
                      ...styles.buttonCompact,
                      ...(ui.kinds.includes(k) ? { borderColor: KIND_COLORS[k], color: KIND_COLORS[k] } : {}),
                    }}
                    onClick={() => toggleKind(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Mobs</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {NM_MODES.map((m) => (
                  <button
                    key={m.id}
                    style={{
                      ...styles.buttonCompact,
                      ...(ui.nmMode === m.id ? { borderColor: "#8af6b0", color: "#8af6b0" } : {}),
                    }}
                    onClick={() => update({ nmMode: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>&nbsp;</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ui.eraOnly}
                  onChange={(e) => update({ eraOnly: e.target.checked })}
                />
                Era only (pre-WotG)
              </label>
            </div>
          </div>

          <div style={{ ...styles.sub, marginTop: 8 }}>
            {filtered.length.toLocaleString()} entries · {uniqueItems.toLocaleString()} items ·{" "}
            {uniqueMobs.toLocaleString()} mobs
            {filtered.length > MAX_ROWS ? ` — showing first ${MAX_ROWS}, refine your search` : ""}
          </div>
        </div>

        <div style={{ ...styles.subCard, padding: 0, overflow: "auto", maxHeight: "70vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={thStyle} onClick={() => onHeaderClick(c.key)}>
                    <span style={ui.sortKey === c.key ? { color: "#8af6b0" } : undefined}>
                      {c.label}
                      {ui.sortKey === c.key ? (ui.sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{highlightText(r.item, itemQ)}</td>
                  <td style={{ ...tdStyle, ...(r.nm ? { color: "#ffa552", fontWeight: 700 } : {}) }}>
                    {highlightText(r.mob, mobQ)}
                    {r.nm ? " (NM)" : ""}
                  </td>
                  <td style={tdStyle}>{highlightText(r.zone, mobQ)}</td>
                  <td style={tdStyle}>{formatLv(r.lv)}</td>
                  <td style={{ ...tdStyle, color: KIND_COLORS[r.kind] }}>
                    {r.kind}
                    {r.grouped ? " (group)" : ""}
                  </td>
                  <td style={tdStyle}>{formatRate(r.rate)}</td>
                  <td style={tdStyle}>{r.stack > 1 ? r.stack : "—"}</td>
                  <td style={tdStyle}>{r.sell > 0 ? r.sell.toLocaleString() : "—"}</td>
                  <td style={tdStyle}>{r.ah ? "✓" : "—"}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={COLUMNS.length}>
                    No drops match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.sub}>
          Rates are per kill (Treasure Hunter not included). Grouped drops share one roll: the group rate is the
          chance anything in the group drops, split by item weight — the shown rate is the effective per-item
          chance. Steal/Despoil rates are per attempt. Vendor = LSB base sell price; AH = listable at auction.
        </div>
      </div>
    </section>
  );
}
