// src/utils/guilds.ts
import { VanaWeekday } from "../vanadiel";
import { WEEKDAYS } from "./weekday";

function mod(n: number, m: number): number {
  const r = n % m;
  return r < 0 ? r + m : r;
}

export type VanaNowLite = {
  weekday: VanaWeekday;
  hour: number;
  minute: number;
};

export type PrepTarget = {
  targetWeekday: VanaWeekday;
  targetHour: number;
  targetMinute: number;
};

export type GuildSchedule = {
  openHour: number; // 0..23
  openMinute?: number; // default 0
  closedOn?: VanaWeekday | null; // holiday weekday closure, optional
};

export function nextGuildAlertTarget(now: VanaNowLite, schedule: GuildSchedule, offsetHours: number): PrepTarget {
  const openMinute = schedule.openMinute ?? 0;
  const closedOn = schedule.closedOn ?? null;

  const offset = Math.max(0, Math.min(23, Math.floor(Number.isFinite(offsetHours) ? offsetHours : 0)));
  const offsetMinutes = offset * 60;

  const weekMinutes = WEEKDAYS.length * 24 * 60; // 8 * 1440
  const nowDayIndex = WEEKDAYS.indexOf(now.weekday);
  const nowAbsMinutes = nowDayIndex * 24 * 60 + now.hour * 60 + now.minute;

  let bestFireAbsMinutes = Number.POSITIVE_INFINITY;

  // Consider the next occurrence of "open" for each weekday (within the next week).
  // Pick the earliest *fire* time in the future.
  for (const d of WEEKDAYS) {
    if (closedOn && d === closedOn) continue;

    const dayIndex = WEEKDAYS.indexOf(d);
    let openAbsMinutes = dayIndex * 24 * 60 + schedule.openHour * 60 + openMinute;

    // Ensure this open is in the future (else it refers to next week's same weekday).
    if (openAbsMinutes <= nowAbsMinutes) openAbsMinutes += weekMinutes;

    let fireAbsMinutes = openAbsMinutes - offsetMinutes;

    // If we're already past the ideal alert time, but not past open, fire at open.
    if (fireAbsMinutes <= nowAbsMinutes) fireAbsMinutes = openAbsMinutes;

    if (fireAbsMinutes < bestFireAbsMinutes) bestFireAbsMinutes = fireAbsMinutes;
  }

  // Fallback: if offset is extremely large or the loop found nothing (should be rare),
  // schedule the earliest possible fire by taking the next open and subtracting.
  if (!Number.isFinite(bestFireAbsMinutes)) {
    for (const d of WEEKDAYS) {
      if (closedOn && d === closedOn) continue;
      const dayIndex = WEEKDAYS.indexOf(d);
      let openAbsMinutes = dayIndex * 24 * 60 + schedule.openHour * 60 + openMinute;
      if (openAbsMinutes <= nowAbsMinutes) openAbsMinutes += weekMinutes;
      let fireAbsMinutes = openAbsMinutes - offsetMinutes;
      if (fireAbsMinutes <= nowAbsMinutes) fireAbsMinutes = openAbsMinutes;
      if (fireAbsMinutes < bestFireAbsMinutes) bestFireAbsMinutes = fireAbsMinutes;
    }
  }

  const normalized = mod(bestFireAbsMinutes, weekMinutes);
  const targetDayIndex = Math.floor(normalized / (24 * 60));
  const dayMinutes = normalized % (24 * 60);
  const targetHour = Math.floor(dayMinutes / 60);
  const targetMinute = dayMinutes % 60;

  return {
    targetWeekday: WEEKDAYS[targetDayIndex],
    targetHour,
    targetMinute,
  };
}

/**
 * Cooking Guild:
 * - opens 05:00
 * - closed on Darksday
 */
export function nextCookingGuildPrepTarget(now: VanaNowLite): PrepTarget {
  return nextGuildAlertTarget(
    now,
    {
      openHour: 5,
      openMinute: 0,
      closedOn: "Darksday",
    },
    1
  );
}

/**
 * Leathercraft Guild:
 * - opens 03:00
 * - closed on Iceday
 */
export function nextLeathercraftGuildPrepTarget(now: VanaNowLite): PrepTarget {
  return nextGuildAlertTarget(
    now,
    {
      openHour: 3,
      openMinute: 0,
      closedOn: "Iceday",
    },
    2
  );
}

/**
 * Clothcraft Guild:
 * - opens 06:00
 * - closed on Firesday
 */
export function nextClothcraftGuildPrepTarget(now: VanaNowLite): PrepTarget {
  // Back-compat default: 1 hour before open
  return nextGuildAlertTarget(
    now,
    {
      openHour: 6,
      openMinute: 0,
      closedOn: "Firesday",
    },
    1
  );
}

// ---------- Tenshodo ----------

export type TenshodoPreset = {
  id: "TENSHODO";
  label: string; // merged label for UI/timers
  schedule: GuildSchedule;
  locations: string[];
};

type TenshodoLocation = {
  name: string;
  schedule: GuildSchedule;
};

const TENSHODO_LOCATIONS: TenshodoLocation[] = [
  {
    name: "Lower Jeuno",
    schedule: { openHour: 1, openMinute: 0, closedOn: "Earthsday" },
  },
  {
    name: "Port Bastok",
    schedule: { openHour: 1, openMinute: 0, closedOn: "Iceday" },
  },
  {
    name: "Norg",
    schedule: { openHour: 9, openMinute: 0, closedOn: "Darksday" },
  },
];

/**
 * Merge locations iff they share the *same* open time + holiday (closedOn) + prepLead.
 */
export function buildTenshodoPresets(): TenshodoPreset[] {
  const groups = new Map<
    string,
    {
      schedule: GuildSchedule;
      locations: string[];
    }
  >();

  for (const loc of TENSHODO_LOCATIONS) {
    const s = loc.schedule;
    const key = [
      `open:${s.openHour}:${s.openMinute ?? 0}`,
      `closed:${s.closedOn ?? "none"}`,
    ].join("|");

    const existing = groups.get(key);
    if (existing) {
      existing.locations.push(loc.name);
    } else {
      groups.set(key, { schedule: s, locations: [loc.name] });
    }
  }

  const presets: TenshodoPreset[] = [];
  for (const [, g] of groups) {
    const locLabel = g.locations.join(" + ");
    const closed = g.schedule.closedOn ? ` (closed ${g.schedule.closedOn})` : "";
    presets.push({
      id: "TENSHODO",
      label: `Tenshodo — ${locLabel}${closed}`,
      schedule: g.schedule,
      locations: g.locations,
    });
  }

  // Keep a stable order: Jeuno/Bastok first (open 1), then Norg (open 9)
  presets.sort((a, b) => (a.schedule.openHour ?? 0) - (b.schedule.openHour ?? 0));
  return presets;
}

export function nextTenshodoPrepTargets(now: VanaNowLite): Array<{ label: string } & PrepTarget> {
  const presets = buildTenshodoPresets();
  return presets.map((p) => ({
    label: p.label,
    ...nextGuildAlertTarget(now, p.schedule, 1),
  }));
}
