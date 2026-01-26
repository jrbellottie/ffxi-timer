// src/AppShell.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calibration,
  VanaWeekday,
  getVanaNow,
  moonDirectionFromStep,
  moonPercentFromStep,
  moonPhaseNameFromStep,
  nextEarthMsForMoonPercent,
  nextEarthMsForMoonStep,
  nextEarthMsForVanaWeekdayTime,
  calibrationFromSnapshot,
} from "./vanadiel";
import { styles } from "./styles";
import { loadJson, saveJson } from "./utils/storage";
import { formatCountdown, nextOccurrenceLocal, pad2, parseLocalDateTimeToMs, uid } from "./utils/time";
import { AnyTimer, MoonDirection } from "./types";
import { WEEKDAYS, WEEKDAY_COLORS, weekdayStyle } from "./utils/weekday";
import { moonDirGlyph, moonGlyphStyle, moonPhaseStyle } from "./utils/moon";
import { nextCookingGuildPrepTarget, nextTenshodoPrepTargets } from "./utils/guilds";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function stepFromDirectionAndPercent(dir: MoonDirection, pct: number): number {
  const p = clampInt(pct, 0, 100);
  if (p === 100) return 100;
  if (dir === "WAXING") return p;
  if (p === 0) return 0;
  return 200 - p;
}

const optionBaseStyle: React.CSSProperties = {
  backgroundColor: "#0c0c0c",
  color: "#eaeaea",
};

type TenshodoTarget = {
  label: string;
  targetWeekday: VanaWeekday;
  targetHour: number;
  targetMinute: number;
};

