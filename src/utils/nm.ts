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
  const intervalMs = timer.intervalMs == null ? 0 : clampNonNegInt(timer.intervalMs);
  const warnLeadMs = clampNonNegInt(timer.warnLeadMs);

  if (endOffsetMs < startOffsetMs) return null;

  const startAt = baseMs + startOffsetMs;
  const endAt = baseMs + endOffsetMs;

  // Hard stop: after window ends, no more events
  if (nowMs > endAt + 60_000) return null;

  // No interval means one check at the window start only.
  const popAt =
    intervalMs > 0
      ? nextTimedWindowPopAt(nowMs, { baseMs, startOffsetMs, endOffsetMs, intervalMs })
      : nowMs <= startAt + 60_000
        ? startAt
        : Number.POSITIVE_INFINITY;

  const candidates: TimerEvent[] = [];

  if (Number.isFinite(popAt)) {
    const warnAt = Math.max(baseMs, popAt - warnLeadMs);

    // If the warning time is still ahead, schedule warning; otherwise schedule the pop.
    if (warnLeadMs > 0 && warnAt > nowMs) {
      candidates.push({
        atMs: warnAt,
        title: "Kupo",
        body: `${timer.label} — pop check in ${Math.round(warnLeadMs / 1000)}s. (click to stop)`,
        fireKey: `pop:warn:${popAt}`,
      });
    }

    if (popAt >= nowMs) {
      candidates.push({
        atMs: popAt,
        title: "Kupo",
        body: `${timer.label} — pop check NOW. (click to stop)`,
        fireKey: `pop:now:${popAt}`,
      });
    }
  }

  const closeAlreadyCovered = Number.isFinite(popAt) && popAt === endAt;
  if (!closeAlreadyCovered && nowMs <= endAt + 60_000) {
    candidates.push({
      atMs: endAt,
      title: "Kupo",
      body: `${timer.label} — spawn window is closing NOW. (click to stop)`,
      fireKey: `window:close:${endAt}`,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.atMs - b.atMs);
  return candidates[0];
}

export function getNextNmLotteryEvent(timer: NmLotteryTimer, nowMs: number): TimerEvent | null {
  const baseMs = clampNonNegInt(timer.baseEarthMs);
  const warnLeadMs = clampNonNegInt(timer.warnLeadMs);

  // Candidate events: PH (warn + now)
  const candidates: TimerEvent[] = [];

  const phAt = timer.phNextAtMs ?? null;
  if (phAt !== null && Number.isFinite(phAt)) {
    const phPopAt = clampNonNegInt(phAt);
    const phWarnAt = Math.max(baseMs, phPopAt - warnLeadMs);

    if (nowMs <= phPopAt + 60_000) {
      if (warnLeadMs > 0 && phWarnAt > nowMs) {
        candidates.push({
          atMs: phWarnAt,
          title: "Kupo",
          body: `${timer.label} — PH pops in ${Math.round(warnLeadMs / 1000)}s. (click to stop)`,
          fireKey: `ph:warn:${phPopAt}`,
        });
      }

      if (phPopAt >= nowMs) {
        candidates.push({
          atMs: phPopAt,
          title: "Kupo",
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
