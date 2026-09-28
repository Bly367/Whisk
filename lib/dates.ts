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