function mergeTenshodoTargets(targets: TenshodoTarget[]): TenshodoTarget[] {
  const map = new Map<string, TenshodoTarget>();

  for (const t of targets) {
    const key = `${t.targetWeekday}|${t.targetHour}|${t.targetMinute}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...t });
      continue;
    }

    const parts = existing.label.split(" / ").map((s) => s.trim());
    if (!parts.includes(t.label)) parts.push(t.label);

    map.set(key, {
      ...existing,
      label: parts.join(" / "),
    });
  }

  return Array.from(map.values());
}

function nextWeekdayOf(d: VanaWeekday): VanaWeekday {
  const idx = WEEKDAYS.indexOf(d);
  return WEEKDAYS[(idx + 1) % WEEKDAYS.length];
}

function computeNextDigTarget(now: ReturnType<typeof getVanaNow>): {
  targetWeekday: VanaWeekday;
  targetHour: number;
  targetMinute: number;
} {
  const targetHour = 22;
  const targetMinute = 0;

  const isPastToday = now.hour > targetHour || (now.hour === targetHour && now.minute >= targetMinute);

  return {
    targetWeekday: isPastToday ? nextWeekdayOf(now.weekday) : now.weekday,
    targetHour,
    targetMinute,
  };
}

export default function AppShell() {
  const [nowMs, setNowMs] = useState(Date.now());

  const [cal, setCal] = useState<Calibration | undefined>(() =>
    loadJson<Calibration | undefined>("ffxi_cal_v1", undefined)
  );
  const [timers, setTimers] = useState<AnyTimer[]>(() => loadJson<AnyTimer[]>("ffxi_timers_v2", []));

  const [showCalibration, setShowCalibration] = useState<boolean>(() =>
    loadJson<boolean>("ffxi_show_cal_v1", true)
  );

  const [showPresets, setShowPresets] = useState<boolean>(() =>
    loadJson<boolean>("ffxi_show_presets_v1", true)
  );

  const [cWeekday, setCWeekday] = useState<VanaWeekday>("Firesday");
  const [cHour, setCHour] = useState("0");
  const [cMin, setCMin] = useState("0");

  const [newMoonInput, setNewMoonInput] = useState("");

  const [tLabel, setTLabel] = useState("Timer");
  const [tWeekday, setTWeekday] = useState<VanaWeekday>("Earthsday");
  const [tHour, setTHour] = useState("1");
  const [tMin, setTMin] = useState("0");

  const [rLabel, setRLabel] = useState("Real Life Timer");
  const [rWhen, setRWhen] = useState(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  });

  const [mLabel, setMLabel] = useState("Moon Timer");
  const [mDir, setMDir] = useState<MoonDirection>("WAXING");
  const [mPercent, setMPercent] = useState("19");

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => saveJson("ffxi_cal_v1", cal), [cal]);
  useEffect(() => saveJson("ffxi_timers_v2", timers), [timers]);
  useEffect(() => saveJson("ffxi_show_cal_v1", showCalibration), [showCalibration]);
  useEffect(() => saveJson("ffxi_show_presets_v1", showPresets), [showPresets]);

  const hasEnabledTimers = useMemo(() => timers.some((t) => t.enabled), [timers]);
  useEffect(() => {
    window.electron?.ipcRenderer?.send?.("ffxi:keepAwake", { enabled: hasEnabledTimers });
  }, [hasEnabledTimers]);

  const now = useMemo(() => getVanaNow(nowMs, cal), [nowMs, cal]);
  const nowMoonDir = moonDirectionFromStep(now.moonStep);

  const nextMoonAt = now.nextMoonStepAtEarthMs;
  const msUntilNextMoonStep = nextMoonAt - nowMs;

  const nextMoonLabel = useMemo(() => {
    const after = getVanaNow(nextMoonAt + 25, cal);
    return {
      phase: after.moonPhaseName,
      pct: after.moonPercent,
      dir: moonDirectionFromStep(after.moonStep),
    };
  }, [nextMoonAt, cal]);

  const cookingGuildPreview = useMemo(() => {
    const target = nextCookingGuildPrepTarget(now);
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Cooking Guild", ...target, nextAt };
  }, [now, nowMs, cal]);

  const tenshodoPreviews = useMemo(() => {
    const rawTargets = nextTenshodoPrepTargets(now) as TenshodoTarget[];
    const mergedTargets = mergeTenshodoTargets(rawTargets);

    return mergedTargets.map((t) => {
      const nextAt = nextEarthMsForVanaWeekdayTime({
        nowEarthMs: nowMs,
        cal,
        targetWeekday: t.targetWeekday,
        targetHour: t.targetHour,
        targetMinute: t.targetMinute,
      });
      return { ...t, nextAt };
    });
  }, [now, nowMs, cal]);

  const nextDigPreview = useMemo(() => {
    const target = computeNextDigTarget(now);
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Next Dig", ...target, nextAt };
  }, [now, nowMs, cal]);

  useEffect(() => {
    if (!window.electron?.ipcRenderer?.on) return;

    const handler = (payload: { id: string }) => {
      setTimers((prev) => prev.map((t) => (t.id === payload.id ? { ...t, enabled: false } : t)));
    };

    window.electron.ipcRenderer.on("ffxi:timerDismissed", handler);
    return () => window.electron?.ipcRenderer?.off?.("ffxi:timerDismissed", handler);
  }, []);

  const lastFireRef = useRef<Record<string, number>>({});
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const nowMs2 = Date.now();
      const prevMs = lastTickRef.current;
      lastTickRef.current = nowMs2;

      const maxCatchupMs = 5 * 60 * 1000;
      const effectivePrevMs = nowMs2 - prevMs > maxCatchupMs ? nowMs2 - maxCatchupMs : prevMs;

      for (const t of timers) {
        if (!t.enabled) continue;

        const dueAt =
          t.kind === "VANA_WEEKDAY_TIME"
            ? nextEarthMsForVanaWeekdayTime({
                nowEarthMs: effectivePrevMs,
                cal,
                targetWeekday: t.targetWeekday,
                targetHour: t.targetHour,
                targetMinute: t.targetMinute,
              })
            : t.kind === "MOON_STEP"
              ? nextEarthMsForMoonStep({
                  nowEarthMs: effectivePrevMs,
                  cal,
                  targetMoonStep: t.targetMoonStep,
                })
              : t.kind === "MOON_PERCENT"
                ? nextEarthMsForMoonPercent({
                    nowEarthMs: effectivePrevMs,
                    cal,
                    targetPercent: t.targetPercent,
                  })
                : t.targetEarthMs;

        if (dueAt <= nowMs2) {
          const last = lastFireRef.current[t.id] ?? 0;
          if (nowMs2 - last > 10_000) {
            lastFireRef.current[t.id] = nowMs2;

            window.electron?.ipcRenderer?.send("ffxi:notify", {
              id: t.id,
              title: "FFXI Timer",
              body: `${t.label} is due now! (click to stop)`,
            });
          }

          if (t.kind === "EARTH_TIME") {
            setTimers((prev) =>
              prev.map((x) => {
                if (x.id !== t.id || x.kind !== "EARTH_TIME") return x;
                const next = nextOccurrenceLocal(x.targetEarthMs, nowMs2);
                return { ...x, targetEarthMs: next };
              })
            );
          }
        }
      }
    }, 250);

    return () => clearInterval(id);
  }, [timers, cal]);

  function saveDayCalibration() {
    const snapshotEarthMs = Date.now();
    const existingMoon = cal?.newMoonStartEarthMs ?? snapshotEarthMs;

    const calObj = calibrationFromSnapshot({
      snapshotEarthMs,
      weekday: cWeekday,
      hour: Number(cHour) || 0,
      minute: Number(cMin) || 0,
      newMoonStartEarthMs: existingMoon,
    });

    setCal(calObj);
    setShowCalibration(false);
  }

  function saveMoonCalibration() {
    if (!newMoonInput.trim()) {
      alert("Enter New Moon Start first.");
      return;
    }

    const newMoonStartEarthMs = parseLocalDateTimeToMs(newMoonInput);
    if (!Number.isFinite(newMoonStartEarthMs as number)) {
      alert("Invalid New Moon time.");
      return;
    }

    setCal({
      timeOffsetMs: cal?.timeOffsetMs ?? 0,
      newMoonStartEarthMs: newMoonStartEarthMs as number,
    });

    setShowCalibration(false);
  }

  function clearCalibration() {
    setCal(undefined);
    localStorage.removeItem("ffxi_cal_v1");
    setShowCalibration(true);
  }

  function addWeekdayTimer() {
    const hh = clampInt(Number(tHour) || 0, 0, 23);
    const mm = clampInt(Number(tMin) || 0, 0, 59);

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: tLabel.trim() || "Timer",
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: tWeekday,
        targetHour: hh,
        targetMinute: mm,
      },
      ...prev,
    ]);
  }

  function addRealLifeTimer() {
    const ms = parseLocalDateTimeToMs(rWhen);
    if (!Number.isFinite(ms as number)) {
      alert("Invalid real life time.");
      return;
    }
    const nextMs = nextOccurrenceLocal(ms as number, Date.now());

    setTimers((prev) => [
      {
        id: uid(),
        kind: "EARTH_TIME",
        label: rLabel.trim() || "Real Life Timer",
        enabled: true,
        createdAtMs: Date.now(),
        targetEarthMs: nextMs,
        rawInput: rWhen,
      },
      ...prev,
    ]);
  }

  function addCookingGuildTimer() {
    const target = nextCookingGuildPrepTarget(now);

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Cooking Guild (prep) — ${target.targetWeekday} ${pad2(target.targetHour)}:${pad2(target.targetMinute)}`,
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: target.targetWeekday,
        targetHour: target.targetHour,
        targetMinute: target.targetMinute,
      },
      ...prev,
    ]);
  }

  function addTenshodoTimers() {
    const rawTargets = nextTenshodoPrepTargets(now) as TenshodoTarget[];
    const mergedTargets = mergeTenshodoTargets(rawTargets);

    setTimers((prev) => [
      ...mergedTargets.map((t) => ({
        id: uid(),
        kind: "VANA_WEEKDAY_TIME" as const,
        label: `${t.label} (prep) — ${t.targetWeekday} ${pad2(t.targetHour)}:${pad2(t.targetMinute)}`,
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: t.targetWeekday,
        targetHour: t.targetHour,
        targetMinute: t.targetMinute,
      })),
      ...prev,
    ]);
  }

  function addNextDigTimer() {
    const target = computeNextDigTarget(now);

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Next Dig — ${target.targetWeekday} 22:00`,
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: target.targetWeekday,
        targetHour: target.targetHour,
        targetMinute: target.targetMinute,
      },
      ...prev,
    ]);
  }

  function addMoonTimer() {
    const pct = clampInt(Number(mPercent) || 0, 0, 100);
    const step = stepFromDirectionAndPercent(mDir, pct);

    const displayPct = moonPercentFromStep(step);
    const dir = moonDirectionFromStep(step);
    const phase = moonPhaseNameFromStep(step);

    setTimers((prev) => [
      {
        id: uid(),
        kind: "MOON_STEP",
        label: (mLabel.trim() || "Moon Timer") + ` (${moonDirGlyph(dir)} ${dir} ${displayPct}%, ${phase}, step ${step})`,
        enabled: true,
        createdAtMs: Date.now(),
        targetMoonStep: step,
      },
      ...prev,
    ]);
  }

  function toggleTimer(id: string) {
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  }

  function deleteTimer(id: string) {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  const hasDayCal = !!cal && Number.isFinite(cal.timeOffsetMs);
  const hasMoonCal = !!cal && Number.isFinite(cal.newMoonStartEarthMs) && cal.newMoonStartEarthMs > 0;

  const previewPct = clampInt(Number(mPercent) || 0, 0, 100);
  const previewStep = stepFromDirectionAndPercent(mDir, previewPct);
  const previewPhase = moonPhaseNameFromStep(previewStep);

  return (
    <div style={styles.page}>
      <div style={styles.topRow}>
        {/* LEFT: Clock + Calibration */}
        <section style={styles.cardStretch}>
          <div style={styles.titleRow}>
            <h2 style={styles.h2}>Vana&apos;diel Clock</h2>
            <div style={styles.sub}>
              Day: {hasDayCal ? "ON" : "OFF"} | Moon: {hasMoonCal ? "ON" : "OFF"}
            </div>
          </div>

          <div style={styles.cardBody}>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800 }}>
              <span style={weekdayStyle(now.weekday)}>{now.weekday}</span> {pad2(now.hour)}:{pad2(now.minute)}
            </div>

            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Moon:{" "}
              <span style={moonPhaseStyle(now.moonPhaseName)}>
                <span style={moonGlyphStyle()}>{moonDirGlyph(nowMoonDir)}</span>
                {now.moonPhaseName}
              </span>{" "}
              ({now.moonPercent}%)
            </div>

            <div style={{ marginTop: 10, ...styles.sub }}>
              Next moon step boundary: {new Date(nextMoonAt).toLocaleString()}
              <br />
              Countdown: {formatCountdown(msUntilNextMoonStep)}
              <br />
              Next step:{" "}
              <span style={moonPhaseStyle(nextMoonLabel.phase)}>
                <span style={moonGlyphStyle()}>{moonDirGlyph(nextMoonLabel.dir)}</span>
                {nextMoonLabel.phase}
              </span>{" "}
              ({nextMoonLabel.pct}%)
            </div>

            <div style={styles.divider} />

            <div style={styles.titleRow}>
              <h3 style={styles.h3}>Calibration</h3>
              <button style={styles.button} onClick={() => setShowCalibration((v) => !v)}>
                {showCalibration ? "Hide" : "Show"}
              </button>
            </div>

            {!showCalibration ? (
              <div style={{ marginTop: 10, ...styles.sub }}>Hidden (use “Show” if you need to recalibrate).</div>
            ) : (
              <>
                <div style={{ marginTop: 8, ...styles.sub }}>
                  Day and Moon are calibrated separately. Once set, this can stay hidden.
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <div style={styles.subCard}>
                    <div style={styles.titleRow}>
                      <div style={{ fontWeight: 800 }}>Day calibration</div>
                      <div style={styles.sub}>Match /clock</div>
                    </div>

                    <div style={{ marginTop: 10, ...styles.compactRow }}>
                      <div style={styles.field}>
                        <div style={styles.label}>Weekday</div>
                        <select
                          style={styles.select}
                          value={cWeekday}
                          onChange={(e) => setCWeekday(e.target.value as VanaWeekday)}
                        >
                          {WEEKDAYS.map((d) => (
                            <option
                              key={d}
                              value={d}
                              style={{
                                ...optionBaseStyle,
                                color: WEEKDAY_COLORS[d],
                                fontWeight: 800,
                              }}
                            >
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={styles.compactRow}>
                        <div style={styles.field}>
                          <div style={styles.label}>Hour</div>
                          <input style={styles.input} value={cHour} onChange={(e) => setCHour(e.target.value)} />
                        </div>
                        <div style={styles.field}>
                          <div style={styles.label}>Min</div>
                          <input style={styles.input} value={cMin} onChange={(e) => setCMin(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div style={styles.buttonRow}>
                      <button style={styles.buttonPrimary} onClick={saveDayCalibration}>
                        Save day calibration
                      </button>
                    </div>

                    <div style={{ marginTop: 8, ...styles.sub }}>
                      Stored offset (ms): {cal ? String(cal.timeOffsetMs) : "0"}
                    </div>
                  </div>

                  <div style={styles.subCard}>
                    <div style={styles.titleRow}>
                      <div style={{ fontWeight: 800 }}>Moon calibration</div>
                      <div style={styles.sub}>Local time</div>
                    </div>

                    <div style={{ marginTop: 10, ...styles.field }}>
                      <div style={styles.label}>New Moon Start</div>
                      <input
                        style={styles.input}
                        type="text"
                        value={newMoonInput}
                        onChange={(e) => setNewMoonInput(e.target.value)}
                        placeholder="01/24/2026 03:14:24 AM  (or 2026-01-24T03:14:24)"
                      />
                      <div style={styles.sub}>Supports: MM/DD/YYYY HH:MM:SS AM, or YYYY-MM-DDTHH:MM(:SS)</div>
                    </div>

                    <div style={styles.buttonRow}>
                      <button style={styles.buttonPrimary} onClick={saveMoonCalibration}>
                        Save moon calibration
                      </button>
                      <button style={styles.button} onClick={clearCalibration}>
                        Clear all
                      </button>
                    </div>

                    <div style={{ marginTop: 8, ...styles.sub }}>
                      Stored New Moon Start:{" "}
                      {cal?.newMoonStartEarthMs ? new Date(cal.newMoonStartEarthMs).toLocaleString() : "Not set"}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div style={styles.cardFooter} />
          </div>
        </section>

        {/* Vana timer */}
        <section style={styles.cardStretch}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Vana&apos;diel Timer</h3>
            <div style={styles.sub}>Triggers at that Vana time</div>
          </div>

          <div style={styles.cardBody}>
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={styles.field}>
                <div style={styles.label}>Label</div>
                <input style={styles.input} value={tLabel} onChange={(e) => setTLabel(e.target.value)} />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Weekday</div>
                <select
                  style={styles.select}
                  value={tWeekday}
                  onChange={(e) => setTWeekday(e.target.value as VanaWeekday)}
                >
                  {WEEKDAYS.map((d) => (
                    <option
                      key={d}
                      value={d}
                      style={{
                        ...optionBaseStyle,
                        color: WEEKDAY_COLORS[d],
                        fontWeight: 800,
                      }}
                    >
                      {d}
                    </option>
                  ))}
                </select>

                <div style={{ ...styles.sub, marginTop: 6 }}>
                  Selected: <span style={weekdayStyle(tWeekday)}>{tWeekday}</span>
                </div>
              </div>

              <div style={styles.compactRow}>
                <div style={styles.field}>
                  <div style={styles.label}>Hour</div>
                  <input style={styles.input} value={tHour} onChange={(e) => setTHour(e.target.value)} />
                </div>
                <div style={styles.field}>
                  <div style={styles.label}>Min</div>
                  <input style={styles.input} value={tMin} onChange={(e) => setTMin(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={styles.cardFooter}>
              <div style={styles.buttonRow}>
                <button style={styles.buttonPrimary} onClick={addWeekdayTimer}>
                  Add Vana&apos;diel timer
                </button>
              </div>
              <div style={{ marginTop: 8, ...styles.sub }}>Triggers at that Vana time.</div>
            </div>
          </div>
        </section>

        {/* Real life timer */}
        <section style={styles.cardStretch}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Real life timer</h3>
            <div style={styles.sub}>Triggers at the next occurrence of that local time</div>
          </div>

          <div style={styles.cardBody}>
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={styles.field}>
                <div style={styles.label}>Label</div>
                <input style={styles.input} value={rLabel} onChange={(e) => setRLabel(e.target.value)} />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>When (local)</div>
                <input style={styles.input} value={rWhen} onChange={(e) => setRWhen(e.target.value)} />
                <div style={styles.sub}>Supports: YYYY-MM-DDTHH:MM(:SS), or MM/DD/YYYY HH:MM(:SS) AM/PM</div>
              </div>
            </div>

            <div style={styles.cardFooter}>
              <div style={styles.buttonRow}>
                <button style={styles.buttonPrimary} onClick={addRealLifeTimer}>
                  Add real life timer
                </button>
              </div>
              <div style={{ marginTop: 8, ...styles.sub }}>Triggers at the next occurrence of that local time.</div>
            </div>
          </div>
        </section>

        {/* Moon timer */}
        <section style={styles.cardStretch}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Moon timer</h3>
            <div style={styles.sub}>Set by waxing/waning + %</div>
          </div>

          <div style={styles.cardBody}>
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={styles.field}>
                <div style={styles.label}>Label</div>
                <input style={styles.input} value={mLabel} onChange={(e) => setMLabel(e.target.value)} />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Direction</div>
                <select style={styles.select} value={mDir} onChange={(e) => setMDir(e.target.value as MoonDirection)}>
                  <option
                    value="WAXING"
                    style={{
                      ...optionBaseStyle,
                      color: "#D8B04B",
                      fontWeight: 800,
                    }}
                  >
                    Waxing
                  </option>
                  <option
                    value="WANING"
                    style={{
                      ...optionBaseStyle,
                      color: "#B9C2D6",
                      fontWeight: 800,
                    }}
                  >
                    Waning
                  </option>
                </select>
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Target % (0..100)</div>
                <input style={styles.input} value={mPercent} onChange={(e) => setMPercent(e.target.value)} />
              </div>

              <div style={styles.sub}>
                Will target: <span style={moonGlyphStyle()}>{moonDirGlyph(mDir)}</span>
                {mDir} {previewPct}% — <span style={moonPhaseStyle(previewPhase)}>{previewPhase}</span> (step{" "}
                {previewStep})
              </div>
            </div>

            <div style={styles.cardFooter}>
              <div style={styles.buttonRow}>
                <button style={styles.buttonPrimary} onClick={addMoonTimer}>
                  Add moon timer
                </button>
              </div>
              <div style={{ marginTop: 8, ...styles.sub }}>Unambiguous: direction + percent maps to one step.</div>
            </div>
          </div>
        </section>
      </div>

      {/* Preset timers */}
      <div style={styles.timersSection}>
        <section style={styles.card}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Preset timers</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={styles.sub}>Quick presets (prep timers)</div>
              <button style={styles.button} onClick={() => setShowPresets((v) => !v)}>
                {showPresets ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {!showPresets ? (
            <div style={{ marginTop: 10, ...styles.muted }}>Hidden.</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              {/* Next Dig */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Next Dig</div>
                  <div style={styles.sub}>Sets a timer for 22:00 on the current Vana day</div>
                </div>

                <div style={{ marginTop: 8, ...styles.sub }}>
                  Will set:{" "}
                  <span style={weekdayStyle(nextDigPreview.targetWeekday)}>{nextDigPreview.targetWeekday}</span>{" "}
                  {pad2(nextDigPreview.targetHour)}:{pad2(nextDigPreview.targetMinute)}
                  <br />
                  Next: {new Date(nextDigPreview.nextAt).toLocaleString()} — In:{" "}
                  {formatCountdown(nextDigPreview.nextAt - nowMs)}
                </div>

                <div style={{ marginTop: 10, ...styles.buttonRow }}>
                  <button style={styles.buttonPrimary} onClick={addNextDigTimer}>
                    Add Next Dig timer
                  </button>
                </div>
              </div>

              {/* Cooking */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Cooking Guild</div>
                  <div style={styles.sub}>Opens 05:00 → fires 04:00, closed Darksday</div>
                </div>

                <div style={{ marginTop: 8, ...styles.sub }}>
                  Will set:{" "}
                  <span style={weekdayStyle(cookingGuildPreview.targetWeekday)}>{cookingGuildPreview.targetWeekday}</span>{" "}
                  {pad2(cookingGuildPreview.targetHour)}:{pad2(cookingGuildPreview.targetMinute)}
                  <br />
                  Next: {new Date(cookingGuildPreview.nextAt).toLocaleString()} — In:{" "}
                  {formatCountdown(cookingGuildPreview.nextAt - nowMs)}
                </div>

                <div style={{ marginTop: 10, ...styles.buttonRow }}>
                  <button style={styles.buttonPrimary} onClick={addCookingGuildTimer}>
                    Add Cooking Guild timer
                  </button>
                </div>
              </div>

              {/* Tenshodo */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Tenshodo</div>
                  <div style={styles.sub}>Adds 2–3 timers (merged when hours+holiday match)</div>
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                  {tenshodoPreviews.map((t) => (
                    <div key={t.label} style={{ ...styles.sub, opacity: 0.95 }}>
                      <div style={{ fontWeight: 800 }}>{t.label}</div>
                      Will set:{" "}
                      <span style={weekdayStyle(t.targetWeekday)}>{t.targetWeekday}</span> {pad2(t.targetHour)}:
                      {pad2(t.targetMinute)}
                      <br />
                      Next: {new Date(t.nextAt).toLocaleString()} — In: {formatCountdown(t.nextAt - nowMs)}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, ...styles.buttonRow }}>
                  <button style={styles.buttonPrimary} onClick={addTenshodoTimers}>
                    Add Tenshodo timers
                  </button>
                </div>

                <div style={{ marginTop: 8, ...styles.sub }}>
                  Notes: Lower Jeuno closed Earthsday; Port Bastok closed Iceday; Norg closed Darksday. Prep is 1 hour before
                  open.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Timers list */}
      <div style={styles.timersSection}>
        <section style={styles.card}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Timers</h3>
            <div style={styles.sub}>{timers.length} total</div>
          </div>

          {timers.length === 0 ? (
            <div style={{ marginTop: 10, ...styles.muted }}>No timers yet.</div>
          ) : (
            <div style={styles.timerGrid}>
              {timers.map((t) => {
                const nextAt =
                  t.kind === "VANA_WEEKDAY_TIME"
                    ? nextEarthMsForVanaWeekdayTime({
                        nowEarthMs: nowMs,
                        cal,
                        targetWeekday: t.targetWeekday,
                        targetHour: t.targetHour,
                        targetMinute: t.targetMinute,
                      })
                    : t.kind === "MOON_STEP"
                      ? nextEarthMsForMoonStep({
                          nowEarthMs: nowMs,
                          cal,
                          targetMoonStep: t.targetMoonStep,
                        })
                      : t.kind === "MOON_PERCENT"
                        ? nextEarthMsForMoonPercent({
                            nowEarthMs: nowMs,
                            cal,
                            targetPercent: t.targetPercent,
                          })
                        : t.targetEarthMs;

                const inMs = nextAt - nowMs;

                const vanaAt = getVanaNow(nextAt, cal);

                let detailLine: React.ReactNode = null;

                if (t.kind === "VANA_WEEKDAY_TIME") {
                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Vana: {t.targetWeekday} {pad2(t.targetHour)}:{pad2(t.targetMinute)}
                    </div>
                  );
                } else if (t.kind === "MOON_STEP") {
                  const step = t.targetMoonStep;
                  const dir = moonDirectionFromStep(step);
                  const pct = moonPercentFromStep(step);
                  const phase = moonPhaseNameFromStep(step);

                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Moon: <span style={moonGlyphStyle()}>{moonDirGlyph(dir)}</span>
                      {dir} {pct}% (<span style={moonPhaseStyle(phase)}>{phase}</span>) step {step}
                    </div>
                  );
                } else if (t.kind === "MOON_PERCENT") {
                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      Moon: {t.targetPercent}%
                    </div>
                  );
                } else {
                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>Real: {new Date(t.targetEarthMs).toLocaleString()}</div>
                  );
                }

                return (
                  <div key={t.id} style={styles.timerItem}>
                    <div style={styles.timerTop}>
                      <div style={styles.timerLabel}>{t.label}</div>
                      <div style={styles.muted}>{t.enabled ? "Enabled" : "Disabled"}</div>
                    </div>

                    {detailLine}

                    <div style={{ marginTop: 6, ...styles.muted }}>
                      Next (Earth): {new Date(nextAt).toLocaleString()} — In: {formatCountdown(inMs)}
                      <br />
                      Next (Vana):{" "}
                      <span style={weekdayStyle(vanaAt.weekday)}>{vanaAt.weekday}</span> {pad2(vanaAt.hour)}:
                      {pad2(vanaAt.minute)}
                    </div>

                    <div style={styles.buttonRow}>
                      <button style={styles.button} onClick={() => toggleTimer(t.id)}>
                        {t.enabled ? "Disable" : "Enable"}
                      </button>
                      <button style={styles.button} onClick={() => deleteTimer(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
