import { loadHistory } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { TikTokDetail } from './TikTokDetail';

export default async function TikTokPage() {
  const history = await loadHistory();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const chartData = history.entries.map((e) => ({
    date: e.date,
    views: e.tiktok.totalVideoViews,
    followers: e.tiktok.followers,
  }));

  // Collect all unique videos across the entire history with first-seen dates
  const videoMap = new Map<string, {
    id: string;
    thumbnail: string;
    views: number;
    url: string;
    firstSeen: string;
  }>();

  for (const entry of history.entries) {
    for (const video of entry.tiktok.videos) {
      const existing = videoMap.get(video.id);
      if (!existing) {
        videoMap.set(video.id, {
          id: video.id,
          thumbnail: video.thumbnail,
          views: video.views,
          url: video.url,
          firstSeen: entry.date,
        });
      } else if (video.views > existing.views) {
        existing.views = video.views;
        if (video.thumbnail) existing.thumbnail = video.thumbnail;
      }
    }
  }

  const videos = Array.from(videoMap.values());
  const latestEntry = history.entries[history.entries.length - 1];
  const followers = latestEntry?.tiktok.followers ?? 0;

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>TikTok Videos</h1>
              <p>@stemplayer · {formatNumber(followers)} followers</p>
            </div>
          </div>
        </header>

        <TikTokDetail chartData={chartData} videos={videos} />
      </div>
    </main>
  );
}
