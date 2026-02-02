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
  prepLeadHours?: number; // default 1
};

function isBefore(h1: number, m1: number, h2: number, m2: number) {
  return h1 < h2 || (h1 === h2 && m1 < m2);
}

/**
 * Generic:
 * - compute "prep time" = open time minus prepLeadHours
 * - schedule the next occurrence of that prep time
 * - skip "closedOn" weekdays entirely (if provided)
 *
 * Rules:
 * - If today is NOT closed and it's still before prep time, use today at prep time.
 * - Otherwise advance day-by-day to the next non-closed weekday, and schedule prep time.
 */
export function nextGuildPrepTarget(now: VanaNowLite, schedule: GuildSchedule): PrepTarget {
  const openMinute = schedule.openMinute ?? 0;
  const prepLead = schedule.prepLeadHours ?? 1;
  const closedOn = schedule.closedOn ?? null;

  // Prep time is open time minus prepLeadHours, with wrap if needed.
  // (You can extend to minutes later if needed.)
  let prepHour = schedule.openHour - prepLead;
  const prepMinute = openMinute;

  if (prepHour < 0) prepHour += 24;

  const nowDayIndex = WEEKDAYS.indexOf(now.weekday);

  const todayClosed = closedOn ? now.weekday === closedOn : false;
  const beforePrep = isBefore(now.hour, now.minute, prepHour, prepMinute);

  let dayIndex = nowDayIndex;

  // If today is closed OR we already passed prep time, start from tomorrow.
  if (todayClosed || !beforePrep) {
    dayIndex = mod(nowDayIndex + 1, WEEKDAYS.length);
  }

  // Skip closedOn day(s)
  while (closedOn && WEEKDAYS[dayIndex] === closedOn) {
    dayIndex = mod(dayIndex + 1, WEEKDAYS.length);
  }

  return {
    targetWeekday: WEEKDAYS[dayIndex],
    targetHour: prepHour,
    targetMinute: prepMinute,
  };
}

/**
 * Cooking Guild:
 * - opens 05:00
 * - prep timer 1 hour earlier => 04:00
 * - closed on Darksday
 */
export function nextCookingGuildPrepTarget(now: VanaNowLite): PrepTarget {
  return nextGuildPrepTarget(now, {
    openHour: 5,
    openMinute: 0,
    prepLeadHours: 1,
    closedOn: "Darksday",
  });
}

/**
 * Leathercraft Guild:
 * - opens 03:00
 * - prep timer 2 hours earlier => 01:00
 * - closed on Iceday
 */
export function nextLeathercraftGuildPrepTarget(now: VanaNowLite): PrepTarget {
  return nextGuildPrepTarget(now, {
    openHour: 3,
    openMinute: 0,
    prepLeadHours: 2,
    closedOn: "Iceday",
  });
}

/**
 * Clothcraft Guild:
 * - opens 06:00
 * - prep timer 2 hours earlier => 04:00
 * - closed on Firesday
 */
export function nextClothcraftGuildPrepTarget(now: VanaNowLite): PrepTarget {
  return nextGuildPrepTarget(now, {
    openHour: 6,
    openMinute: 0,
    prepLeadHours: 2,
    closedOn: "Firesday",
  });
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
    schedule: { openHour: 1, openMinute: 0, prepLeadHours: 1, closedOn: "Earthsday" },
  },
  {
    name: "Port Bastok",
    schedule: { openHour: 1, openMinute: 0, prepLeadHours: 1, closedOn: "Iceday" },
  },
  {
    name: "Norg",
    schedule: { openHour: 9, openMinute: 0, prepLeadHours: 1, closedOn: "Darksday" },
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
      `prep:${s.prepLeadHours ?? 1}`,
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
    ...nextGuildPrepTarget(now, p.schedule),
  }));
}
