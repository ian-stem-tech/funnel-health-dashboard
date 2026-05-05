import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot } from '../lib/types';
import { IGEmbedGrid } from './IGEmbedGrid';

export function InstagramTile({ data }: { data: Snapshot['instagram'] }) {
  return (
    <Link href="/instagram" className="tile-link">
      <BentoCard
        title="Instagram"
        subtitle={`@${data.handle}`}
        iconLetter="IG"
        headerExtra={
          <span className="card-subtitle tile-arrow">
            {data.reels.length > 0 ? `${data.reels.length} reels · ` : ''}View all →
          </span>
        }
      >
        <div className="stat-block">
          <span className="stat-label">Followers</span>
          <span className="stat-value">{formatNumber(data.followers)}</span>
        </div>
        {data.reels.length > 0 ? (
          <div className="stat-block">
            <span className="stat-label">Latest reels</span>
            <IGEmbedGrid reels={data.reels.slice(0, 3)} />
          </div>
        ) : (
          <p className="card-subtitle">
            No recent reel data — refresh job hasn&apos;t run yet or scraping was blocked.
          </p>
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
