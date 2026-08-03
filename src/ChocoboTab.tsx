import React, { useEffect, useMemo, useState } from "react";
import { styles } from "./styles";
import digData from "./data/chocoboDig.json";
import digPrices from "./data/digPrices.json";
import { loadJson, saveJson } from "./utils/storage";

type DigMode = "burrow" | "bore" | "both" | null;

type DigEntry = {
  zone: string;
  item: string;
  rate: number;
  /** Minimum digging rank; null = Amateur (no requirement). */
  rank: string | null;
  /** burrow | bore | both | null (normal dig). */
  mode: DigMode;
};

// Digging ranks in progression order. "Amateur" = no rank requirement.
const RANKS = [
  "Amateur",
  "Recruit",
  "Initiate",
  "Novice",
  "Apprentice",
  "Journeyman",
  "Craftsman",
  "Artisan",
  "Adept",
] as const;

type Rank = (typeof RANKS)[number];

const MODE_TOGGLES = [
  { id: "normal", label: "Normal dig" },
  { id: "burrow", label: "Burrow" },
  { id: "bore", label: "Bore" },
] as const;

type ModeId = (typeof MODE_TOGGLES)[number]["id"];

type SortKey = "zone" | "item" | "rate" | "vendor" | "ah" | "rank" | "type" | "zoneGil" | "zoneGilAh";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "zone", label: "Zone" },
  { key: "item", label: "Item" },
  { key: "rate", label: "Rate" },
  { key: "vendor", label: "Vendor" },
  { key: "ah", label: "AH price" },
  { key: "rank", label: "Min Rank" },
  { key: "type", label: "Type" },
  { key: "zoneGil", label: "Gil / 100 digs (vendor)" },
  { key: "zoneGilAh", label: "Gil / 100 digs (AH)" },
];

const ENTRIES: DigEntry[] = (digData as { entries: DigEntry[] }).entries;

const PRICES = digPrices as Record<string, number>;

// Cluster vendor prices (LSB item_basic BaseSell); clusters only come from
// double-weather digs so they are not in digPrices.json.
const CLUSTER_PRICES: Record<string, number> = {
  "Fire Cluster": 200,
  "Ice Cluster": 400,
  "Wind Cluster": 200,
  "Earth Cluster": 200,
  "Lightning Cluster": 400,
  "Water Cluster": 200,
  "Light Cluster": 1000,
  "Dark Cluster": 1000,
};

function vendorPrice(item: string): number {
  return PRICES[item] ?? CLUSTER_PRICES[item] ?? 0;
}

const WEATHER_ELEMENTS = ["Fire", "Ice", "Wind", "Earth", "Lightning", "Water", "Light", "Dark"] as const;

// Per LSB logic.lua: during weather, the matching crystal (single weather) or
// cluster (double weather) is added to the regular dig layer with a 10% roll,
// no rank requirement.
const WEATHER_RATE = 10;

const ZONES = [...new Set(ENTRIES.map((e) => e.zone))];

/**
 * Cost of Gysahl Greens per successful dig. Greens cost 61g each, but dig
 * accuracy is well below 100%, so roughly 2 greens are spent per item dug.
 */
const GYSAHL_COST = 61 * 2;

/** localStorage key for user-set AH prices (item name -> gil). */
const AH_PRICES_KEY = "ffxi_dig_ah_prices_v1";

function rankIndex(rank: string | null): number {
  if (!rank) return 0;
  const idx = RANKS.indexOf(rank as Rank);
  return idx < 0 ? 0 : idx;
}

function modeValue(mode: DigMode): number {
  if (mode === null) return 0;
  if (mode === "burrow") return 1;
  if (mode === "bore") return 2;
  return 3; // both
}

function compareEntries(
  a: DigEntry,
  b: DigEntry,
  key: SortKey,
  dir: SortDir,
  ctx: {
    zoneGil: Record<string, number>;
    zoneGilAh: Record<string, number>;
    eff: (item: string) => number;
    ah: Record<string, number>;
  }
): number {
  let cmp = 0;

  if (key === "rate") {
    cmp = a.rate - b.rate;
  } else if (key === "vendor") {
    cmp = vendorPrice(a.item) - vendorPrice(b.item);
  } else if (key === "ah") {
    cmp = (ctx.ah[a.item] ?? 0) - (ctx.ah[b.item] ?? 0);
  } else if (key === "rank") {
    cmp = rankIndex(a.rank) - rankIndex(b.rank);
  } else if (key === "type") {
    cmp = modeValue(a.mode) - modeValue(b.mode);
  } else if (key === "zoneGil") {
    cmp = (ctx.zoneGil[a.zone] ?? 0) - (ctx.zoneGil[b.zone] ?? 0);
    if (cmp === 0) cmp = a.zone.localeCompare(b.zone);
  } else if (key === "zoneGilAh") {
    cmp = (ctx.zoneGilAh[a.zone] ?? 0) - (ctx.zoneGilAh[b.zone] ?? 0);
    if (cmp === 0) cmp = a.zone.localeCompare(b.zone);
  } else {
    cmp = a[key].localeCompare(b[key]);
  }

  if (cmp === 0) cmp = a.item.localeCompare(b.item);
  return dir === "asc" ? cmp : -cmp;
}

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
  padding: "7px 10px",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

