'use client';

import { useMemo, useState } from 'react';
import { formatNumber } from '../lib/types';

type ContentItem = {
  id: string;
  thumbnail?: string;
  views: number;
  url: string;
  firstSeen: string;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  title?: string;
};

type Props = {
  items: ContentItem[];
  idLabel?: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
};

type SortField = 'views' | 'firstSeen' | 'id' | 'likes' | 'comments';
type SortDir = 'asc' | 'desc';

export function ContentTable({ items, idLabel = 'ID', platform }: Props) {
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minViews, setMinViews] = useState('');

  const hasLikes = items.some((i) => (i.likes ?? 0) > 0);
  const hasComments = items.some((i) => (i.comments ?? 0) > 0);
  const hasShares = items.some((i) => (i.shares ?? 0) > 0);
  const hasSaves = items.some((i) => (i.saves ?? 0) > 0);

  const filtered = useMemo(() => {
    const threshold = parseInt(minViews, 10);
    if (!isNaN(threshold) && threshold > 0) {
      return items.filter((item) => item.views >= threshold);
    }
    return items;
  }, [items, minViews]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'views') cmp = a.views - b.views;
      else if (sortField === 'likes') cmp = (a.likes ?? 0) - (b.likes ?? 0);
      else if (sortField === 'comments') cmp = (a.comments ?? 0) - (b.comments ?? 0);
      else if (sortField === 'firstSeen') cmp = a.firstSeen.localeCompare(b.firstSeen);
      else cmp = a.id.localeCompare(b.id);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const contentLabel =
    platform === 'instagram' ? 'reels' :
    platform === 'youtube' ? 'videos' : 'videos';

  if (items.length === 0) {
    return (
      <div className="content-table-empty">
        No content data collected yet. Data accumulates with each daily refresh.
      </div>
    );
  }

  return (
    <div className="content-table-wrap">
      <div className="content-table-filter">
        <label htmlFor="min-views-filter">Min views:</label>
        <input
          id="min-views-filter"
          type="number"
          placeholder="e.g. 1000"
          value={minViews}
          onChange={(e) => setMinViews(e.target.value)}
        />
        <span className="content-table-count">
          {sorted.length} of {items.length} {contentLabel}
        </span>
      </div>

      <div className="content-table-scroll">
        <table className="content-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th className="sortable" onClick={() => handleSort('id')}>
                {idLabel}{sortIndicator('id')}
              </th>
              <th className="sortable" onClick={() => handleSort('views')}>
                Views{sortIndicator('views')}
              </th>
              {hasLikes && (
                <th className="sortable" onClick={() => handleSort('likes')}>
                  Likes{sortIndicator('likes')}
                </th>
              )}
              {hasComments && (
                <th className="sortable" onClick={() => handleSort('comments')}>
                  Comments{sortIndicator('comments')}
                </th>
              )}
              {hasShares && <th>Shares</th>}
              {hasSaves && <th>Saves</th>}
              <th className="sortable" onClick={() => handleSort('firstSeen')}>
                First seen{sortIndicator('firstSeen')}
              </th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id}>
                <td className="content-table-thumb-cell">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={`${platform} ${item.id}`}
                      className="content-table-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <div className="content-table-thumb-placeholder">--</div>
                  )}
                </td>
                <td className="content-table-id">{item.title || item.id}</td>
                <td className="content-table-views">{formatNumber(item.views)}</td>
                {hasLikes && (
                  <td className="content-table-views">{formatNumber(item.likes ?? 0)}</td>
                )}
                {hasComments && (
                  <td className="content-table-views">{formatNumber(item.comments ?? 0)}</td>
                )}
                {hasShares && (
                  <td className="content-table-views">{formatNumber(item.shares ?? 0)}</td>
                )}
                {hasSaves && (
                  <td className="content-table-views">{formatNumber(item.saves ?? 0)}</td>
                )}
                <td className="content-table-date">{item.firstSeen}</td>
                <td>
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="content-table-link">
                    Open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
