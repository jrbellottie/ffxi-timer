import React, { useEffect, useMemo, useState } from "react";
import { styles } from "./styles";
import { Calibration } from "./vanadiel";
import { loadJson, saveJson } from "./utils/storage";
import { WEEKDAYS, weekdayStyle } from "./utils/weekday";
import weatherData from "./data/zoneWeather.json";

// ---------------------------------------------------------------------------
// Data (extracted from LandSandBoat sql/zone_weather.sql by
// scripts/extract-weather.py).
//
// Each zone maps to a pattern: 2160 uint16 values, one per Vana'diel day of
// the repeating weather cycle. A non-zero value sets that day's weather
// triple: normal = v >> 10, common = (v >> 5) & 0x1F, rare = v & 0x1F.
// Zero = unchanged (the last non-zero entry at or before the day applies).
//
// The server re-rolls weather every 3-30 earth minutes during the day:
// rand(100) < 15 -> rare, < 50 -> common, else normal (50% / 35% / 15%).
// ---------------------------------------------------------------------------

type WeatherData = {
  cycle: number;
  weathers: string[];
  patterns: string[]; // base64, 2160 little-endian uint16 each
  zones: Record<string, number>; // zone name -> pattern index
};

const DATA = weatherData as WeatherData;
const CYCLE = DATA.cycle;
const ZONE_NAMES = Object.keys(DATA.zones);

// Vana'diel time constants (matching src/vanadiel.ts).
const VANA_MS_PER_VANA_SECOND = 40;
const VANA_SECONDS_PER_DAY = 86400;
const EARTH_MS_PER_VANA_DAY = VANA_SECONDS_PER_DAY * VANA_MS_PER_VANA_SECOND; // 3,456,000 ms
// LSB Vana'diel epoch (Vana'diel 0886-01-01 00:00) = earth 2001-12-31 15:00:00 UTC.
const LSB_EPOCH_EARTH_MS = 1_009_810_800_000;

const ELEMENT_WEATHERS: { element: string; ids: [number, number] }[] = [
  { element: "Fire", ids: [4, 5] },
  { element: "Water", ids: [6, 7] },
  { element: "Earth", ids: [8, 9] },
  { element: "Wind", ids: [10, 11] },
  { element: "Ice", ids: [12, 13] },
  { element: "Lightning", ids: [14, 15] },
  { element: "Light", ids: [16, 17] },
  { element: "Dark", ids: [18, 19] },
];

const patternCache = new Map<number, Uint16Array>();

function getPattern(index: number): Uint16Array {
  let arr = patternCache.get(index);
  if (!arr) {
    const bin = atob(DATA.patterns[index]);
    arr = new Uint16Array(bin.length / 2);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    }
    patternCache.set(index, arr);
  }
  return arr;
}

function mod(n: number, m: number): number {
  const r = n % m;
  return r < 0 ? r + m : r;
}

/** Last non-zero pattern value at or before cycleDay (LSB weather_container). */
function entryForDay(pattern: Uint16Array, cycleDay: number): number {
  for (let d = cycleDay; d >= 0; d--) {
    if (pattern[d]) return pattern[d];
  }
  return 0;
}

/** Weather id -> chance % for one day's triple (slots sharing an id sum). */
function chancesForValue(v: number): Map<number, number> {
  const out = new Map<number, number>();
  const add = (id: number, pct: number) => out.set(id, (out.get(id) ?? 0) + pct);
  add(v >> 10, 50);
  add((v >> 5) & 0x1f, 35);
  add(v & 0x1f, 15);
  return out;
}

type ForecastRow = {
  absDay: number; // calibrated Vana'diel day index (1970-based)
  startEarthMs: number;
  chances: [number, number][]; // [weatherId, pct] sorted by pct desc
  matchPct: number; // chance of the filtered weather (0 when unfiltered)
};

const STORE_KEY = "ffxi_weather_v1";

type Stored = { zone: string; filter: string; dayOffset: number };

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

const MAX_ROWS = 40;

