import { loadHistory, loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { InstagramDetail } from './InstagramDetail';
import { computeContentDeltas } from '../lib/computeDeltas';

export default async function InstagramPage() {
  const [history, snapshot] = await Promise.all([loadHistory(), loadSnapshot()]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const chartData = history.entries.map((e) => ({
    date: e.date,
    views: e.instagram.totalReelViews,
    followers: e.instagram.followers,
  }));

  const deltas = computeContentDeltas(
    history.entries,
    (e) => e.instagram.reels.map((r) => ({ ...r, id: r.shortcode })),
    'id',
  );

  const reelMap = new Map<string, {
    id: string;
    thumbnail: string;
    views: number;
    views1d: number;
    views7d: number;
    views30d: number;
    url: string;
    firstSeen: string;
    likes?: number;
    comments?: number;
    saves?: number;
  }>();

  for (const entry of history.entries) {
    for (const reel of entry.instagram.reels) {
      const existing = reelMap.get(reel.shortcode);
      const d = deltas.get(reel.shortcode);
      if (!existing) {
        reelMap.set(reel.shortcode, {
          id: reel.shortcode,
          thumbnail: reel.thumbnail,
          views: reel.views,
          views1d: d?.views1d ?? 0,
          views7d: d?.views7d ?? 0,
          views30d: d?.views30d ?? 0,
          url: reel.url,
          firstSeen: entry.date,
          likes: reel.likes,
          comments: reel.comments,
          saves: reel.saves,
        });
      } else if (reel.views > existing.views) {
        existing.views = reel.views;
        existing.likes = reel.likes;
        existing.comments = reel.comments;
        existing.saves = reel.saves;
        if (reel.thumbnail) existing.thumbnail = reel.thumbnail;
      }
    }
  }

  const reels = Array.from(reelMap.values());
  const followers = snapshot.instagram.followers;
  const currentReels = snapshot.instagram.reels;

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>Instagram Reels</h1>
              <p>@stemplayer · {formatNumber(followers)} followers</p>
            </div>
          </div>
        </header>

        <InstagramDetail chartData={chartData} reels={reels} currentReels={currentReels} />
      </div>
    </main>
  );
}
