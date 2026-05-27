import { loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { TikTokHashtagDetail } from './TikTokHashtagDetail';

export default async function TikTokHashtagPage() {
  const snapshot = await loadSnapshot();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const data = snapshot.tiktokHashtag;
  const videos = (data?.videos ?? []).map((v) => ({
    ...v,
    createdAt: v.createdAt ?? undefined,
  }));
  const totalViews = videos.reduce((sum, v) => sum + (v.views ?? 0), 0);

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>TikTok Hashtags</h1>
              <p>{(data?.hashtags ?? ['stemplayer']).map((h) => `#${h}`).join(', ')} · {formatNumber(videos.length)} videos · {formatNumber(totalViews)} total views</p>
            </div>
          </div>
        </header>

        <TikTokHashtagDetail videos={videos} hashtags={data?.hashtags ?? ['stemplayer']} />
      </div>
    </main>
  );
}
