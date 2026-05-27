import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot } from '../lib/types';

export function XTile({ data }: { data: Snapshot['x'] }) {
  const tweets = data.tweets.slice(0, 3);
  const totalEngagement = tweets.reduce(
    (sum, t) => sum + t.likes + t.retweets + t.replies,
    0,
  );

  return (
    <Link href="/x" className="tile-link">
      <BentoCard
        title="X"
        subtitle={`@${data.handle}`}
        iconLetter="X"
        headerExtra={
          <span className="card-subtitle tile-arrow">View details →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Followers</span>
          <span className="stat-value">{formatNumber(data.followers)}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">Recent tweets</span>
          {tweets.length > 0 ? (
            <div className="tweet-preview-list">
              {tweets.map((tweet) => (
                <div key={tweet.id} className="tweet-preview">
                  <p className="tweet-text">{tweet.text.slice(0, 120)}{tweet.text.length > 120 ? '...' : ''}</p>
                  <div className="tweet-stats">
                    <span>♥ {formatNumber(tweet.likes)}</span>
                    <span>⟲ {formatNumber(tweet.retweets)}</span>
                    <span>▶ {formatNumber(tweet.views)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="card-subtitle">No recent tweet data available.</p>
          )}
        </div>
        {totalEngagement > 0 && (
          <div className="stat-block">
            <span className="stat-label">Recent engagement</span>
            <span className="stat-value">{formatNumber(totalEngagement)}</span>
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
