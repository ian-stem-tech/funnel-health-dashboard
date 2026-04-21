import { loadSnapshot } from './lib/snapshot';
import { HeroCard } from './components/HeroCard';
import { InstagramTile } from './components/InstagramTile';
import { TikTokTile } from './components/TikTokTile';
import { MailchimpTile } from './components/MailchimpTile';
import { LastUpdated } from './components/LastUpdated';

const REPO_SLUG = process.env.NEXT_PUBLIC_REPO_SLUG;
const WORKFLOW_URL = REPO_SLUG
  ? `https://github.com/${REPO_SLUG}/actions/workflows/refresh-data.yml`
  : undefined;

export default async function Page() {
  const snapshot = await loadSnapshot();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
            <HeroCard snapshot={snapshot} />
          </div>
          <div className="area-instagram">
            <InstagramTile data={snapshot.instagram} />
          </div>
          <div className="area-tiktok">
            <TikTokTile data={snapshot.tiktok} />
          </div>
          <div className="area-mailchimp">
            <MailchimpTile data={snapshot.mailchimp} />
          </div>
        </div>

        <LastUpdated iso={snapshot.generatedAt} workflowUrl={WORKFLOW_URL} />
      </div>
    </main>
  );
}
