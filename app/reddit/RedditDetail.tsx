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
  source?: 'subreddit' | 'mention';
};

type RedditTab = 'all' | 'subreddit' | 'mentions';

type Props = {
  subredditPosts: PostItem[];
  mentions: PostItem[];
};

function PostTable({ posts }: { posts: PostItem[] }) {
  if (posts.length === 0) {
    return (
      <div className="content-table-empty">
        No post data collected yet. Data accumulates with each daily refresh.
      </div>
    );
  }

  return (
    <div className="content-table-scroll">
      <table className="content-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Subreddit</th>
            <th>Source</th>
            <th>Upvotes</th>
            <th>Comments</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={`${post.source}-${post.id}`}>
              <td className="content-table-id" style={{ maxWidth: 280 }}>
                {post.title.slice(0, 120)}{post.title.length > 120 ? '...' : ''}
              </td>
              <td className="content-table-date">
                {post.subreddit ? `r/${post.subreddit}` : '—'}
              </td>
              <td className="content-table-date">
                {post.source === 'mention' ? 'Mention' : 'Subreddit'}
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
  );
}

export function RedditDetail({ subredditPosts, mentions }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const [tab, setTab] = useState<RedditTab>('all');

  const allPosts = [
    ...subredditPosts.map((p) => ({ ...p, source: 'subreddit' as const })),
    ...mentions.map((p) => ({ ...p, source: 'mention' as const })),
  ];

  const tabPosts =
    tab === 'subreddit' ? subredditPosts.map((p) => ({ ...p, source: 'subreddit' as const })) :
    tab === 'mentions' ? mentions.map((p) => ({ ...p, source: 'mention' as const })) :
    allPosts;

  const filteredPosts = filterByDateRange(tabPosts, range, 'createdAt');

  const tabLabel =
    tab === 'subreddit' ? 'Subreddit Posts' :
    tab === 'mentions' ? 'Brand Mentions' :
    'All Posts';

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <div className="chart-toggle" style={{ marginBottom: 16 }}>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          All ({allPosts.length})
        </button>
        <button className={tab === 'subreddit' ? 'active' : ''} onClick={() => setTab('subreddit')}>
          r/stemplayer ({subredditPosts.length})
        </button>
        <button className={tab === 'mentions' ? 'active' : ''} onClick={() => setTab('mentions')}>
          Mentions ({mentions.length})
        </button>
      </div>

      <BentoCard
        title={tabLabel}
        subtitle={range === 'all'
          ? `${tabPosts.length} tracked`
          : `${filteredPosts.length} of ${tabPosts.length} posts`}
        iconLetter="R"
      >
        <PostTable posts={filteredPosts} />
      </BentoCard>
    </>
  );
}
