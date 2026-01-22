// src/utils/weekday.ts
import type { CSSProperties } from "react";
import type { VanaWeekday } from "../vanadiel";

export const WEEKDAYS: VanaWeekday[] = [
  "Firesday",
  "Earthsday",
  "Watersday",
  "Windsday",
  "Iceday",
  "Lightningday",
  "Lightsday",
  "Darksday",
];

// FFXI-ish colors 
export const WEEKDAY_COLORS: Record<VanaWeekday, string> = {
  Firesday: "#FF2D2D",
  Earthsday: "#FF9F0A",
  Watersday: "#0A84FF",
  Windsday: "#34C759",
  Iceday: "#64D2FF",
  Lightningday: "#BF5AF2",
  Lightsday: "#F2F2F7",
  Darksday: "#8E8E93",
};

export function weekdayStyle(weekday: VanaWeekday): CSSProperties {
  const color = WEEKDAY_COLORS[weekday];
  return {
    color,
    fontWeight: 900,
    // helps readability on bright colors + dark background
    textShadow: "0 1px 0 rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.35)",
  };
}
