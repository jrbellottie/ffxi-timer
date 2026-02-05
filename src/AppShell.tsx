// src/AppShell.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calibration,
  DEFAULT_CALIBRATION,
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
import { formatCountdown, nextOccurrenceLocal, pad2, parseDurationToMs, parseLocalDateTimeToMs, uid } from "./utils/time";
import { AnyTimer, MoonDirection } from "./types";
import { WEEKDAYS, WEEKDAY_COLORS, weekdayStyle } from "./utils/weekday";
import { moonDirGlyph, moonGlyphStyle, moonPhaseStyle } from "./utils/moon";
import { buildTenshodoPresets, nextGuildAlertTarget } from "./utils/guilds";
import { getNextNmLotteryEvent, getNextNmTimedWindowEvent } from "./utils/nm";

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

const PRESET_OFFSET_MIN = 0;
const PRESET_OFFSET_MAX = 23;

export default function AppShell() {
  const [nowMs, setNowMs] = useState(Date.now());

  // Ship a sensible default so most users can skip manual setup.
  // If older installs saved `null`, treat it as "no value" and fall back to defaults.
  const [cal, setCal] = useState<Calibration>(() => {
    const stored = loadJson<Calibration | null>("ffxi_cal_v1", DEFAULT_CALIBRATION);
    return stored ?? DEFAULT_CALIBRATION;
  });
  const [timers, setTimers] = useState<AnyTimer[]>(() => loadJson<AnyTimer[]>("ffxi_timers_v2", []));

  const [showCalibration, setShowCalibration] = useState<boolean>(() => loadJson<boolean>("ffxi_show_cal_v1", false));

  const [showPresets, setShowPresets] = useState<boolean>(() =>
    loadJson<boolean>("ffxi_show_presets_v1", true)
  );

  const [presetOffsetHours, setPresetOffsetHours] = useState<number>(() =>
    clampInt(loadJson<number>("ffxi_preset_offset_hours_v1", 2), PRESET_OFFSET_MIN, PRESET_OFFSET_MAX)
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

  const [nmMode, setNmMode] = useState<"TIMED_WINDOW" | "LOTTERY">("TIMED_WINDOW");
  const [nmLabel, setNmLabel] = useState("NM Timer");
  const [nmWarnLead, setNmWarnLead] = useState("10s");
  const [nmTodInput, setNmTodInput] = useState("");

  // Timed spawn window
  const [nmWindowStart, setNmWindowStart] = useState("2h");
  const [nmWindowEnd, setNmWindowEnd] = useState("2.5h");
  const [nmWindowInterval, setNmWindowInterval] = useState("5m");

  // Lottery NM (window open + PH respawn)
  const [nmLotteryWindowOpen, setNmLotteryWindowOpen] = useState("1:45:55");
  const [nmPhRespawn, setNmPhRespawn] = useState("5m");

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => saveJson("ffxi_cal_v1", cal), [cal]);
  useEffect(() => saveJson("ffxi_timers_v2", timers), [timers]);
  useEffect(() => saveJson("ffxi_show_cal_v1", showCalibration), [showCalibration]);
  useEffect(() => saveJson("ffxi_show_presets_v1", showPresets), [showPresets]);
  useEffect(() => saveJson("ffxi_preset_offset_hours_v1", presetOffsetHours), [presetOffsetHours]);

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
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 5,
        openMinute: 0,
        closedOn: "Darksday",
      },
      presetOffsetHours
    );
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Cooking Guild", ...target, nextAt };
  }, [now, nowMs, cal, presetOffsetHours]);

  const leathercraftGuildPreview = useMemo(() => {
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 3,
        openMinute: 0,
        closedOn: "Iceday",
      },
      presetOffsetHours
    );
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Leathercraft Guild", ...target, nextAt };
  }, [now, nowMs, cal, presetOffsetHours]);

  const clothcraftGuildPreview = useMemo(() => {
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 6,
        openMinute: 0,
        closedOn: "Firesday",
      },
      presetOffsetHours
    );
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Clothcraft Guild", ...target, nextAt };
  }, [now, nowMs, cal, presetOffsetHours]);

  const tenshodoPreviews = useMemo(() => {
    const presets = buildTenshodoPresets();
    const rawTargets = presets.map((p) => ({
      label: p.label,
      ...nextGuildAlertTarget(now, p.schedule, presetOffsetHours),
    })) as TenshodoTarget[];

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
  }, [now, nowMs, cal, presetOffsetHours]);

  const nextDigPreview = useMemo(() => {
    // "Next Dig" target is 00:00; we alert `presetOffsetHours` before that.
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 0,
        openMinute: 0,
        closedOn: null,
      },
      presetOffsetHours
    );
    const nextAt = nextEarthMsForVanaWeekdayTime({
      nowEarthMs: nowMs,
      cal,
      targetWeekday: target.targetWeekday,
      targetHour: target.targetHour,
      targetMinute: target.targetMinute,
    });
    return { label: "Next Dig", ...target, nextAt };
  }, [now, nowMs, cal, presetOffsetHours]);

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

      const timedWindowExpiredIds: string[] = [];
      const lotteryClearPhIds: string[] = [];

      for (const t of timers) {
        if (!t.enabled) continue;

        // NM timers have multiple internal events (warn + pop), so they use a different scheduler.
        let event:
          | {
              atMs: number;
              title: string;
              body: string;
              fireKey: string;
              repeat?: boolean;
              action?: { type: "NM_LOTTERY_CLEAR_PH" };
            }
          | null = null;

        if (t.kind === "NM_TIMED_WINDOW") {
          const endAt = t.baseEarthMs + t.windowEndOffsetMs;
          if (nowMs2 > endAt + 60_000) {
            timedWindowExpiredIds.push(t.id);
            continue;
          }

          event = getNextNmTimedWindowEvent(t, effectivePrevMs);
          if (event) event = { ...event, repeat: false };
        } else if (t.kind === "NM_LOTTERY") {
          if (t.phNextAtMs !== null && nowMs2 > t.phNextAtMs + 60_000) {
            lotteryClearPhIds.push(t.id);
          }

          event = getNextNmLotteryEvent(t, effectivePrevMs);
          if (event) event = { ...event, repeat: false };
        }

        if (!event && (t.kind === "NM_TIMED_WINDOW" || t.kind === "NM_LOTTERY")) {
          continue;
        }

        // All other timer kinds behave like "one next due time".
        if (!event) {
          let dueAt: number;

          if (t.kind === "VANA_WEEKDAY_TIME") {
            dueAt = nextEarthMsForVanaWeekdayTime({
              nowEarthMs: effectivePrevMs,
              cal,
              targetWeekday: t.targetWeekday,
              targetHour: t.targetHour,
              targetMinute: t.targetMinute,
            });
          } else if (t.kind === "MOON_STEP") {
            dueAt = nextEarthMsForMoonStep({
              nowEarthMs: effectivePrevMs,
              cal,
              targetMoonStep: t.targetMoonStep,
            });
          } else if (t.kind === "MOON_PERCENT") {
            dueAt = nextEarthMsForMoonPercent({
              nowEarthMs: effectivePrevMs,
              cal,
              targetPercent: t.targetPercent,
            });
          } else if (t.kind === "EARTH_TIME") {
            dueAt = t.targetEarthMs;
          } else {
            continue;
          }

          event = {
            atMs: dueAt,
            title: "FFXI Timer",
            body: `${t.label} is due now! (click to stop)`,
            fireKey: "due",
            repeat: true,
          };
        }

        if (event.atMs <= nowMs2) {
          const fireKey = `${t.id}|${event.fireKey}`;
          const last = lastFireRef.current[fireKey] ?? 0;
          if (nowMs2 - last > 10_000) {
            lastFireRef.current[fireKey] = nowMs2;

            window.electron?.ipcRenderer?.send("ffxi:notify", {
              id: t.id,
              title: event.title,
              body: event.body,
              repeat: event.repeat,
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

          if (t.kind === "NM_LOTTERY" && event.action?.type === "NM_LOTTERY_CLEAR_PH") {
            lotteryClearPhIds.push(t.id);
          }
        }
      }

      if (timedWindowExpiredIds.length > 0 || lotteryClearPhIds.length > 0) {
        setTimers((prev) =>
          prev.map((x) => {
            if (timedWindowExpiredIds.includes(x.id)) return { ...x, enabled: false };
            if (lotteryClearPhIds.includes(x.id) && x.kind === "NM_LOTTERY") return { ...x, phNextAtMs: null };
            return x;
          })
        );
      }
    }, 250);

    return () => clearInterval(id);
  }, [timers, cal]);

  function saveDayCalibration() {
    const snapshotEarthMs = Date.now();
    const existingMoon = cal.newMoonStartEarthMs;

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
      timeOffsetMs: cal.timeOffsetMs,
      newMoonStartEarthMs: newMoonStartEarthMs as number,
    });

    setShowCalibration(false);
  }

  function clearCalibration() {
    // Revert to baked-in defaults (users can still manually recalibrate if desired).
    setCal(DEFAULT_CALIBRATION);
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
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 5,
        openMinute: 0,
        closedOn: "Darksday",
      },
      presetOffsetHours
    );

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Cooking Guild (offset ${presetOffsetHours}h) — ${target.targetWeekday} ${pad2(target.targetHour)}:${pad2(
          target.targetMinute
        )}`,
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: target.targetWeekday,
        targetHour: target.targetHour,
        targetMinute: target.targetMinute,
      },
      ...prev,
    ]);
  }

  function addLeathercraftGuildTimer() {
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 3,
        openMinute: 0,
        closedOn: "Iceday",
      },
      presetOffsetHours
    );

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Leathercraft Guild (offset ${presetOffsetHours}h) — ${target.targetWeekday} ${pad2(
          target.targetHour
        )}:${pad2(target.targetMinute)}`,
        enabled: true,
        createdAtMs: Date.now(),
        targetWeekday: target.targetWeekday,
        targetHour: target.targetHour,
        targetMinute: target.targetMinute,
      },
      ...prev,
    ]);
  }

  function addClothcraftGuildTimer() {
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 6,
        openMinute: 0,
        closedOn: "Firesday",
      },
      presetOffsetHours
    );

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Clothcraft Guild (offset ${presetOffsetHours}h) — ${target.targetWeekday} ${pad2(
          target.targetHour
        )}:${pad2(target.targetMinute)}`,
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
    const presets = buildTenshodoPresets();
    const rawTargets = presets.map((p) => ({
      label: p.label,
      ...nextGuildAlertTarget(now, p.schedule, presetOffsetHours),
    })) as TenshodoTarget[];
    const mergedTargets = mergeTenshodoTargets(rawTargets);

    setTimers((prev) => [
      ...mergedTargets.map((t) => ({
        id: uid(),
        kind: "VANA_WEEKDAY_TIME" as const,
        label: `${t.label} (offset ${presetOffsetHours}h) — ${t.targetWeekday} ${pad2(t.targetHour)}:${pad2(
          t.targetMinute
        )}`,
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
    const target = nextGuildAlertTarget(
      now,
      {
        openHour: 0,
        openMinute: 0,
        closedOn: null,
      },
      presetOffsetHours
    );

    setTimers((prev) => [
      {
        id: uid(),
        kind: "VANA_WEEKDAY_TIME",
        label: `Next Dig (offset ${presetOffsetHours}h) — ${target.targetWeekday} ${pad2(target.targetHour)}:${pad2(
          target.targetMinute
        )}`,
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

  function addNmTimedWindowTimer() {
    const warnLeadMs = parseDurationToMs(nmWarnLead) ?? 10_000;
    const startMs = parseDurationToMs(nmWindowStart);
    const endMs = parseDurationToMs(nmWindowEnd);
    const intervalMs = parseDurationToMs(nmWindowInterval);

    if (!Number.isFinite(startMs as number) || !Number.isFinite(endMs as number) || !Number.isFinite(intervalMs as number)) {
      alert("Invalid NM window values. Try: 2h, 2.5h, 5m, or 1:45:55");
      return;
    }

    if ((endMs as number) < (startMs as number)) {
      alert("Window end must be >= window start.");
      return;
    }

    const createdAtMs = Date.now();
    const baseEarthMsRaw = nmTodInput.trim() ? parseLocalDateTimeToMs(nmTodInput) : undefined;
    if (nmTodInput.trim() && !Number.isFinite(baseEarthMsRaw as number)) {
      alert("Invalid ToD time. Leave blank for now, or use formats like YYYY-MM-DDTHH:MM:SS or MM/DD/YYYY HH:MM:SS AM.");
      return;
    }
    const baseEarthMs = Number.isFinite(baseEarthMsRaw as number) ? (baseEarthMsRaw as number) : createdAtMs;

    setTimers((prev) => [
      {
        id: uid(),
        kind: "NM_TIMED_WINDOW",
        label: nmLabel.trim() || "NM Timer",
        enabled: true,
        createdAtMs,
        baseEarthMs,
        windowStartOffsetMs: Math.floor(startMs as number),
        windowEndOffsetMs: Math.floor(endMs as number),
        intervalMs: Math.max(1_000, Math.floor(intervalMs as number)),
        warnLeadMs: Math.max(0, Math.floor(warnLeadMs)),
      },
      ...prev,
    ]);
  }

  function addNmLotteryTimer() {
    const warnLeadMs = parseDurationToMs(nmWarnLead) ?? 10_000;
    const windowOpenMs = parseDurationToMs(nmLotteryWindowOpen);
    const phRespawnMs = parseDurationToMs(nmPhRespawn);

    if (!Number.isFinite(windowOpenMs as number) || !Number.isFinite(phRespawnMs as number)) {
      alert("Invalid Lottery NM values. Try: 1:45:55 for window, and 5m for PH.");
      return;
    }

    const createdAtMs = Date.now();
    const baseEarthMsRaw = nmTodInput.trim() ? parseLocalDateTimeToMs(nmTodInput) : undefined;
    if (nmTodInput.trim() && !Number.isFinite(baseEarthMsRaw as number)) {
      alert("Invalid ToD time. Leave blank for now, or use formats like YYYY-MM-DDTHH:MM:SS or MM/DD/YYYY HH:MM:SS AM.");
      return;
    }
    const baseEarthMs = Number.isFinite(baseEarthMsRaw as number) ? (baseEarthMsRaw as number) : createdAtMs;

    setTimers((prev) => [
      {
        id: uid(),
        kind: "NM_LOTTERY",
        label: nmLabel.trim() || "Lottery NM",
        enabled: true,
        createdAtMs,
        baseEarthMs,
        windowStartOffsetMs: Math.floor(windowOpenMs as number),
        warnLeadMs: Math.max(0, Math.floor(warnLeadMs)),
        phRespawnMs: Math.max(1_000, Math.floor(phRespawnMs as number)),
        phNextAtMs: null,
      },
      ...prev,
    ]);
  }

  function setNmTodNow() {
    setNmTodInput(new Date(Date.now()).toLocaleString());
  }

  function setNmBaseManual(id: string) {
    const raw = window.prompt(
      "Enter ToD (local). Supported: YYYY-MM-DDTHH:MM(:SS) or MM/DD/YYYY HH:MM(:SS) AM/PM",
      ""
    );
    if (raw === null) return;
    const ms = parseLocalDateTimeToMs(raw);
    if (!Number.isFinite(ms as number)) {
      alert("Invalid ToD time.");
      return;
    }

    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.kind === "NM_TIMED_WINDOW") return { ...t, baseEarthMs: ms as number, enabled: true };
        if (t.kind === "NM_LOTTERY") return { ...t, baseEarthMs: ms as number, phNextAtMs: null, enabled: true };
        return t;
      })
    );
  }

  function resetNmBaseNow(id: string) {
    const now = Date.now();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.kind === "NM_TIMED_WINDOW") return { ...t, baseEarthMs: now, enabled: true };
        if (t.kind === "NM_LOTTERY") return { ...t, baseEarthMs: now, phNextAtMs: null, enabled: true };
        return t;
      })
    );
  }

  function lotteryPhKilledNow(id: string) {
    const now = Date.now();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.kind !== "NM_LOTTERY") return t;
        return { ...t, phNextAtMs: now + t.phRespawnMs, enabled: true };
      })
    );
  }

  function lotteryClearPh(id: string) {
    setTimers((prev) => prev.map((t) => (t.id === id && t.kind === "NM_LOTTERY" ? { ...t, phNextAtMs: null } : t)));
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

      {/* NM timers */}
      <div style={styles.timersSection}>
        <section style={styles.card}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Notorious Monster timers</h3>
            <div style={styles.sub}>Timed window intervals, or lottery window + PH respawn</div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={styles.field}>
              <div style={styles.label}>Mode</div>
              <select
                style={styles.select}
                value={nmMode}
                onChange={(e) => setNmMode(e.target.value as "TIMED_WINDOW" | "LOTTERY")}
              >
                <option value="TIMED_WINDOW" style={optionBaseStyle}>
                  Timed spawn (window + interval)
                </option>
                <option value="LOTTERY" style={optionBaseStyle}>
                  Lottery (window open + PH respawn)
                </option>
              </select>
            </div>

            <div style={styles.compactRow}>
              <div style={styles.field}>
                <div style={styles.label}>Label</div>
                <input style={styles.input} value={nmLabel} onChange={(e) => setNmLabel(e.target.value)} />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Warn lead</div>
                <input
                  style={{ ...styles.input, width: 120 }}
                  value={nmWarnLead}
                  onChange={(e) => setNmWarnLead(e.target.value)}
                  placeholder="10s"
                  title="Example: 10s"
                />
                <div style={styles.sub}>Example: 10s</div>
              </div>
            </div>

            <div style={styles.field}>
              <div style={styles.label}>ToD (local)</div>
              <input
                style={styles.input}
                type="text"
                value={nmTodInput}
                onChange={(e) => setNmTodInput(e.target.value)}
                placeholder="(blank = now)  e.g. 2026-02-04T13:22:10 or 02/04/2026 01:22:10 PM"
              />
              <div style={{ marginTop: 6, ...styles.buttonRow }}>
                <button style={styles.button} onClick={setNmTodNow}>
                  Use now
                </button>
                <button style={styles.button} onClick={() => setNmTodInput("")}
                  title="Clear ToD input (will use now)">
                  Clear
                </button>
              </div>
              <div style={styles.sub}>
                Leave blank to use now. If you set a manual ToD, timers will calculate offsets from that.
              </div>
            </div>

            {nmMode === "TIMED_WINDOW" ? (
              <>
                <div style={styles.compactRow}>
                  <div style={styles.field}>
                    <div style={styles.label}>Window start</div>
                    <input
                      style={styles.input}
                      value={nmWindowStart}
                      onChange={(e) => setNmWindowStart(e.target.value)}
                      placeholder="2h"
                      title="Examples: 2h, 2.5h, 1:45:55"
                    />
                    <div style={styles.sub}>Examples: 2h, 2.5h, 1:45:55</div>
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>Window end</div>
                    <input
                      style={styles.input}
                      value={nmWindowEnd}
                      onChange={(e) => setNmWindowEnd(e.target.value)}
                      placeholder="2.5h"
                    />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>Interval</div>
                    <input
                      style={styles.input}
                      value={nmWindowInterval}
                      onChange={(e) => setNmWindowInterval(e.target.value)}
                      placeholder="5m"
                      title="Example: 5m"
                    />
                    <div style={styles.sub}>Example: 5m</div>
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  <button style={styles.buttonPrimary} onClick={addNmTimedWindowTimer}>
                    Start timed NM
                  </button>
                </div>

                <div style={styles.sub}>
                  Example: start 2h, end 2.5h, interval 5m → warns at 1:59:50 then pops at 2:00:00, 2:05:00, … 2:30:00.
                </div>
              </>
            ) : (
              <>
                <div style={styles.compactRow}>
                  <div style={styles.field}>
                    <div style={styles.label}>Window opens at</div>
                    <input
                      style={styles.input}
                      value={nmLotteryWindowOpen}
                      onChange={(e) => setNmLotteryWindowOpen(e.target.value)}
                      placeholder="1:45:55"
                      title="Examples: 1:45:55, 105m, 2h"
                    />
                    <div style={styles.sub}>Examples: 1:45:55, 105m, 2h</div>
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>PH respawn</div>
                    <input
                      style={styles.input}
                      value={nmPhRespawn}
                      onChange={(e) => setNmPhRespawn(e.target.value)}
                      placeholder="5m"
                      title="Example: 5m"
                    />
                    <div style={styles.sub}>Click "PH killed" each time you kill it.</div>
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  <button style={styles.buttonPrimary} onClick={addNmLotteryTimer}>
                    Start lottery NM
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Preset timers */}
      <div style={styles.timersSection}>
        <section style={styles.card}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Preset timers</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={styles.sub}>Offset (Vana hours):</div>
              <input
                style={{ ...styles.input, width: 72 }}
                type="number"
                min={PRESET_OFFSET_MIN}
                max={PRESET_OFFSET_MAX}
                step={1}
                value={presetOffsetHours}
                onChange={(e) => setPresetOffsetHours(clampInt(Number(e.target.value) || 0, PRESET_OFFSET_MIN, PRESET_OFFSET_MAX))}
                title="Hours before the target/open time (Vana hours)"
              />
              <div style={styles.sub}>hours before target/open</div>
              <button style={styles.button} onClick={() => setShowPresets((v) => !v)}>
                {showPresets ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {!showPresets ? (
            <div style={{ marginTop: 10, ...styles.muted }}>Hidden.</div>
          ) : (
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                alignItems: "start",
              }}
            >
              {/* Next Dig */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Next Dig</div>
                  <div style={styles.sub}>
                    Targets 00:00 → fires {pad2(nextDigPreview.targetHour)}:{pad2(nextDigPreview.targetMinute)} (offset {presetOffsetHours}h)
                  </div>
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
                  <div style={styles.sub}>
                    Opens 05:00 → fires {pad2(cookingGuildPreview.targetHour)}:{pad2(cookingGuildPreview.targetMinute)} (offset {presetOffsetHours}h), closed Darksday
                  </div>
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

              {/* Leathercraft */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Leathercraft Guild</div>
                  <div style={styles.sub}>
                    Opens 03:00–18:00 → fires {pad2(leathercraftGuildPreview.targetHour)}:{pad2(leathercraftGuildPreview.targetMinute)} (offset {presetOffsetHours}h), closed Iceday
                  </div>
                </div>

                <div style={{ marginTop: 8, ...styles.sub }}>
                  Will set:{" "}
                  <span style={weekdayStyle(leathercraftGuildPreview.targetWeekday)}>
                    {leathercraftGuildPreview.targetWeekday}
                  </span>{" "}
                  {pad2(leathercraftGuildPreview.targetHour)}:{pad2(leathercraftGuildPreview.targetMinute)}
                  <br />
                  Next: {new Date(leathercraftGuildPreview.nextAt).toLocaleString()} — In:{" "}
                  {formatCountdown(leathercraftGuildPreview.nextAt - nowMs)}
                </div>

                <div style={{ marginTop: 10, ...styles.buttonRow }}>
                  <button style={styles.buttonPrimary} onClick={addLeathercraftGuildTimer}>
                    Add Leathercraft Guild timer
                  </button>
                </div>
              </div>

              {/* Clothcraft */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Clothcraft Guild</div>
                  <div style={styles.sub}>
                    Opens 06:00–21:00 → fires {pad2(clothcraftGuildPreview.targetHour)}:{pad2(clothcraftGuildPreview.targetMinute)} (offset {presetOffsetHours}h), closed Firesday
                  </div>
                </div>

                <div style={{ marginTop: 8, ...styles.sub }}>
                  Will set:{" "}
                  <span style={weekdayStyle(clothcraftGuildPreview.targetWeekday)}>
                    {clothcraftGuildPreview.targetWeekday}
                  </span>{" "}
                  {pad2(clothcraftGuildPreview.targetHour)}:{pad2(clothcraftGuildPreview.targetMinute)}
                  <br />
                  Next: {new Date(clothcraftGuildPreview.nextAt).toLocaleString()} — In:{" "}
                  {formatCountdown(clothcraftGuildPreview.nextAt - nowMs)}
                </div>

                <div style={{ marginTop: 10, ...styles.buttonRow }}>
                  <button style={styles.buttonPrimary} onClick={addClothcraftGuildTimer}>
                    Add Clothcraft Guild timer
                  </button>
                </div>
              </div>

              {/* Tenshodo */}
              <div style={styles.subCard}>
                <div style={styles.titleRow}>
                  <div style={{ fontWeight: 800 }}>Tenshodo</div>
                  <div style={styles.sub}>Adds 2–3 timers (merged when fire time matches)</div>
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
                  Notes: Lower Jeuno closed Earthsday; Port Bastok closed Iceday; Norg closed Darksday. Offset is {presetOffsetHours}h
                  before open.
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
                let nextAt: number | null = null;

                if (t.kind === "NM_TIMED_WINDOW") {
                  const ev = getNextNmTimedWindowEvent(t, nowMs);
                  nextAt = ev?.atMs ?? null;
                } else if (t.kind === "NM_LOTTERY") {
                  const ev = getNextNmLotteryEvent(t, nowMs);
                  nextAt = ev?.atMs ?? null;
                } else {
                  nextAt =
                    t.kind === "VANA_WEEKDAY_TIME"
                      ? nextEarthMsForVanaWeekdayTime({
                          nowEarthMs: nowMs,
                          cal: cal ?? undefined,
                          targetWeekday: t.targetWeekday,
                          targetHour: t.targetHour,
                          targetMinute: t.targetMinute,
                        })
                      : t.kind === "MOON_STEP"
                        ? nextEarthMsForMoonStep({
                            nowEarthMs: nowMs,
                            cal: cal ?? undefined,
                            targetMoonStep: t.targetMoonStep,
                          })
                        : t.kind === "MOON_PERCENT"
                          ? nextEarthMsForMoonPercent({
                              nowEarthMs: nowMs,
                              cal: cal ?? undefined,
                              targetPercent: t.targetPercent,
                            })
                          : t.targetEarthMs;
                }

                const inMs = nextAt === null ? Number.POSITIVE_INFINITY : nextAt - nowMs;

                const vanaAt = nextAt === null ? now : getVanaNow(nextAt, cal ?? undefined);

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
                } else if (t.kind === "NM_TIMED_WINDOW") {
                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      NM (timed): window {formatCountdown(t.windowStartOffsetMs)} → {formatCountdown(t.windowEndOffsetMs)} every{" "}
                      {formatCountdown(t.intervalMs)}
                      <br />
                      ToD: {new Date(t.baseEarthMs).toLocaleString()}
                    </div>
                  );
                } else if (t.kind === "NM_LOTTERY") {
                  detailLine = (
                    <div style={{ marginTop: 6, opacity: 0.9 }}>
                      NM (lottery): window opens at {formatCountdown(t.windowStartOffsetMs)} — PH respawn {formatCountdown(t.phRespawnMs)}
                      <br />
                      ToD: {new Date(t.baseEarthMs).toLocaleString()}
                      {t.phNextAtMs ? (
                        <>
                          <br />
                          PH next: {new Date(t.phNextAtMs).toLocaleString()} — In: {formatCountdown(t.phNextAtMs - nowMs)}
                        </>
                      ) : null}
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
                      {nextAt === null ? (
                        <>Next: No upcoming events.</>
                      ) : (
                        <>
                          Next (Earth): {new Date(nextAt).toLocaleString()} — In: {formatCountdown(inMs)}
                          <br />
                          Next (Vana):{" "}
                          <span style={weekdayStyle(vanaAt.weekday)}>{vanaAt.weekday}</span> {pad2(vanaAt.hour)}:
                          {pad2(vanaAt.minute)}
                        </>
                      )}
                    </div>

                    <div style={styles.buttonRow}>
                      {(t.kind === "NM_TIMED_WINDOW" || t.kind === "NM_LOTTERY") && (
                        <button style={styles.button} onClick={() => resetNmBaseNow(t.id)}>
                          Set ToD now
                        </button>
                      )}

                      {(t.kind === "NM_TIMED_WINDOW" || t.kind === "NM_LOTTERY") && (
                        <button style={styles.button} onClick={() => setNmBaseManual(t.id)}>
                          Set ToD...
                        </button>
                      )}

                      {t.kind === "NM_LOTTERY" && (
                        <>
                          <button style={styles.button} onClick={() => lotteryPhKilledNow(t.id)}>
                            PH killed now
                          </button>
                          {t.phNextAtMs ? (
                            <button style={styles.button} onClick={() => lotteryClearPh(t.id)}>
                              Clear PH
                            </button>
                          ) : null}
                        </>
                      )}

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

      {/* Manual calibration */}
      <div style={styles.timersSection}>
        <section style={styles.card}>
          <div style={styles.titleRow}>
            <h3 style={styles.h3}>Manual calibration</h3>
            <button style={styles.button} onClick={() => setShowCalibration((v) => !v)}>
              {showCalibration ? "Hide" : "Show"}
            </button>
          </div>

          {!showCalibration ? (
            <div style={{ marginTop: 10, ...styles.sub }}>
              Defaults are applied automatically. Use “Show” only if you want to recalibrate.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ ...styles.sub, opacity: 0.9 }}>
                Day and Moon are calibrated separately. Saving either one overrides the default.
              </div>

              <div style={{ display: "grid", gap: 12 }}>
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

                  <div style={{ marginTop: 8, ...styles.sub }}>Stored offset (ms): {String(cal.timeOffsetMs)}</div>
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
                      Reset to defaults
                    </button>
                  </div>

                  <div style={{ marginTop: 8, ...styles.sub }}>
                    Stored New Moon Start: {new Date(cal.newMoonStartEarthMs).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
