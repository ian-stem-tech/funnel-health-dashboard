import type { DataPoint } from '../components/ViewsChart';

export type TimeRange = '1d' | '7d' | '30d' | 'all';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

export function filterByDateRange<T>(
  items: T[],
  range: TimeRange,
  dateKey: keyof T,
): T[] {
  const days = RANGE_DAYS[range];
  if (days === null) return items;

  const cutoff = daysAgo(days);
  return items.filter((item) => {
    const raw = item[dateKey];
    if (!raw) return false;
    return new Date(raw as string) >= cutoff;
  });
}

export function sliceChartData(
  data: DataPoint[],
  range: TimeRange,
): DataPoint[] {
  const days = RANGE_DAYS[range];
  if (days === null) return data;

  const cutoff = daysAgo(days);
  return data.filter((d) => new Date(d.date) >= cutoff);
}

/**
 * Convert cumulative chart data into daily deltas (views gained per day).
 * Each point becomes: views = today_cumulative - yesterday_cumulative.
 *
 * Filters out points where the previous day had 0 views (tracking hadn't
 * started yet), to avoid misleading spikes when data collection begins.
 */
export function toDailyDeltas(data: DataPoint[]): DataPoint[] {
  if (data.length < 2) return [];
  const deltas: DataPoint[] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].views;
    if (prev === 0) continue;
    deltas.push({
      ...data[i],
      views: Math.max(0, data[i].views - prev),
    });
  }
  return deltas;
}
