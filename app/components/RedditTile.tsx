import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot } from '../lib/types';

export function RedditTile({ data }: { data: Snapshot['reddit'] }) {
  const posts = data.posts.slice(0, 3);
  const totalUpvotes = posts.reduce((sum, p) => sum + p.upvotes, 0);

  return (
    <Link href="/reddit" className="tile-link">
      <BentoCard
        title="Reddit"
        subtitle={`u/${data.user}`}
        iconLetter="R"
        headerExtra={
          <span className="card-subtitle tile-arrow">View details →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Karma</span>
          <span className="stat-value">{formatNumber(data.karma)}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">Recent posts</span>
          {posts.length > 0 ? (
            <div className="tweet-preview-list">
              {posts.map((post) => (
                <div key={post.id} className="tweet-preview">
                  <p className="tweet-text">{post.title.slice(0, 120)}{post.title.length > 120 ? '...' : ''}</p>
                  <div className="tweet-stats">
                    <span>↑ {formatNumber(post.upvotes)}</span>
                    <span>💬 {formatNumber(post.comments)}</span>
                    {post.subreddit && <span>r/{post.subreddit}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="card-subtitle">No recent post data available.</p>
          )}
        </div>
        {totalUpvotes > 0 && (
          <div className="stat-block">
            <span className="stat-label">Recent upvotes</span>
            <span className="stat-value">{formatNumber(totalUpvotes)}</span>
          </div>
        )}
        {data.error && (
          <p className="card-subtitle" style={{ color: '#a16207' }}>
            Last refresh warning: {data.error}
          </p>
        )}
      </BentoCard>
    </Link>
  );
}
