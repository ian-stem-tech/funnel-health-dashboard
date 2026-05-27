import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { formatNumber, formatDate, type Snapshot } from '../lib/types';

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return formatNumber(n);
}

type Deltas30d = {
  views: number;
  likes: number;
  comments: number;
  igViews: number;
  ttViews: number;
  ytViews: number;
  xViews: number;
};

type Props = {
  snapshot: Snapshot;
  deltas30d: Deltas30d;
};

export function HeroCard({ snapshot, deltas30d }: Props) {
  const ig = snapshot.instagram;
  const tt = snapshot.tiktok;
  const yt = snapshot.youtube;
  const x = snapshot.x;

  const totalFollowers =
    ig.followers + tt.followers + (yt?.subscribers ?? 0) + (x?.followers ?? 0);
  const emailTotal = snapshot.mailchimp.cumulativeDisjoint;

  const totalEngagement = deltas30d.likes + deltas30d.comments;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const channelBreakdown = [
    { label: 'Instagram', value: ig.followers, icon: 'IG', href: `${basePath}/instagram/` },
    { label: 'TikTok', value: tt.followers, icon: 'TT', href: `${basePath}/tiktok/` },
    { label: 'YouTube', value: yt?.subscribers ?? 0, icon: 'YT', href: `${basePath}/youtube/` },
    { label: 'X', value: x?.followers ?? 0, icon: 'X', href: `${basePath}/x/` },
    { label: 'Email', value: emailTotal, icon: 'MC', href: '' },
  ];

  const hasData = deltas30d.views > 0 || deltas30d.likes > 0;

  return (
    <BentoCard className="hero-card">
      <div className="hero-top-row">
        <div className="hero-stat">
          <span className="hero-stat-label">Cumulative Reach</span>
          <span className="hero-stat-value">{compactNumber(totalFollowers + emailTotal)}</span>
          <span className="hero-stat-caption">
            {compactNumber(totalFollowers)} social + {compactNumber(emailTotal)} email
          </span>
        </div>
        <div className="hero-timestamp">
          <span className="hero-stat-label">Last snapshot</span>
          <span className="hero-stat-caption">{formatDate(snapshot.generatedAt)}</span>
        </div>
      </div>

      <div className="hero-30d-header">
        <span className="hero-stat-label">Last 30 Days · Views Gained</span>
        {!hasData && (
          <span className="hero-stat-caption">Collecting data — deltas need 2+ daily snapshots</span>
        )}
      </div>

      <div className="hero-metrics-grid">
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(deltas30d.views)}</span>
          <span className="hero-metric-label">Views</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(deltas30d.likes)}</span>
          <span className="hero-metric-label">Likes</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(deltas30d.comments)}</span>
          <span className="hero-metric-label">Comments</span>
        </div>
        <div className="hero-metric hero-metric-highlight">
          <span className="hero-metric-value">{compactNumber(totalEngagement)}</span>
          <span className="hero-metric-label">Engagement</span>
        </div>
      </div>

      <div className="hero-channel-strip">
        {channelBreakdown.map((ch) =>
          ch.href ? (
            <Link key={ch.label} href={ch.href} className="hero-channel-chip hero-channel-link">
              <span className="hero-channel-icon">{ch.icon}</span>
              <div className="hero-channel-info">
                <span className="hero-channel-value">{compactNumber(ch.value)}</span>
                <span className="hero-channel-label">{ch.label}</span>
              </div>
            </Link>
          ) : (
            <div key={ch.label} className="hero-channel-chip">
              <span className="hero-channel-icon">{ch.icon}</span>
              <div className="hero-channel-info">
                <span className="hero-channel-value">{compactNumber(ch.value)}</span>
                <span className="hero-channel-label">{ch.label}</span>
              </div>
            </div>
          ),
        )}
      </div>
    </BentoCard>
  );
}
