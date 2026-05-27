'use client';

import { useState } from 'react';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { filterByDateRange, type TimeRange } from '../lib/dateFilter';
import { formatNumber } from '../lib/types';

type PostItem = {
  id: string;
  title: string;
  upvotes: number;
  comments: number;
  url: string;
  subreddit?: string;
  createdAt?: string;
};

type Props = {
  posts: PostItem[];
};

export function RedditDetail({ posts }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const filteredPosts = filterByDateRange(posts, range, 'createdAt');

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard
        title="All Posts"
        subtitle={range === 'all' ? `${posts.length} tracked` : `${filteredPosts.length} of ${posts.length} posts`}
        iconLetter="R"
      >
        {filteredPosts.length === 0 ? (
          <div className="content-table-empty">
            No post data collected yet. Data accumulates with each daily refresh.
          </div>
        ) : (
          <div className="content-table-scroll">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subreddit</th>
                  <th>Upvotes</th>
                  <th>Comments</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id}>
                    <td className="content-table-id" style={{ maxWidth: 320 }}>
                      {post.title.slice(0, 120)}{post.title.length > 120 ? '...' : ''}
                    </td>
                    <td className="content-table-date">
                      {post.subreddit ? `r/${post.subreddit}` : '—'}
                    </td>
                    <td className="content-table-views">{formatNumber(post.upvotes)}</td>
                    <td className="content-table-views">{formatNumber(post.comments)}</td>
                    <td>
                      <a href={post.url} target="_blank" rel="noreferrer noopener" className="content-table-link">
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
