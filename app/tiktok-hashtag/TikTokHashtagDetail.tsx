'use client';

import { useState } from 'react';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { filterByDateRange, type TimeRange } from '../lib/dateFilter';
import { formatNumber } from '../lib/types';

type VideoItem = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
  likes?: number;
  comments?: number;
  shares?: number;
  title?: string;
  author?: string;
  createdAt?: string;
};

type Props = {
  videos: VideoItem[];
  hashtags: string[];
};

export function TikTokHashtagDetail({ videos, hashtags }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const filteredVideos = filterByDateRange(videos, range, 'createdAt');
  const hashtagLabel = hashtags.map((h) => `#${h}`).join(', ');

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard
        title={`${hashtagLabel} Videos`}
        subtitle={range === 'all' ? `${videos.length} tracked` : `${filteredVideos.length} of ${videos.length} videos`}
        iconLetter="TT"
      >
        {filteredVideos.length === 0 ? (
          <div className="content-table-empty">
            No hashtag data collected yet. Data accumulates with each daily refresh.
          </div>
        ) : (
          <div className="content-table-scroll">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((video) => (
                  <tr key={video.id}>
                    <td className="content-table-id content-table-id-wide">
                      {(video.title || `Video ${video.id}`).slice(0, 80)}
                      {(video.title ?? '').length > 80 ? '...' : ''}
                    </td>
                    <td className="content-table-date">
                      {video.author ? `@${video.author}` : '—'}
                    </td>
                    <td className="content-table-views">{formatNumber(video.views)}</td>
                    <td className="content-table-views">{formatNumber(video.likes ?? 0)}</td>
                    <td className="content-table-views">{formatNumber(video.comments ?? 0)}</td>
                    <td className="content-table-views">{formatNumber(video.shares ?? 0)}</td>
                    <td>
                      <a href={video.url} target="_blank" rel="noreferrer noopener" className="content-table-link">
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>
    </>
  );
}
