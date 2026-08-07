import React, { useEffect, useRef, useState } from "react";
import { styles } from "./styles";
import { loadJson, saveJson } from "./utils/storage";

type Stopwatch = {
  id: string;
  name: string;
  /** ms accumulated while paused */
  accumulatedMs: number;
  /** epoch ms when started running, or null if paused */
  startedAt: number | null;
  /** total elapsed ms at each lap press */
  laps: number[];
};

const STOPWATCH_KEY = "ffxi_stopwatches_v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function elapsedMs(sw: Stopwatch, now: number): number {
  return sw.accumulatedMs + (sw.startedAt !== null ? Math.max(0, now - sw.startedAt) : 0);
}

/** Formats ms as e.g. "2.15s", "1:02.15", "1:01:02.15" — always hundredths. */
export function formatStopwatch(ms: number): string {
  const totalHundredths = Math.floor(Math.max(0, ms) / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const hh = String(hundredths).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${hh}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${hh}`;
  }
  return `${seconds}.${hh}s`;
}

function makeStopwatch(index: number): Stopwatch {
  return {
    id: newId(),
    name: `Stopwatch ${index}`,
    accumulatedMs: 0,
    startedAt: null,
    laps: [],
  };
}

const timeStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontSize: 34,
  fontWeight: 800,
  letterSpacing: 0.5,
  lineHeight: 1.1,
  margin: "6px 0 2px",
};

const lapTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  marginTop: 8,
};

const lapCellStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderBottom: "1px solid #222",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const lapHeadStyle: React.CSSProperties = {
  ...lapCellStyle,
  opacity: 0.6,
  fontWeight: 600,
  textAlign: "right",
};

export default function StopwatchTab() {
  const [watches, setWatches] = useState<Stopwatch[]>(() => {
    const loaded = loadJson<Stopwatch[]>(STOPWATCH_KEY, []);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : [makeStopwatch(1)];
  });
  const [, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Persist on change.
  useEffect(() => {
    saveJson(STOPWATCH_KEY, watches);
  }, [watches]);

  // Re-render loop while any stopwatch is running.
  const anyRunning = watches.some((w) => w.startedAt !== null);
  useEffect(() => {
    if (!anyRunning) return;
    const loop = () => {
      setTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [anyRunning]);

  const now = Date.now();

  const update = (id: string, fn: (sw: Stopwatch) => Stopwatch) => {
    setWatches((prev) => prev.map((w) => (w.id === id ? fn(w) : w)));
  };

  const startPause = (id: string) => {
    const t = Date.now();
    update(id, (sw) =>
      sw.startedAt !== null
        ? { ...sw, accumulatedMs: elapsedMs(sw, t), startedAt: null }
        : { ...sw, startedAt: t }
    );
  };

  const lap = (id: string) => {
    const t = Date.now();
    update(id, (sw) => ({ ...sw, laps: [...sw.laps, elapsedMs(sw, t)] }));
  };

  const reset = (id: string) => {
    update(id, (sw) => ({ ...sw, accumulatedMs: 0, startedAt: null, laps: [] }));
  };

  const remove = (id: string) => {
    setWatches((prev) => prev.filter((w) => w.id !== id));
  };

  const addWatch = () => {
    setWatches((prev) => [...prev, makeStopwatch(prev.length + 1)]);
  };

  return (
    <div>
      <div style={styles.titleRow}>
        <h2 style={styles.h2}>Stopwatches</h2>
        <button style={styles.buttonPrimary} onClick={addWatch}>
          + Add Stopwatch
        </button>
      </div>

      <div style={styles.timerGrid}>
        {watches.map((sw) => {
          const ms = elapsedMs(sw, now);
          const running = sw.startedAt !== null;

          // Lap splits (delta from previous lap), find best/worst for highlighting.
          const splits = sw.laps.map((total, i) => total - (i > 0 ? sw.laps[i - 1] : 0));
          let bestIdx = -1;
          let worstIdx = -1;
          if (splits.length >= 2) {
            bestIdx = splits.indexOf(Math.min(...splits));
            worstIdx = splits.indexOf(Math.max(...splits));
          }

          return (
            <div key={sw.id} style={styles.card}>
              <input
                style={{ ...styles.inputCompact, fontWeight: 700 }}
                value={sw.name}
                onChange={(e) => update(sw.id, (w) => ({ ...w, name: e.target.value }))}
                placeholder="Stopwatch name"
              />

              <div style={{ ...timeStyle, color: running ? "#7CFC9B" : "#eaeaea" }}>
                {formatStopwatch(ms)}
              </div>
              {sw.laps.length > 0 && (
                <div style={styles.sub}>
                  Current lap: {formatStopwatch(ms - sw.laps[sw.laps.length - 1])}
                </div>
              )}

              <div style={styles.buttonRowCompact}>
                <button
                  style={{
                    ...styles.buttonPrimaryCompact,
                    ...(running ? { borderColor: "#8b5a2b" } : {}),
                  }}
                  onClick={() => startPause(sw.id)}
                >
                  {running ? "Pause" : ms > 0 ? "Resume" : "Start"}
                </button>
                <button
                  style={{
                    ...styles.buttonCompact,
                    ...(!running ? styles.buttonDisabled : {}),
                  }}
                  disabled={!running}
                  onClick={() => lap(sw.id)}
                >
                  Lap
                </button>
                <button
                  style={{
                    ...styles.buttonCompact,
                    ...(ms === 0 && sw.laps.length === 0 ? styles.buttonDisabled : {}),
                  }}
                  disabled={ms === 0 && sw.laps.length === 0}
                  onClick={() => reset(sw.id)}
                >
                  Reset
                </button>
                <button
                  style={{ ...styles.buttonCompact, marginLeft: "auto" }}
                  onClick={() => remove(sw.id)}
                  title="Delete stopwatch"
                >
                  ✕
                </button>
              </div>

              {sw.laps.length > 0 && (
                <table style={lapTableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...lapHeadStyle, textAlign: "left" }}>Lap</th>
                      <th style={lapHeadStyle}>Split</th>
                      <th style={lapHeadStyle}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sw.laps
                      .map((total, i) => ({ n: i + 1, total, split: splits[i], i }))
                      .reverse()
                      .map(({ n, total, split, i }) => {
                        const color =
                          i === bestIdx ? "#7CFC9B" : i === worstIdx ? "#ff8a8a" : undefined;
                        return (
                          <tr key={n} style={color ? { color } : undefined}>
                            <td style={{ ...lapCellStyle, textAlign: "left", opacity: 0.75 }}>
                              {n}
                            </td>
                            <td style={lapCellStyle}>{formatStopwatch(split)}</td>
                            <td style={lapCellStyle}>{formatStopwatch(total)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
