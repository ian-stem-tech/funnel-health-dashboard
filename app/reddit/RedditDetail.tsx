'use client';

import { BentoCard } from '../components/BentoCard';
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
  return (
    <BentoCard title="All Posts" subtitle={`${posts.length} tracked`} iconLetter="R">
      {posts.length === 0 ? (
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
              {posts.map((post) => (
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
  );
}
