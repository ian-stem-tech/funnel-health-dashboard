import { loadHistory, loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { YouTubeDetail } from './YouTubeDetail';

export default async function YouTubePage() {
  const [history, snapshot] = await Promise.all([loadHistory(), loadSnapshot()]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const chartData = history.entries
    .filter((e) => e.youtube)
    .map((e) => ({
      date: e.date,
      views: e.youtube?.totalVideoViews ?? 0,
      followers: e.youtube?.subscribers ?? 0,
    }));

  const videoMap = new Map<string, {
    id: string;
    thumbnail: string;
    views: number;
    url: string;
    firstSeen: string;
    likes?: number;
    comments?: number;
    title?: string;
  }>();

  for (const entry of history.entries) {
    for (const video of entry.youtube?.videos ?? []) {
      const existing = videoMap.get(video.id);
      if (!existing) {
        videoMap.set(video.id, {
          id: video.id,
          thumbnail: video.thumbnail,
          views: video.views,
          url: video.url,
          firstSeen: entry.date,
          likes: video.likes,
          comments: video.comments,
          title: video.title,
        });
      } else if (video.views > existing.views) {
        existing.views = video.views;
        existing.likes = video.likes;
        existing.comments = video.comments;
        if (video.thumbnail) existing.thumbnail = video.thumbnail;
      }
    }
  }

  const videos = Array.from(videoMap.values());
  const subscribers = snapshot.youtube?.subscribers ?? 0;

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>YouTube</h1>
              <p>{snapshot.youtube?.channel ?? 'stemplayer'} · {formatNumber(subscribers)} subscribers</p>
            </div>
          </div>
        </header>

        <YouTubeDetail chartData={chartData} videos={videos} />
      </div>
    </main>
  );
}
