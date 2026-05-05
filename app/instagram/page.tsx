import { loadHistory } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { InstagramDetail } from './InstagramDetail';

export default async function InstagramPage() {
  const history = await loadHistory();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const chartData = history.entries.map((e) => ({
    date: e.date,
    views: e.instagram.totalReelViews,
    followers: e.instagram.followers,
  }));

  // Collect all unique reels across the entire history with first-seen dates
  const reelMap = new Map<string, {
    id: string;
    thumbnail: string;
    views: number;
    url: string;
    firstSeen: string;
  }>();

  for (const entry of history.entries) {
    for (const reel of entry.instagram.reels) {
      const existing = reelMap.get(reel.shortcode);
      if (!existing) {
        reelMap.set(reel.shortcode, {
          id: reel.shortcode,
          thumbnail: reel.thumbnail,
          views: reel.views,
          url: reel.url,
          firstSeen: entry.date,
        });
      } else if (reel.views > existing.views) {
        existing.views = reel.views;
        if (reel.thumbnail) existing.thumbnail = reel.thumbnail;
      }
    }
  }

  const reels = Array.from(reelMap.values());
  const latestEntry = history.entries[history.entries.length - 1];
  const followers = latestEntry?.instagram.followers ?? 0;

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

        <InstagramDetail chartData={chartData} reels={reels} />
      </div>
    </main>
  );
}
