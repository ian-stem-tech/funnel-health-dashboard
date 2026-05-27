import { loadHistory, loadSnapshot } from '../lib/snapshot';
import { formatNumber } from '../lib/types';
import { BackLink } from '../components/BackLink';
import { RedditDetail } from './RedditDetail';

export default async function RedditPage() {
  const [history, snapshot] = await Promise.all([loadHistory(), loadSnapshot()]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const postMap = new Map<string, {
    id: string;
    title: string;
    upvotes: number;
    comments: number;
    url: string;
    subreddit?: string;
    createdAt?: string;
  }>();

  for (const entry of history.entries) {
    for (const post of entry.reddit?.posts ?? []) {
      const existing = postMap.get(post.id);
      if (!existing) {
        postMap.set(post.id, { ...post });
      } else if (post.upvotes > existing.upvotes) {
        Object.assign(existing, post);
      }
    }
  }

  const posts = Array.from(postMap.values());
  const karma = snapshot.reddit?.karma ?? 0;

  return (
    <main className="shell">
      <div className="frame detail-page">
        <header className="detail-header">
          <BackLink />
          <div className="detail-title-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={`${basePath}/branding/stem-logo-2.svg`} alt="Stem" />
            <div>
              <h1>Reddit</h1>
              <p>u/{snapshot.reddit?.user ?? 'stemplayer'} · {formatNumber(karma)} karma</p>
            </div>
          </div>
        </header>

        <RedditDetail posts={posts} />
      </div>
    </main>
  );
}
