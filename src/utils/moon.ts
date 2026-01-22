// src/utils/moon.ts
import type { CSSProperties } from "react";
import type { MoonDirection } from "../types";

/**
 * Moon phase color palette (FFXI-inspired, weekday-safe)
 *
 * Design goals:
 * - No clashes with weekday colors (especially Windsday green)
 * - Waxing = brighter / warmer / more “active”
 * - Waning = cooler / dimmer / receding
 * - Full Moon = brightest, silvery
 * - New Moon = dark but readable
 */

// Crescents (gold family)
export const WAXING_CRESCENT_GOLD = "#D4AF37";
export const WANING_CRESCENT_GOLD = "#B89B3C"; // darker, muted gold

// Quarters (cyan family)
export const FIRST_QUARTER_CYAN = "#4FD6FF";
export const LAST_QUARTER_CYAN = "#3BB6DB"; // slightly dimmer

// Gibbous (blue / indigo family — avoids Windsday green)
export const WAXING_GIBBOUS_INDIGO = "#6F7CFF";
export const WANING_GIBBOUS_INDIGO = "#5661C7";

// Full / New
export const FULL_MOON_SILVER = "#E9EEF5";
export const NEW_MOON_PURPLE = "#8A4BFF";

type PhaseName =
  | "New Moon"
  | "Waxing Crescent"
  | "First Quarter"
  | "Waxing Gibbous"
  | "Full Moon"
  | "Waning Gibbous"
  | "Last Quarter"
  | "Waning Crescent";

function glow(color: string, weight: number, extraGlow = false): CSSProperties {
  return {
    color,
    fontWeight: weight,
    textShadow: extraGlow
      ? "0 1px 0 rgba(0,0,0,0.65), 0 0 14px rgba(255,255,255,0.12), 0 0 10px rgba(0,0,0,0.30)"
      : "0 1px 0 rgba(0,0,0,0.60), 0 0 10px rgba(0,0,0,0.35)",
  };
}

export function moonPhaseStyle(phaseName: string): CSSProperties {
  switch (phaseName as PhaseName) {
    // 🌑 New
    case "New Moon":
      return glow(NEW_MOON_PURPLE, 900);

    // 🌒 Crescents
    case "Waxing Crescent":
      return glow(WAXING_CRESCENT_GOLD, 900);

    case "Waning Crescent":
      return {
        ...glow(WANING_CRESCENT_GOLD, 850),
        opacity: 0.95,
      };

    // 🌓 Quarters
    case "First Quarter":
      return glow(FIRST_QUARTER_CYAN, 850);

    case "Last Quarter":
      return {
        ...glow(LAST_QUARTER_CYAN, 800),
        opacity: 0.95,
      };

    // 🌔🌖 Gibbous
    case "Waxing Gibbous":
      return glow(WAXING_GIBBOUS_INDIGO, 850);

    case "Waning Gibbous":
      return {
        ...glow(WANING_GIBBOUS_INDIGO, 800),
        opacity: 0.95,
      };

    // 🌕 Full
    case "Full Moon":
      return glow(FULL_MOON_SILVER, 900, true);

    default:
      return {};
  }
}

/**
 * Direction glyphs
 * Waxing = ▲ (up)
 * Waning = ▼ (down)
 */
export function moonDirGlyph(dir: MoonDirection): string {
  return dir === "WAXING" ? "▲" : "▼";
}

/**
 * Optional style for the glyph itself (slightly smaller + spaced nicely)
 */
export function moonGlyphStyle(): CSSProperties {
  return {
    display: "inline-block",
    marginRight: 6,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.95,
    transform: "translateY(-1px)",
  };
}
