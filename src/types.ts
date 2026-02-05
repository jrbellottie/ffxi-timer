import type { VanaWeekday } from "./vanadiel";

export type TimerKind =
  | "VANA_WEEKDAY_TIME"
  | "MOON_STEP"
  | "MOON_PERCENT"
  | "EARTH_TIME"
  | "NM_TIMED_WINDOW"
  | "NM_LOTTERY";

export type BaseTimer = {
  id: string;
  label: string;
  kind: TimerKind;
  enabled: boolean;
  createdAtMs: number;
};

export type WeekdayTimer = BaseTimer & {
  kind: "VANA_WEEKDAY_TIME";
  targetWeekday: VanaWeekday;
  targetHour: number;
  targetMinute: number;
};

export type MoonStepTimer = BaseTimer & {
  kind: "MOON_STEP";
  targetMoonStep: number; // 0..199 (display step)
};

export type MoonPercentTimer = BaseTimer & {
  kind: "MOON_PERCENT";
  targetPercent: number; // legacy only
};

export type EarthTimer = BaseTimer & {
  kind: "EARTH_TIME";
  targetEarthMs: number;
  rawInput: string;
};

export type NmTimedWindowTimer = BaseTimer & {
  kind: "NM_TIMED_WINDOW";
  baseEarthMs: number;
  windowStartOffsetMs: number;
  windowEndOffsetMs: number;
  intervalMs: number;
  warnLeadMs: number;
};

export type NmLotteryTimer = BaseTimer & {
  kind: "NM_LOTTERY";
  baseEarthMs: number;
  windowStartOffsetMs: number;
  warnLeadMs: number;
  phRespawnMs: number;
  phNextAtMs: number | null;
};

export type AnyTimer = WeekdayTimer | MoonStepTimer | MoonPercentTimer | EarthTimer | NmTimedWindowTimer | NmLotteryTimer;

export type MoonDirection = "WAXING" | "WANING";
