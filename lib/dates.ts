/** Calendar-date helpers for `YYYY-MM-DD` values. Never add milliseconds to dates. */

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseDateOnly(isoDate);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

/** Difference between two calendar dates, independent of local DST transitions. */
export function daysBetween(startIsoDate: string, endIsoDate: string): number {
  const toCalendarDayNumber = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const adjustedYear = month <= 2 ? year - 1 : year;
    const era = Math.floor(adjustedYear / 400);
    const yearOfEra = adjustedYear - era * 400;
    const monthFromMarch = month + (month > 2 ? -3 : 9);
    const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + day - 1;
    return (
      era * 146097 +
      yearOfEra * 365 +
      Math.floor(yearOfEra / 4) -
      Math.floor(yearOfEra / 100) +
      dayOfYear
    );
  };

  return toCalendarDayNumber(endIsoDate) - toCalendarDayNumber(startIsoDate);
}

export function startOfWeekMonday(date: Date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  local.setDate(local.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateOnly(local);
}

export function formatWeekLabel(weekStart: string): string {
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${fmt(parseDateOnly(weekStart))}–${fmt(parseDateOnly(addDays(weekStart, 6)))}`;
}
