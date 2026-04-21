import { BentoCard } from './BentoCard';
import { ReelThumb } from './ReelThumb';
import { formatNumber, type Snapshot } from '../lib/types';

export function TikTokTile({ data }: { data: Snapshot['tiktok'] }) {
  const videos = data.videos.slice(0, 3);
  return (
    <BentoCard
      title="TikTok"
      subtitle={`@${data.handle}`}
      iconLetter="TT"
      headerExtra={
        <a
          href={`https://tiktok.com/@${data.handle}`}
          target="_blank"
          rel="noreferrer noopener"
          className="card-subtitle"
          style={{ textDecoration: 'underline' }}
        >
          open ↗
        </a>
      }
    >
      <div className="stat-block">
        <span className="stat-label">Followers</span>
        <span className="stat-value">{formatNumber(data.followers)}</span>
      </div>
      <div className="stat-block">
        <span className="stat-label">Recent videos (views)</span>
        {videos.length > 0 ? (
          <div className="reels-strip">
            {videos.map((video) => (
              <ReelThumb
                key={video.id}
                thumbnail={video.thumbnail}
                views={video.views}
                url={video.url}
                label={`TikTok ${video.id}`}
              />
            ))}
          </div>
        ) : (
          <p className="card-subtitle">
            No recent video data — refresh job hasn’t run yet or scraping was blocked.
          </p>
        )}
      </div>
      {data.error && (
        <p className="card-subtitle" style={{ color: '#a16207' }}>
          Last refresh warning: {data.error}
        </p>
      )}
    </BentoCard>
  );
}
