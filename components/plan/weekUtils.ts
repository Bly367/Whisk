/** Monday-based week helpers for meal plans (`YYYY-MM-DD`). */

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse `YYYY-MM-DD` as a local calendar date (not UTC midnight). */
export function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Week starts on Monday (ISO-style). */
export function startOfWeek(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toDateOnly(d);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseDateOnly(isoDate);
  d.setTime(d.getTime() + days * DAY_MS);
  return toDateOnly(d);
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7);
}

export type WeekDay = {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
};

const WEEKDAY_LONG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function weekDays(weekStart: string, today: Date = new Date()): WeekDay[] {
  const todayIso = toDateOnly(today);
  return WEEKDAY_LONG.map((shortLabel, index) => {
    const date = addDays(weekStart, index);
    const d = parseDateOnly(date);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return {
      date,
      label,
      shortLabel,
      isToday: date === todayIso,
    };
  });
}

export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const startDate = parseDateOnly(weekStart);
  const endDate = parseDateOnly(end);
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}
