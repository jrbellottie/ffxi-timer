export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 99) return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

// -------------------- Date parsing (LOCAL) --------------------

export function parseLocalDateTimeToMs(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  // datetime-local emits: YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const normalized = s.length === 16 ? `${s}:00` : s;
    const ms = new Date(normalized).getTime(); // local time
    if (Number.isFinite(ms)) return ms;
  }

  // Common paste: MM/DD/YYYY HH:MM:SS AM
  {
    const m = s.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
    );
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = Number(m[3]);
      let hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] ?? 0);
      const ampm = (m[7] ?? "").toUpperCase();

      if (ampm === "AM") {
        if (hour === 12) hour = 0;
      } else if (ampm === "PM") {
        if (hour !== 12) hour += 12;
      }

      const ms = new Date(year, month - 1, day, hour, minute, second, 0).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }

  // YYYY-MM-DD HH:MM:SS (space instead of T)
  {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] ?? 0);

      const ms = new Date(year, month - 1, day, hour, minute, second, 0).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }

  // Last resort
  {
    const ms = new Date(s).getTime();
    if (Number.isFinite(ms)) return ms;
  }

  return undefined;
}

export function nextOccurrenceLocal(targetMs: number, nowMs: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  let t = targetMs;
  while (t <= nowMs) t += dayMs;
  return t;
}
