/** Monday-based week helpers for meal plans (`YYYY-MM-DD`). */

import { addDays, parseDateOnly, startOfWeekMonday, toDateOnly } from '@/lib/dates';

export { addDays, parseDateOnly, toDateOnly } from '@/lib/dates';

/** Week starts on Monday (ISO-style). */
export function startOfWeek(date: Date = new Date()): string {
  return startOfWeekMonday(date);
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
