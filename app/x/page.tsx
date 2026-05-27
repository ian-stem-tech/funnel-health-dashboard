import { loadHistory, loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { XDetail } from './XDetail';

export default async function XPage() {
  const [history, snapshot] = await Promise.all([loadHistory(), loadSnapshot()]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const chartData = history.entries
    .filter((e) => e.x)
    .map((e) => ({
      date: e.date,
      views: e.x?.totalTweetViews ?? 0,
      followers: e.x?.followers ?? 0,
    }));

  const tweetMap = new Map<string, {
    id: string;
    text: string;
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    url: string;
    createdAt?: string;
  }>();

  for (const entry of history.entries) {
    for (const tweet of entry.x?.tweets ?? []) {
      const existing = tweetMap.get(tweet.id);
      if (!existing) {
        tweetMap.set(tweet.id, { ...tweet });
      } else if (tweet.views > existing.views) {
        Object.assign(existing, tweet);
      }
    }
  }

  const tweets = Array.from(tweetMap.values());
  const followers = snapshot.x?.followers ?? 0;

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>X (Twitter)</h1>
              <p>@{snapshot.x?.handle ?? 'stemplayer'} · {formatNumber(followers)} followers</p>
            </div>
          </div>
        </header>

        <XDetail chartData={chartData} tweets={tweets} />
      </div>
    </main>
  );
}
