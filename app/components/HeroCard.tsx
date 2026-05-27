import { BentoCard } from './BentoCard';
import { formatNumber, formatDate, type Snapshot } from '../lib/types';

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return formatNumber(n);
}

function isWithin30Days(dateStr: string | undefined): boolean {
  if (!dateStr) return true;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return d.getTime() >= thirtyDaysAgo;
  } catch {
    return true;
  }
}

function parseXDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return undefined;
  }
}

export function HeroCard({ snapshot }: { snapshot: Snapshot }) {
  const ig = snapshot.instagram;
  const tt = snapshot.tiktok;
  const yt = snapshot.youtube;
  const x = snapshot.x;
  const rd = snapshot.reddit;

  const totalFollowers =
    ig.followers + tt.followers + (yt?.subscribers ?? 0) + (x?.followers ?? 0);
  const emailTotal = snapshot.mailchimp.cumulativeDisjoint;

  const recentReels = ig.reels ?? [];
  const recentTTVideos = (tt.videos ?? []).filter((v) => isWithin30Days(v.createdAt));
  const recentYTVideos = (yt?.videos ?? []).filter((v) => isWithin30Days(v.publishedAt));
  const recentTweets = (x?.tweets ?? []).filter((t) => isWithin30Days(parseXDate(t.createdAt)));
  const allReddit = [...(rd?.subredditPosts ?? []), ...(rd?.mentions ?? [])];
  const recentReddit = allReddit.filter((p) => isWithin30Days(p.createdAt));

  const totalViews =
    recentReels.reduce((s, r) => s + (r.views || 0), 0) +
    recentTTVideos.reduce((s, v) => s + (v.views || 0), 0) +
    recentYTVideos.reduce((s, v) => s + (v.views || 0), 0) +
    recentTweets.reduce((s, t) => s + (t.views || 0), 0);

  const totalLikes =
    recentReels.reduce((s, r) => s + (r.likes || 0), 0) +
    recentTTVideos.reduce((s, v) => s + (v.likes || 0), 0) +
    recentYTVideos.reduce((s, v) => s + (v.likes || 0), 0) +
    recentTweets.reduce((s, t) => s + (t.likes || 0), 0) +
    recentReddit.reduce((s, p) => s + (p.upvotes || 0), 0);

  const totalComments =
    recentReels.reduce((s, r) => s + (r.comments || 0), 0) +
    recentTTVideos.reduce((s, v) => s + (v.comments || 0), 0) +
    recentYTVideos.reduce((s, v) => s + (v.comments || 0), 0) +
    recentTweets.reduce((s, t) => s + (t.replies || 0), 0) +
    recentReddit.reduce((s, p) => s + (p.comments || 0), 0);

  const totalShares =
    recentReels.reduce((s, r) => s + (r.shares || 0), 0) +
    recentTTVideos.reduce((s, v) => s + (v.shares || 0), 0) +
    recentTweets.reduce((s, t) => s + (t.retweets || 0), 0);

  const totalEngagement = totalLikes + totalComments + totalShares;

  const contentCount =
    recentReels.length + recentTTVideos.length + recentYTVideos.length + recentTweets.length;

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

      <div className="hero-30d-header">
        <span className="hero-stat-label">Last 30 Days · Owned Content</span>
        <span className="hero-stat-caption">{contentCount} posts across all channels</span>
      </div>

      <div className="hero-metrics-grid">
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalViews)}</span>
          <span className="hero-metric-label">Views</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalLikes)}</span>
          <span className="hero-metric-label">Likes & Upvotes</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalComments)}</span>
          <span className="hero-metric-label">Comments</span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-value">{compactNumber(totalShares)}</span>
          <span className="hero-metric-label">Shares</span>
        </div>
        <div className="hero-metric hero-metric-highlight">
          <span className="hero-metric-value">{compactNumber(totalEngagement)}</span>
          <span className="hero-metric-label">Engagement</span>
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
