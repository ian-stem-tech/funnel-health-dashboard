import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot } from '../lib/types';

export function TikTokHashtagTile({ data }: { data: Snapshot['tiktokHashtag'] }) {
  const videos = (data.videos ?? []).slice(0, 3);
  const totalViews = (data.videos ?? []).reduce((sum, v) => sum + (v.views ?? 0), 0);

  return (
    <Link href="/tiktok-hashtag" className="tile-link">
      <BentoCard
        title="TikTok Hashtag"
        subtitle={(data.hashtags ?? []).map((h) => `#${h}`).join(', ')}
        iconLetter="TT"
        headerExtra={
          <span className="card-subtitle tile-arrow">View details →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Videos tracked</span>
          <span className="stat-value">{formatNumber((data.videos ?? []).length)}</span>
        </div>
        {totalViews > 0 && (
          <div className="stat-block">
            <span className="stat-label">Total views</span>
            <span className="stat-value">{formatNumber(totalViews)}</span>
          </div>
        )}
        <div className="stat-block">
          <span className="stat-label">Recent campaign posts</span>
          {videos.length > 0 ? (
            <div className="tweet-preview-list">
              {videos.map((video) => (
                <div key={video.id} className="tweet-preview">
                  <p className="tweet-text">
                    {video.title ? video.title.slice(0, 80) : `Video ${video.id}`}
                    {video.author ? ` · @${video.author}` : ''}
                  </p>
                  <div className="tweet-stats">
                    <span>{formatNumber(video.views)} views</span>
                    <span>{formatNumber(video.likes ?? 0)} likes</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="card-subtitle">No campaign data yet.</p>
          )}
        </div>
        {data.error && (
          <p className="card-subtitle" style={{ color: '#a16207' }}>
            Last refresh warning: {data.error}
          </p>
        )}
      </BentoCard>
    </Link>
  );
}
