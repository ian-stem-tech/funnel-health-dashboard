import type { HistoryEntry } from './types';

type ViewsRecord = { id: string; views: number; likes?: number; comments?: number; shares?: number; saves?: number };

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * For each content item tracked across history, compute the views GAINED
 * within each time window (1d, 7d, 30d) by diffing the earliest and latest
 * history entry in that window.
 *
 * Returns a map: id -> { views1d, views7d, views30d, likes1d, ... }
 */
export function computeContentDeltas<T extends ViewsRecord>(
  entries: HistoryEntry[],
  extractor: (entry: HistoryEntry) => T[],
  idField: keyof T = 'id' as keyof T,
): Map<string, { views1d: number; views7d: number; views30d: number; likes1d: number; likes7d: number; likes30d: number; comments1d: number; comments7d: number; comments30d: number }> {
  const cutoff1d = daysAgo(1);
  const cutoff7d = daysAgo(7);
  const cutoff30d = daysAgo(30);

  const itemHistory = new Map<string, { date: string; views: number; likes: number; comments: number }[]>();

  for (const entry of entries) {
    const items = extractor(entry);
    for (const item of items) {
      const id = String(item[idField]);
      if (!id) continue;
      let arr = itemHistory.get(id);
      if (!arr) {
        arr = [];
        itemHistory.set(id, arr);
      }
      arr.push({
        date: entry.date,
        views: item.views ?? 0,
        likes: (item.likes ?? 0),
        comments: (item.comments ?? 0),
      });
    }
  }

  const result = new Map<string, { views1d: number; views7d: number; views30d: number; likes1d: number; likes7d: number; likes30d: number; comments1d: number; comments7d: number; comments30d: number }>();

  for (const [id, records] of itemHistory) {
    records.sort((a, b) => a.date.localeCompare(b.date));
    const latest = records[records.length - 1];

    const calcDelta = (cutoff: string) => {
      const inRange = records.filter((r) => r.date >= cutoff);
      if (inRange.length === 0) return { views: 0, likes: 0, comments: 0 };
      const earliest = inRange[0];
      return {
        views: Math.max(0, latest.views - earliest.views),
        likes: Math.max(0, latest.likes - earliest.likes),
        comments: Math.max(0, latest.comments - earliest.comments),
      };
    };

    // If an item first appeared within the range, its entire count is the delta
    const firstSeen = records[0].date;
    const d1 = firstSeen >= cutoff1d ? latest : calcDelta(cutoff1d);
    const d7 = firstSeen >= cutoff7d ? latest : calcDelta(cutoff7d);
    const d30 = firstSeen >= cutoff30d ? latest : calcDelta(cutoff30d);

    result.set(id, {
      views1d: d1.views, views7d: d7.views, views30d: d30.views,
      likes1d: d1.likes, likes7d: d7.likes, likes30d: d30.likes,
      comments1d: d1.comments, comments7d: d7.comments, comments30d: d30.comments,
    });
  }

  return result;
}
