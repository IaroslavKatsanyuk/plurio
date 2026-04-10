/**
 * Stable date/time display for SSR + client (avoids React hydration #418).
 * Always use Europe/Kyiv so Node (build/SSR) and the browser match.
 */
const KYIV_TZ = "Europe/Kyiv";

/** YYYY-MM-DD for the calendar day in Kyiv (for bucketing / keys). */
export function dateKeyKyiv(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTimeKyiv(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "";
  }
  return new Date(iso).toLocaleString("uk-UA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeKyiv(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "";
  }
  return new Date(iso).toLocaleTimeString("uk-UA", {
    timeZone: KYIV_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Long-ish title for a YYYY-MM-DD key (day column headers). */
export function formatDateTitleKyivFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return ymd;
  }
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return anchor.toLocaleDateString("uk-UA", {
    timeZone: KYIV_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDayKyivFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return ymd;
  }
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return anchor.toLocaleDateString("uk-UA", {
    timeZone: KYIV_TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

const KYIV_WEEKDAY_MON0: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function kyivWeekdayMon0(iso: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: KYIV_TZ,
    weekday: "short",
  }).format(new Date(iso));
  return KYIV_WEEKDAY_MON0[short] ?? 0;
}

/** Add calendar days to a Kyiv YYYY-MM-DD key (approximate; noon UTC stepping). */
export function addDaysToYmdKey(ymdKey: string, deltaDays: number): string {
  const [y, m, d] = ymdKey.split("-").map(Number);
  if (!y || !m || !d) {
    return ymdKey;
  }
  const next = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return dateKeyKyiv(next.toISOString());
}

/** Monday (Kyiv calendar) of the week that contains this instant, as YYYY-MM-DD. */
export function mondayKyivDateKey(iso: string): string {
  const key = dateKeyKyiv(iso);
  if (!key) {
    return "";
  }
  const dow = kyivWeekdayMon0(iso);
  return addDaysToYmdKey(key, -dow);
}