export default function WeatherTab({ cal }: { cal: Calibration }) {
  const stored = loadJson<Stored | null>(STORE_KEY, null);
  const [zone, setZone] = useState<string>(() =>
    stored && DATA.zones[stored.zone] !== undefined ? stored.zone : ZONE_NAMES[0] ?? ""
  );
  // "" = any, "w:<id>" = specific weather, "e:<element>" = either weather of element.
  const [filter, setFilter] = useState<string>(stored?.filter ?? "");
  // Manual cycle shift in Vana'diel days, in case the server's cycle is offset.
  const [dayOffset, setDayOffset] = useState<number>(stored?.dayOffset ?? 0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    saveJson(STORE_KEY, { zone, filter, dayOffset } satisfies Stored);
  }, [zone, filter, dayOffset]);

  // Refresh once a minute so "Today" and times stay current.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const filterIds = useMemo<number[] | null>(() => {
    if (!filter) return null;
    if (filter.startsWith("w:")) return [Number(filter.slice(2))];
    const el = ELEMENT_WEATHERS.find((e) => `e:${e.element}` === filter);
    return el ? [...el.ids] : null;
  }, [filter]);

  const { rows, todayAbsDay, scannedWholeCycle } = useMemo(() => {
    // Calibrated Vana'diel absolute seconds (same scale as vanadiel.ts).
    const vanaAbsNow = Math.floor((nowMs + cal.timeOffsetMs) / VANA_MS_PER_VANA_SECOND);
    const todayAbs = Math.floor(vanaAbsNow / VANA_SECONDS_PER_DAY);
    // Day index containing the LSB Vana'diel epoch, under the same calibration.
    const epochDay = Math.round(
      (LSB_EPOCH_EARTH_MS + cal.timeOffsetMs) / VANA_MS_PER_VANA_SECOND / VANA_SECONDS_PER_DAY
    );

    const patternIdx = DATA.zones[zone];
    const pattern = patternIdx !== undefined ? getPattern(patternIdx) : null;

    const out: ForecastRow[] = [];
    if (pattern) {
      for (let i = 0; i < CYCLE && out.length < MAX_ROWS; i++) {
        const absDay = todayAbs + i;
        const cycleDay = mod(absDay - epochDay + dayOffset, CYCLE);
        const v = entryForDay(pattern, cycleDay);
        const chances = chancesForValue(v);
        let matchPct = 0;
        if (filterIds) {
          for (const id of filterIds) matchPct += chances.get(id) ?? 0;
          if (matchPct === 0) continue;
        }
        out.push({
          absDay,
          startEarthMs: absDay * EARTH_MS_PER_VANA_DAY - cal.timeOffsetMs,
          chances: [...chances.entries()].sort((a, b) => b[1] - a[1]),
          matchPct,
        });
        // Without a filter, only show the next MAX_ROWS consecutive days.
        if (!filterIds && i >= MAX_ROWS - 1) break;
      }
    }
    return { rows: out, todayAbsDay: todayAbs, scannedWholeCycle: !!filterIds };
  }, [zone, filterIds, dayOffset, nowMs, cal.timeOffsetMs]);

  function formatEarth(ms: number): string {
    return new Date(ms).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>Weather forecast</h3>
      </div>
      <div style={styles.sub}>
        Per-zone weather patterns from LandSandBoat. Each Vana'diel day has a fixed pattern; the
        server re-rolls every 3&ndash;30 earth minutes: 50% normal / 35% common / 15% rare.
      </div>

      <div style={{ ...styles.subCard, marginTop: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={styles.field}>
            <label style={styles.label}>Zone</label>
            <select style={styles.select} value={zone} onChange={(e) => setZone(e.target.value)}>
              {ZONE_NAMES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Weather</label>
            <select style={styles.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Any weather</option>
              {ELEMENT_WEATHERS.map(({ element, ids }) => (
                <optgroup key={element} label={element}>
                  <option value={`e:${element}`}>Any {element} weather</option>
                  <option value={`w:${ids[0]}`}>{DATA.weathers[ids[0]]} (single)</option>
                  <option value={`w:${ids[1]}`}>{DATA.weathers[ids[1]]} (double)</option>
                </optgroup>
              ))}
              <optgroup label="Other">
                <option value="w:1">Sunshine</option>
                <option value="w:2">Clouds</option>
                <option value="w:3">Fog</option>
              </optgroup>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Day offset</label>
            <input
              type="number"
              style={{ ...styles.inputCompact, width: 70 }}
              value={dayOffset}
              onChange={(e) => setDayOffset(Math.trunc(Number(e.target.value) || 0))}
              title="Shift the forecast by whole Vana'diel days if it doesn't match in-game."
            />
          </div>
        </div>
        <div style={{ ...styles.sub, marginTop: 8 }}>
          If the forecast doesn't match in-game weather, the server's cycle may be shifted &mdash;
          adjust Day offset until today's pattern matches (topaz-based servers are typically 1440).
        </div>
      </div>

      <div style={{ marginTop: 10, maxHeight: 520, overflowY: "auto", border: "1px solid #333", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Earth time (local)</th>
              <th style={thStyle}>Vana'diel day</th>
              <th style={thStyle}>Forecast (chance per roll)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const weekday = WEEKDAYS[mod(row.absDay, 8)];
              const isToday = row.absDay === todayAbsDay;
              return (
                <tr key={row.absDay} style={isToday ? { background: "rgba(138,246,176,0.08)" } : undefined}>
                  <td style={tdStyle}>
                    {formatEarth(row.startEarthMs)}
                    {isToday && <span style={{ color: "#8af6b0", fontWeight: 800 }}> &middot; Today</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={weekdayStyle(weekday)}>{weekday}</span>
                  </td>
                  <td style={tdStyle}>
                    {row.chances.map(([id, pct], i) => {
                      const matched = filterIds?.includes(id) ?? false;
                      return (
                        <span key={id}>
                          {i > 0 && <span style={{ opacity: 0.4 }}> &middot; </span>}
                          <span style={matched ? { color: "#8af6b0", fontWeight: 800 } : undefined}>
                            {id === 0 ? "Clear" : DATA.weathers[id]} {pct}%
                          </span>
                        </span>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan={3}>
                  No days with that weather in this zone
                  {scannedWholeCycle ? " (searched the full 2160-day cycle)." : "."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
