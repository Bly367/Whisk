/** Monday-based ISO week start (YYYY-MM-DD) for meal plan lookup. */

export function startOfWeekMonday(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStart: string): string {
  const [y, m, day] = weekStart.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `Week of ${fmt(start)}–${fmt(end)}`;
}
