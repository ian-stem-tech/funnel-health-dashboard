import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { ReelThumb } from './ReelThumb';
import { formatNumber, type Snapshot } from '../lib/types';

export function InstagramTile({ data }: { data: Snapshot['instagram'] }) {
  const reels = data.reels.slice(0, 3);
  return (
    <Link href="/instagram" className="tile-link">
      <BentoCard
        title="Instagram"
        subtitle={`@${data.handle}`}
        iconLetter="IG"
        headerExtra={
          <span className="card-subtitle tile-arrow">View details →</span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Followers</span>
          <span className="stat-value">{formatNumber(data.followers)}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">Recent reels (views)</span>
          {reels.length > 0 ? (
            <div className="reels-strip">
              {reels.map((reel) => (
                <ReelThumb
                  key={reel.shortcode}
                  thumbnail={reel.thumbnail}
                  views={reel.views}
                  url={reel.url}
                  label={`Reel ${reel.shortcode}`}
                />
              ))}
            </div>
          ) : (
            <p className="card-subtitle">
              No recent reel data — refresh job hasn&apos;t run yet or scraping was blocked.
            </p>
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
