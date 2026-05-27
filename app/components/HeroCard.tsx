import { BentoCard } from './BentoCard';
import { formatNumber, formatDate, type Snapshot } from '../lib/types';

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return formatNumber(n);
}

export function HeroCard({ snapshot }: { snapshot: Snapshot }) {
  const ig = snapshot.instagram;
  const tt = snapshot.tiktok;
  const yt = snapshot.youtube;
  const x = snapshot.x;
  const rd = snapshot.reddit;
  const ttHash = snapshot.tiktokHashtag;

  const totalFollowers =
    ig.followers + tt.followers + (yt?.subscribers ?? 0) + (x?.followers ?? 0);

  const emailTotal = snapshot.mailchimp.cumulativeDisjoint;

  const totalViews =
    (ig.reels ?? []).reduce((s, r) => s + (r.views || 0), 0) +
    (tt.videos ?? []).reduce((s, v) => s + (v.views || 0), 0) +
    (yt?.videos ?? []).reduce((s, v) => s + (v.views || 0), 0) +
    (x?.tweets ?? []).reduce((s, t) => s + (t.views || 0), 0) +
    (ttHash?.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);

  const totalLikes =
    (ig.reels ?? []).reduce((s, r) => s + (r.likes || 0), 0) +
    (tt.videos ?? []).reduce((s, v) => s + (v.likes || 0), 0) +
    (yt?.videos ?? []).reduce((s, v) => s + (v.likes || 0), 0) +
    (x?.tweets ?? []).reduce((s, t) => s + (t.likes || 0), 0) +
    (ttHash?.videos ?? []).reduce((s, v) => s + (v.likes || 0), 0) +
    [...(rd?.subredditPosts ?? []), ...(rd?.mentions ?? [])].reduce((s, p) => s + (p.upvotes || 0), 0);

  const totalComments =
    (ig.reels ?? []).reduce((s, r) => s + (r.comments || 0), 0) +
    (tt.videos ?? []).reduce((s, v) => s + (v.comments || 0), 0) +
    (yt?.videos ?? []).reduce((s, v) => s + (v.comments || 0), 0) +
    (x?.tweets ?? []).reduce((s, t) => s + (t.replies || 0), 0) +
    (ttHash?.videos ?? []).reduce((s, v) => s + (v.comments || 0), 0) +
    [...(rd?.subredditPosts ?? []), ...(rd?.mentions ?? [])].reduce((s, p) => s + (p.comments || 0), 0);

  const totalShares =
    (ig.reels ?? []).reduce((s, r) => s + (r.shares || 0), 0) +
    (tt.videos ?? []).reduce((s, v) => s + (v.shares || 0), 0) +
    (ttHash?.videos ?? []).reduce((s, v) => s + (v.shares || 0), 0) +
    (x?.tweets ?? []).reduce((s, t) => s + (t.retweets || 0), 0);

  const totalEngagement = totalLikes + totalComments + totalShares;

  const channelBreakdown = [
    { label: 'Instagram', value: ig.followers, icon: 'IG' },
    { label: 'TikTok', value: tt.followers, icon: 'TT' },
    { label: 'YouTube', value: yt?.subscribers ?? 0, icon: 'YT' },
    { label: 'X', value: x?.followers ?? 0, icon: 'X' },
    { label: 'Email', value: emailTotal, icon: 'MC' },
  ];

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

      <div className="hero-metrics-grid">
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalViews)}</span>
          <span className="hero-metric-label">Total Views</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalLikes)}</span>
          <span className="hero-metric-label">Likes & Upvotes</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalComments)}</span>
          <span className="hero-metric-label">Comments & Replies</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalShares)}</span>
          <span className="hero-metric-label">Shares & Retweets</span>
        </div>
        <div className="hero-metric hero-metric-highlight">
          <span className="hero-metric-value">{compactNumber(totalEngagement)}</span>
          <span className="hero-metric-label">Total Engagement</span>
        </div>
      </div>

      <div className="hero-channel-strip">
        {channelBreakdown.map((ch) => (
          <div key={ch.label} className="hero-channel-chip">
            <span className="hero-channel-icon">{ch.icon}</span>
            <div className="hero-channel-info">
              <span className="hero-channel-value">{compactNumber(ch.value)}</span>
              <span className="hero-channel-label">{ch.label}</span>
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
