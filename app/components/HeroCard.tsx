import { BentoCard } from './BentoCard';
import { formatNumber, formatDate, type Snapshot } from '../lib/types';

export function HeroCard({ snapshot }: { snapshot: Snapshot }) {
  const total = snapshot.mailchimp.cumulativeDisjoint;
  return (
    <BentoCard className="hero-card">
      <div className="hero-stat">
        <span className="hero-stat-label">Funnel health · Cumulative reach</span>
        <span className="hero-stat-value">{formatNumber(total)}</span>
        <span className="hero-stat-caption">
          Mailchimp combined list of {formatNumber(total)} addresses · last snapshot{' '}
          {formatDate(snapshot.generatedAt)}
        </span>
      </div>
    </BentoCard>
  );
}
