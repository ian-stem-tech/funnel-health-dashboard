import { BentoCard } from './BentoCard';
import { formatNumber, formatDate, type Snapshot } from '../lib/types';

export function HeroCard({ snapshot }: { snapshot: Snapshot }) {
  const totalSocial =
    snapshot.instagram.followers +
    snapshot.tiktok.followers +
    (snapshot.youtube?.subscribers ?? 0) +
    (snapshot.x?.followers ?? 0);

  const emailTotal = snapshot.mailchimp.cumulativeDisjoint;

  return (
    <BentoCard className="hero-card">
      <div className="hero-stat">
        <span className="hero-stat-label">Funnel health · Cumulative reach</span>
        <span className="hero-stat-value">{formatNumber(totalSocial + emailTotal)}</span>
        <span className="hero-stat-caption">
          {formatNumber(totalSocial)} social followers + {formatNumber(emailTotal)} email subscribers · last snapshot{' '}
          {formatDate(snapshot.generatedAt)}
        </span>
      </div>
    </BentoCard>
  );
}
