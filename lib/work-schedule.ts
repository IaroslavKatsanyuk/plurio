/**
 * Weekly work schedule for booking: local wall time in owner's booking_timezone.
 * JSON shape in DB: { "mon": [{ "start": "09:00", "end": "18:00" }], ... }
 */

export const DEFAULT_BOOKING_TIMEZONE = "Europe/Kyiv";

export const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type DayInterval = { start: string; end: string };

export type WorkWeeklySchedule = Record<WeekdayKey, DayInterval[]>;

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const LEGACY_DAY: DayInterval[] = [{ start: "08:00", end: "21:00" }];

export function legacyDefaultSchedule(): WorkWeeklySchedule {
  return {
    mon: [...LEGACY_DAY],
    tue: [...LEGACY_DAY],
    wed: [...LEGACY_DAY],
    thu: [...LEGACY_DAY],
    fri: [...LEGACY_DAY],
    sat: [...LEGACY_DAY],
    sun: [...LEGACY_DAY],
  };
}

export function normalizeProfileWeeklySchedule(
  raw: unknown | null | undefined,
): WorkWeeklySchedule {
  if (raw == null) {
    return legacyDefaultSchedule();
  }
  const parsed = parseWorkWeeklySchedule(raw);
  return parsed ?? legacyDefaultSchedule();
}

export function isValidIanaTimezone(tz: string): boolean {
  const t = tz.trim();
  if (!t) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseHmToMinutes(hm: string): number | null {
  const s = hm.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function intervalToMinutesPair(
  interval: DayInterval,
): { a: number; b: number } | null {
  const start = parseHmToMinutes(interval.start);
  const end = parseHmToMinutes(interval.end);
  if (start == null || end == null) return null;
  if (end <= start) return null;
  return { a: start, b: end };
}

function isValidDayIntervals(list: unknown): list is DayInterval[] {
  if (!Array.isArray(list)) return false;
  for (const item of list) {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    if (typeof o.start !== "string" || typeof o.end !== "string") return false;
    if (intervalToMinutesPair({ start: o.start, end: o.end }) == null) {
      return false;
    }
  }
  return true;
}

export function parseWorkWeeklySchedule(raw: unknown): WorkWeeklySchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<WorkWeeklySchedule> = {};
  for (const key of WEEKDAY_KEYS) {
    const v = o[key];
    if (v === undefined) return null;
    if (!isValidDayIntervals(v)) return null;
    out[key] = v as DayInterval[];
  }
  return out as WorkWeeklySchedule;
}

export type DayScheduleInput = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WeeklyScheduleFormInput = Record<WeekdayKey, DayScheduleInput>;

export function weeklyFormToSchedule(form: WeeklyScheduleFormInput): WorkWeeklySchedule {
  const out: Partial<WorkWeeklySchedule> = {};
  for (const key of WEEKDAY_KEYS) {
    const d = form[key];
    if (!d.enabled) {
      out[key] = [];
      continue;
    }
    const pair = intervalToMinutesPair({ start: d.start, end: d.end });
    out[key] = pair ? [{ start: d.start.trim(), end: d.end.trim() }] : [];
  }
  return out as WorkWeeklySchedule;
}

export function scheduleToWeeklyForm(
  schedule: WorkWeeklySchedule,
): WeeklyScheduleFormInput {
  const out: Partial<WeeklyScheduleFormInput> = {};
  for (const key of WEEKDAY_KEYS) {
    const segs = schedule[key];
    const first = segs[0];
    if (!first) {
      out[key] = { enabled: false, start: "09:00", end: "18:00" };
    } else {
      out[key] = {
        enabled: true,
        start: first.start,
        end: first.end,
      };
    }
  }
  return out as WeeklyScheduleFormInput;
}

function getZonedYmdHm(
  instant: Date,
  tz: string,
): { y: number; m: number; d: number; minutes: number; weekday: WeekdayKey } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const wd = get("weekday");
  const weekday = wd ? WEEKDAY_FROM_SHORT[wd] : undefined;
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !weekday
  ) {
    throw new Error("Invalid zoned date parts");
  }
  return { y, m, d, minutes: hour * 60 + minute, weekday };
}

/**
 * Full appointment range must lie on one local calendar day and inside one schedule segment.
 */
export function isAppointmentWithinWorkSchedule(
  startsAtIso: string,
  endsAtIso: string,
  tz: string,
  schedule: WorkWeeklySchedule,
): boolean {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return false;
  }
  if (end <= start) return false;

  let zs: ReturnType<typeof getZonedYmdHm>;
  let ze: ReturnType<typeof getZonedYmdHm>;
  try {
    zs = getZonedYmdHm(start, tz);
    ze = getZonedYmdHm(end, tz);
  } catch {
    return false;
  }

  if (zs.y !== ze.y || zs.m !== ze.m || zs.d !== ze.d) {
    return false;
  }

  const startMin = zs.minutes;
  const endMin = ze.minutes;
  if (endMin <= startMin) return false;

  const daySegs = schedule[zs.weekday];
  for (const seg of daySegs) {
    const pair = intervalToMinutesPair(seg);
    if (!pair) continue;
    if (startMin >= pair.a && endMin <= pair.b) {
      return true;
    }
  }
  return false;
}