export default function ChocoboTab() {
  // Empty selection = all zones.
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [rankFilter, setRankFilter] = useState<Rank>("Adept");
  const [itemQuery, setItemQuery] = useState<string>("");
  // Empty selection = "All" (no dig type filtering).
  const [activeModes, setActiveModes] = useState<ModeId[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("zone");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Weather item ("" = no weather): crystal for single weather, cluster for double.
  const [weatherItem, setWeatherItem] = useState<string>("");
  // User-set AH prices (item -> gil), persisted across reloads.
  const [ahPrices, setAhPrices] = useState<Record<string, number>>(() => loadJson(AH_PRICES_KEY, {}));

  useEffect(() => {
    saveJson(AH_PRICES_KEY, ahPrices);
  }, [ahPrices]);

  function setAhPrice(item: string, raw: string) {
    setAhPrices((prev) => {
      const next = { ...prev };
      const value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value) || value <= 0) {
        delete next[item];
      } else {
        next[item] = Math.round(value);
      }
      return next;
    });
  }

  /** Effective price: user AH price if set, otherwise vendor price. */
  function eff(item: string): number {
    const ah = ahPrices[item];
    return ah !== undefined && ah > 0 ? ah : vendorPrice(item);
  }

  const allActive = activeModes.length === 0;

  function toggleMode(id: ModeId) {
    setActiveModes((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function addZone(zone: string) {
    if (zone === "") return;
    setZoneFilter((prev) => (prev.includes(zone) ? prev : [...prev, zone]));
  }

  function removeZone(zone: string) {
    setZoneFilter((prev) => prev.filter((z) => z !== zone));
  }

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const maxRank = RANKS.indexOf(rankFilter);

  function matchesRankAndMode(entry: DigEntry): boolean {
    if (rankIndex(entry.rank) > maxRank) return false;
    return (
      activeModes.length === 0 ||
      (activeModes.includes("normal") && entry.mode === null) ||
      (activeModes.includes("burrow") && (entry.mode === "burrow" || entry.mode === "both")) ||
      (activeModes.includes("bore") && (entry.mode === "bore" || entry.mode === "both"))
    );
  }

  // With weather active, every zone's normal dig layer also drops the matching
  // crystal/cluster at a 10% rate (no rank requirement).
  const allEntries = useMemo(() => {
    if (weatherItem === "") return ENTRIES;
    const extra: DigEntry[] = ZONES.map((zone) => ({
      zone,
      item: weatherItem,
      rate: WEATHER_RATE,
      rank: null,
      mode: null,
    }));
    return [...ENTRIES, ...extra];
  }, [weatherItem]);

  // Expected gil per 100 digs (roughly one day of digging) for each zone,
  // given the current rank and dig type filters, minus the cost of greens.
  // Each item's dig rate acts as its weight in the zone pool:
  // share = rate / total zone rate, EV per dig = sum(share * price) - green cost.
  // Computed twice: once with vendor prices only, once with user AH prices
  // falling back to vendor prices.
  const { zoneGil, zoneGilAh } = useMemo(() => {
    const vendor: Record<string, number> = {};
    const withAh: Record<string, number> = {};
    for (const zone of ZONES) {
      const pool = allEntries.filter((e) => e.zone === zone && matchesRankAndMode(e));
      const totalRate = pool.reduce((sum, e) => sum + e.rate, 0);
      if (totalRate <= 0) {
        vendor[zone] = 0;
        withAh[zone] = 0;
        continue;
      }
      const evVendor = pool.reduce((sum, e) => sum + (e.rate / totalRate) * vendorPrice(e.item), 0);
      const evAh = pool.reduce((sum, e) => sum + (e.rate / totalRate) * eff(e.item), 0);
      vendor[zone] = Math.round((evVendor - GYSAHL_COST) * 100);
      withAh[zone] = Math.round((evAh - GYSAHL_COST) * 100);
    }
    return { zoneGil: vendor, zoneGilAh: withAh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankFilter, activeModes, ahPrices, allEntries]);

  const filtered = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (zoneFilter.length > 0 && !zoneFilter.includes(entry.zone)) return false;
      if (q !== "" && !entry.item.toLowerCase().includes(q)) return false;
      return matchesRankAndMode(entry);
    }).sort((a, b) => compareEntries(a, b, sortKey, sortDir, { zoneGil, zoneGilAh, eff, ah: ahPrices }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneFilter, rankFilter, itemQuery, activeModes, sortKey, sortDir, zoneGil, zoneGilAh, ahPrices, allEntries]);

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>Chocobo Digging</h3>
        <div style={styles.sub}>Filter dig results by zone, rank, and burrow/bore</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <div style={styles.subCard}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={styles.field}>
              <label style={styles.label}>Zones (pick to add, click to remove)</label>
              <select value="" onChange={(e) => addZone(e.target.value)} style={styles.select}>
                <option value="">{zoneFilter.length === 0 ? "All zones" : "Add a zone..."}</option>
                {ZONES.filter((zone) => !zoneFilter.includes(zone)).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              {zoneFilter.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {zoneFilter.map((zone) => (
                    <button
                      key={zone}
                      style={{ ...styles.buttonCompact, borderColor: "#8af6b0", color: "#8af6b0" }}
                      onClick={() => removeZone(zone)}
                      title="Remove zone"
                    >
                      {zone} {"\u00d7"}
                    </button>
                  ))}
                  <button style={styles.buttonCompact} onClick={() => setZoneFilter([])}>
                    Clear (all zones)
                  </button>
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Item search</label>
              <input
                type="text"
                placeholder="e.g. elm log"
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>My dig rank (shows items at or below)</label>
              <select value={rankFilter} onChange={(e) => setRankFilter(e.target.value as Rank)} style={styles.select}>
                {RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Weather (adds crystal to every zone)</label>
              <select value={weatherItem} onChange={(e) => setWeatherItem(e.target.value)} style={styles.select}>
                <option value="">None</option>
                <optgroup label="Single weather (crystal)">
                  {WEATHER_ELEMENTS.map((el) => (
                    <option key={`${el} Crystal`} value={`${el} Crystal`}>
                      {el} - {el} Crystal
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Double weather (cluster)">
                  {WEATHER_ELEMENTS.map((el) => (
                    <option key={`${el} Cluster`} value={`${el} Cluster`}>
                      {el} x2 - {el} Cluster
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Dig type (tap to toggle)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{
                    ...styles.buttonCompact,
                    ...(allActive ? { borderColor: "#8af6b0", color: "#8af6b0" } : {}),
                  }}
                  onClick={() => setActiveModes([])}
                >
                  All
                </button>
                {MODE_TOGGLES.map((mode) => (
                  <button
                    key={mode.id}
                    style={{
                      ...styles.buttonCompact,
                      ...(activeModes.includes(mode.id) ? { borderColor: "#8af6b0", color: "#8af6b0" } : {}),
                    }}
                    onClick={() => toggleMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, ...styles.sub }}>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        <div style={styles.subCard}>
          {filtered.length === 0 ? (
            <div style={styles.sub}>No dig results match the current filters.</div>
          ) : (
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
                          {active ? (sortDir === "asc" ? " \u25b2" : " \u25bc") : ""}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={`${entry.zone}|${entry.item}|${entry.mode ?? "normal"}`}>
                      <td style={tdStyle}>{entry.zone}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {entry.item}
                        {weatherItem !== "" && entry.item === weatherItem && entry.mode === null && (
                          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#8af6b0" }}>weather</span>
                        )}
                      </td>
                      <td style={tdStyle}>{entry.rate}%</td>
                      <td style={tdStyle}>
                        {vendorPrice(entry.item) > 0 ? (
                          `${vendorPrice(entry.item).toLocaleString()}g`
                        ) : (
                          <span style={{ opacity: 0.5 }}>no NPC sale</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min={0}
                          placeholder="-"
                          value={ahPrices[entry.item] ?? ""}
                          onChange={(e) => setAhPrice(entry.item, e.target.value)}
                          style={{
                            ...styles.inputCompact,
                            width: 90,
                            height: 26,
                            fontSize: 12,
                            ...(ahPrices[entry.item] !== undefined ? { borderColor: "#8af6b0", color: "#8af6b0" } : {}),
                          }}
                        />
                      </td>
                      <td style={tdStyle}>{entry.rank ?? "Amateur"}</td>
                      <td style={tdStyle}>
                        {entry.mode === null ? "Normal" : entry.mode === "both" ? "Burrow/Bore" : entry.mode === "burrow" ? "Burrow" : "Bore"}
                      </td>
                      <td style={{ ...tdStyle, ...((zoneGil[entry.zone] ?? 0) < 0 ? { color: "#ff8a8a" } : {}) }}>
                        {(zoneGil[entry.zone] ?? 0).toLocaleString()}g
                      </td>
                      <td style={{ ...tdStyle, ...((zoneGilAh[entry.zone] ?? 0) < 0 ? { color: "#ff8a8a" } : {}) }}>
                        {(zoneGilAh[entry.zone] ?? 0).toLocaleString()}g
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
