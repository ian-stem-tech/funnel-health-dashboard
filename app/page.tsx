import { loadHistory, loadSnapshot } from './lib/snapshot';
import { HeroCard } from './components/HeroCard';
import { InstagramTile } from './components/InstagramTile';
import { TikTokTile } from './components/TikTokTile';
import { TikTokHashtagTile } from './components/TikTokHashtagTile';
import { YouTubeTile } from './components/YouTubeTile';
import { XTile } from './components/XTile';
import { RedditTile } from './components/RedditTile';
import { MailchimpTile } from './components/MailchimpTile';
import { WaitlistTile } from './components/WaitlistTile';
import { LastUpdated } from './components/LastUpdated';
import { computeContentDeltas } from './lib/computeDeltas';

const REPO_SLUG = process.env.NEXT_PUBLIC_REPO_SLUG;
const WORKFLOW_URL = REPO_SLUG
  ? `https://github.com/${REPO_SLUG}/actions/workflows/refresh-data.yml`
  : undefined;

export default async function Page() {
  const [snapshot, history] = await Promise.all([loadSnapshot(), loadHistory()]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const igDeltas = computeContentDeltas(
    history.entries,
    (e) => e.instagram.reels.map((r) => ({ ...r, id: r.shortcode })),
    'id',
  );
  const ttDeltas = computeContentDeltas(
    history.entries,
    (e) => e.tiktok.videos.map((v) => ({ ...v, id: v.id })),
    'id',
  );
  const ytDeltas = computeContentDeltas(
    history.entries,
    (e) => (e.youtube?.videos ?? []).map((v) => ({ ...v, id: v.id })),
    'id',
  );
  const xDeltas = computeContentDeltas(
    history.entries,
    (e) => (e.x?.tweets ?? []).map((t) => ({ id: t.id, views: t.views, likes: t.likes, comments: t.replies ?? 0 })),
    'id',
  );

  function sumField(deltas: Map<string, Record<string, number>>, field: string): number {
    let total = 0;
    for (const d of deltas.values()) total += d[field] ?? 0;
    return total;
  }

  const deltas30d = {
    views: sumField(igDeltas, 'views30d') + sumField(ttDeltas, 'views30d') + sumField(ytDeltas, 'views30d') + sumField(xDeltas, 'views30d'),
    likes: sumField(igDeltas, 'likes30d') + sumField(ttDeltas, 'likes30d') + sumField(ytDeltas, 'likes30d') + sumField(xDeltas, 'likes30d'),
    comments: sumField(igDeltas, 'comments30d') + sumField(ttDeltas, 'comments30d') + sumField(ytDeltas, 'comments30d') + sumField(xDeltas, 'comments30d'),
    igViews: sumField(igDeltas, 'views30d'),
    ttViews: sumField(ttDeltas, 'views30d'),
    ytViews: sumField(ytDeltas, 'views30d'),
    xViews: sumField(xDeltas, 'views30d'),
  };

  return (
    <main className="shell">
      <div className="frame">
        <header className="dash-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
          <div>
            <h1>Funnel Health Dashboard</h1>
            <p>Daily snapshot · social reach · email funnel</p>
          </div>
        </header>

        <div className="bento">
          <div className="area-hero">
            <HeroCard snapshot={snapshot} deltas30d={deltas30d} />
          </div>
          <div className="area-instagram">
            <InstagramTile data={snapshot.instagram} />
          </div>
          <div className="area-tiktok">
            <TikTokTile data={snapshot.tiktok} />
          </div>
          <div className="area-youtube">
            <YouTubeTile data={snapshot.youtube} />
          </div>
          <div className="area-x">
            <XTile data={snapshot.x} />
          </div>
          <div className="area-reddit">
            <RedditTile data={snapshot.reddit} />
          </div>
          <div className="area-tiktok-hashtag">
            <TikTokHashtagTile data={snapshot.tiktokHashtag} />
          </div>
          <div className="area-mailchimp">
            <MailchimpTile data={snapshot.mailchimp} />
          </div>
          {snapshot.waitlist && (
            <div className="area-waitlist">
              <WaitlistTile data={snapshot.waitlist} />
            </div>
          )}
        </div>

        <LastUpdated iso={snapshot.generatedAt} workflowUrl={WORKFLOW_URL} />
      </div>
    </main>
  );
}