export function getWeekdayKeyAtUtcMs(utcMs: number, tz: string): WeekdayKey | null {
  try {
    return getZonedYmdHm(new Date(utcMs), tz).weekday;
  } catch {
    return null;
  }
}

export function computeSlotStartsForWorkDay(params: {
  dayStartUtcMs: number;
  durationMs: number;
  busy: Array<{ s: number; e: number }>;
  schedule: WorkWeeklySchedule;
  weekday: WeekdayKey;
  slotStepMinutes: number;
  nowUtcMs: number;
}): number[] {
  const {
    dayStartUtcMs,
    durationMs,
    busy,
    schedule,
    weekday,
    slotStepMinutes,
    nowUtcMs,
  } = params;
  const stepMs = slotStepMinutes * 60 * 1000;
  const segments = schedule[weekday];
  const starts: number[] = [];

  for (const seg of segments) {
    const pair = intervalToMinutesPair(seg);
    if (!pair) continue;
    const segOpen = dayStartUtcMs + pair.a * 60 * 1000;
    const segClose = dayStartUtcMs + pair.b * 60 * 1000;
    let t = segOpen;
    while (t < nowUtcMs && t + durationMs <= segClose) {
      t += stepMs;
    }
    for (; t + durationMs <= segClose; t += stepMs) {
      const slotEnd = t + durationMs;
      let collides = false;
      for (const b of busy) {
        if (t < b.e && slotEnd > b.s) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        starts.push(t);
      }
    }
  }

  return starts.sort((a, b) => a - b);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Поточна календарна дата у зоні tz. */
export function zonedTodayYmd(tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function yearMonthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function addCalendarMonths(
  y: number,
  m: number,
  delta: number,
): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const BOOKING_MONTH_SPAN = 3;

export function nextThreeZonedYearMonths(tz: string): string[] {
  const { y, m } = zonedTodayYmd(tz);
  const out: string[] = [];
  for (let i = 0; i < BOOKING_MONTH_SPAN; i += 1) {
    const nm = addCalendarMonths(y, m, i);
    out.push(yearMonthKey(nm.y, nm.m));
  }
  return out;
}

/**
 * UTC-мить початку календарного дня 00:00:00 у зоні tz (з урахуванням DST).
 */
export function zonedWallMidnightUtcMs(
  year: number,
  month: number,
  day: number,
  tz: string,
): number {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let t = Date.UTC(year, month - 1, day - 1, 10, 0, 0);
  const limit = t + 4 * DAY_MS;
  for (; t < limit; t += 60 * 1000) {
    const parts = dtf.formatToParts(new Date(t));
    const py = Number(parts.find((p) => p.type === "year")?.value);
    const pm = Number(parts.find((p) => p.type === "month")?.value);
    const pd = Number(parts.find((p) => p.type === "day")?.value);
    if (py !== year || pm !== month || pd !== day) continue;
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const min = Number(parts.find((p) => p.type === "minute")?.value);
    const s = Number(parts.find((p) => p.type === "second")?.value);
    if (h === 0 && min === 0 && s === 0) return t;
  }
  return Date.UTC(year, month - 1, day);
}

export function zonedThreeMonthBusyRangeUtc(tz: string): {
  startMs: number;
  endMs: number;
} {
  const { y, m } = zonedTodayYmd(tz);
  const startMs = zonedWallMidnightUtcMs(y, m, 1, tz);
  const lastMonth = addCalendarMonths(y, m, BOOKING_MONTH_SPAN - 1);
  const dim = daysInMonth(lastMonth.y, lastMonth.m);
  const endMs = zonedWallMidnightUtcMs(lastMonth.y, lastMonth.m, dim, tz) + DAY_MS;
  return { startMs, endMs };
}

export function hasAnyBookableSlotInZonedBookingMonths(params: {
  tz: string;
  durationMs: number;
  busy: Array<{ s: number; e: number }>;
  schedule: WorkWeeklySchedule;
  slotStepMinutes: number;
  nowUtcMs: number;
}): boolean {
  const { tz, durationMs, busy, schedule, slotStepMinutes, nowUtcMs } = params;
  const months = nextThreeZonedYearMonths(tz);
  const today = zonedTodayYmd(tz);
  for (const ym of months) {
    const [ys, ms] = ym.split("-").map(Number);
    const dim = daysInMonth(ys, ms);
    const startDay = ym === yearMonthKey(today.y, today.m) ? today.d : 1;
    for (let day = startDay; day <= dim; day += 1) {
      const dayStartMs = zonedWallMidnightUtcMs(ys, ms, day, tz);
      const weekday = getWeekdayKeyAtUtcMs(dayStartMs, tz);
      if (!weekday) continue;
      const slots = computeSlotStartsForWorkDay({
        dayStartUtcMs: dayStartMs,
        durationMs,
        busy,
        schedule,
        weekday,
        slotStepMinutes,
        nowUtcMs,
      });
      if (slots.length > 0) return true;
    }
  }
  return false;
}
