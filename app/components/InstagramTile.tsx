import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { ReelThumb } from './ReelThumb';
import { formatNumber, type Snapshot } from '../lib/types';

export function InstagramTile({ data }: { data: Snapshot['instagram'] }) {
  const reels = data.reels.slice(0, 3);
  const totalViews = data.reels.reduce((s, r) => s + (r.views || 0), 0);

  return (
    <Link href="/instagram" className="tile-link">
      <BentoCard
        title="Instagram"
        subtitle={`@${data.handle}`}
        iconLetter="IG"
        headerExtra={
          <span className="card-subtitle tile-arrow">View all →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Followers</span>
          <span className="stat-value">{formatNumber(data.followers)}</span>
        </div>
        {totalViews > 0 && (
          <div className="stat-block">
            <span className="stat-label">Total reel views</span>
            <span className="stat-value">{formatNumber(totalViews)}</span>
          </div>
        )}
        {reels.length > 0 ? (
          <div className="reels-strip">
            {reels.map((reel) => (
              <ReelThumb
                key={reel.shortcode}
                thumbnail={reel.thumbnail}
                views={reel.views}
                url={reel.url}
                label={reel.title || `Reel ${reel.shortcode}`}
              />
            ))}
          </div>
        ) : (
          <p className="card-subtitle">
            No recent reel data — awaiting first refresh.
          </p>
        )}
        {data.error && (
          <p className="card-subtitle" style={{ color: '#a16207' }}>
            {data.error}
          </p>
        )}
      </BentoCard>
    </Link>
  );
}
