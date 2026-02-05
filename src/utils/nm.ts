import type { AnyTimer, NmLotteryTimer, NmTimedWindowTimer } from "../types";

export type TimerEvent = {
  atMs: number;
  title: string;
  body: string;
  /** Stable key to de-dupe notifications per timer+event. */
  fireKey: string;
  /** Optional hint for the caller to update timer state after firing. */
  action?: { type: "NM_LOTTERY_CLEAR_PH" };
};

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function nextTimedWindowPopAt(nowMs: number, args: { baseMs: number; startOffsetMs: number; endOffsetMs: number; intervalMs: number }): number {
  const startAt = args.baseMs + args.startOffsetMs;
  const endAt = args.baseMs + args.endOffsetMs;
  const interval = Math.max(1, args.intervalMs);

  if (nowMs <= startAt) return startAt;

  const stepsSinceStart = Math.floor((nowMs - startAt) / interval);
  let t = startAt + stepsSinceStart * interval;
  if (t < nowMs) t += interval;
  if (t < startAt) t = startAt;
  if (t > endAt) return Number.POSITIVE_INFINITY;
  return t;
}

export function getNextTimerEvent(timer: AnyTimer, nowMs: number): TimerEvent | null {
  if (!timer.enabled) return null;

  if (timer.kind === "NM_TIMED_WINDOW") {
    return getNextNmTimedWindowEvent(timer, nowMs);
  }

  if (timer.kind === "NM_LOTTERY") {
    return getNextNmLotteryEvent(timer, nowMs);
  }

  // Other kinds are handled by caller (Vana/Moon/Earth)
  return null;
}

export function getNextNmTimedWindowEvent(timer: NmTimedWindowTimer, nowMs: number): TimerEvent | null {
  const baseMs = clampNonNegInt(timer.baseEarthMs);
  const startOffsetMs = clampNonNegInt(timer.windowStartOffsetMs);
  const endOffsetMs = clampNonNegInt(timer.windowEndOffsetMs);
  const intervalMs = clampNonNegInt(timer.intervalMs);
  const warnLeadMs = clampNonNegInt(timer.warnLeadMs);

  if (endOffsetMs < startOffsetMs) return null;
  if (intervalMs <= 0) return null;

  const endAt = baseMs + endOffsetMs;

  // Hard stop: after window ends, no more events
  if (nowMs > endAt + 60_000) return null;

  const popAt = nextTimedWindowPopAt(nowMs, { baseMs, startOffsetMs, endOffsetMs, intervalMs });
  if (!Number.isFinite(popAt)) return null;

  const warnAt = Math.max(baseMs, popAt - warnLeadMs);

  // If the warning time is still ahead, schedule warning; otherwise schedule the pop.
  if (warnLeadMs > 0 && warnAt > nowMs) {
    return {
      atMs: warnAt,
      title: "FFXI Timer",
      body: `${timer.label} — pop check in ${Math.round(warnLeadMs / 1000)}s. (click to stop)`,
      fireKey: `pop:warn:${popAt}`,
    };
  }

  return {
    atMs: popAt,
    title: "FFXI Timer",
    body: `${timer.label} — pop check NOW. (click to stop)`,
    fireKey: `pop:now:${popAt}`,
  };
}

export function getNextNmLotteryEvent(timer: NmLotteryTimer, nowMs: number): TimerEvent | null {
  const baseMs = clampNonNegInt(timer.baseEarthMs);
  const windowStartOffsetMs = clampNonNegInt(timer.windowStartOffsetMs);
  const warnLeadMs = clampNonNegInt(timer.warnLeadMs);

  const windowOpenAt = baseMs + windowStartOffsetMs;
  const windowWarnAt = Math.max(baseMs, windowOpenAt - warnLeadMs);

  // Candidate events: window open (warn + now), and PH (warn + now)
  const candidates: TimerEvent[] = [];

  // Only include window-open events while they're still relevant
  if (nowMs <= windowOpenAt + 60_000) {
    if (warnLeadMs > 0 && windowWarnAt > nowMs) {
      candidates.push({
        atMs: windowWarnAt,
        title: "FFXI Timer",
        body: `${timer.label} — window opens in ${Math.round(warnLeadMs / 1000)}s. (click to stop)`,
        fireKey: `window:warn:${windowOpenAt}`,
      });
    }

    if (windowOpenAt >= nowMs) {
      candidates.push({
        atMs: windowOpenAt,
        title: "FFXI Timer",
        body: `${timer.label} — WINDOW OPEN. (click to stop)`,
        fireKey: `window:open:${windowOpenAt}`,
      });
    }
  }

  const phAt = timer.phNextAtMs ?? null;
  if (phAt !== null && Number.isFinite(phAt)) {
    const phPopAt = clampNonNegInt(phAt);
    const phWarnAt = Math.max(baseMs, phPopAt - warnLeadMs);

    if (nowMs <= phPopAt + 60_000) {
      if (warnLeadMs > 0 && phWarnAt > nowMs) {
        candidates.push({
          atMs: phWarnAt,
          title: "FFXI Timer",
          body: `${timer.label} — PH pops in ${Math.round(warnLeadMs / 1000)}s. (click to stop)`,
          fireKey: `ph:warn:${phPopAt}`,
        });
      }

      if (phPopAt >= nowMs) {
        candidates.push({
          atMs: phPopAt,
          title: "FFXI Timer",
          body: `${timer.label} — PH POP NOW. (click to stop)`,
          fireKey: `ph:pop:${phPopAt}`,
          action: { type: "NM_LOTTERY_CLEAR_PH" },
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.atMs - b.atMs);
  return candidates[0];
}
