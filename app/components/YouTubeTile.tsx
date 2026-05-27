import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot } from '../lib/types';

export function YouTubeTile({ data }: { data: Snapshot['youtube'] }) {
  const video = data.videos[0];
  return (
    <Link href="/youtube" className="tile-link">
      <BentoCard
        title="YouTube"
        subtitle={data.channel}
        iconLetter="YT"
        headerExtra={
          <span className="card-subtitle tile-arrow">View details →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Subscribers</span>
          <span className="stat-value">{formatNumber(data.subscribers)}</span>
        </div>
        {video ? (
          <div className="yt-tile-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail}
              alt={video.title || 'Video thumbnail'}
              className="yt-tile-thumb"
            />
            <div className="yt-tile-info">
              <span className="yt-tile-title">{video.title}</span>
            </div>
          </div>
        ) : (
          <p className="card-subtitle">No video data available.</p>
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
