import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { ReelThumb } from './ReelThumb';
import { formatNumber, type Snapshot } from '../lib/types';

export function YouTubeTile({ data }: { data: Snapshot['youtube'] }) {
  const videos = data.videos.slice(0, 3);
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
        <div className="stat-block">
          <span className="stat-label">Recent videos</span>
          {videos.length > 0 ? (
            <div className="reels-strip">
              {videos.map((video) => (
                <ReelThumb
                  key={video.id}
                  thumbnail={video.thumbnail}
                  views={video.views}
                  url={video.url}
                  label={video.title}
                />
              ))}
            </div>
          ) : (
            <p className="card-subtitle">No recent video data available.</p>
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
