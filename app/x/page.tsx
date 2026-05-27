import { loadHistory, loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { XDetail } from './XDetail';
import { computeContentDeltas } from '../lib/computeDeltas';

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

  const deltas = computeContentDeltas(
    history.entries,
    (e) => (e.x?.tweets ?? []).map((t) => ({ ...t, id: t.id })),
    'id',
  );

  const tweetMap = new Map<string, {
    id: string;
    text: string;
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    views1d: number;
    views7d: number;
    views30d: number;
    url: string;
    createdAt?: string;
  }>();

  for (const entry of history.entries) {
    for (const tweet of entry.x?.tweets ?? []) {
      const existing = tweetMap.get(tweet.id);
      const d = deltas.get(tweet.id);
      if (!existing) {
        tweetMap.set(tweet.id, {
          ...tweet,
          views1d: d?.views1d ?? 0,
          views7d: d?.views7d ?? 0,
          views30d: d?.views30d ?? 0,
        });
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
