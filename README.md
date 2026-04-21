# Funnel Health Dashboard

Static Next.js dashboard giving a one-glance view of Stem Player funnel health: Instagram + TikTok engagement and the Mailchimp email funnel with a working Kano vs Stemplayer split.

Deployed to **GitHub Pages**, refreshed daily by a **GitHub Actions** cron that scrapes the public IG/TikTok profiles, calls the Mailchimp API, and commits a static `public/data/snapshot.json` the frontend reads.

## Architecture

- **Frontend**: Next.js 15 (App Router, React 19, TypeScript) exported as a fully static site (`output: 'export'`).
- **Styling**: lifted from the `stemfm-interview` reference app — DeepSea fonts, cream + dark vignette, glass-morphism bento cards.
- **Data layer**: a single `public/data/snapshot.json` regenerated daily by `scripts/refresh-snapshot.mjs` running in CI. The browser only ever fetches the static JSON; **no API keys are ever shipped client-side**.
- **Deploy**: `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
- **Refresh**: `.github/workflows/refresh-data.yml` runs daily (06:00 UTC) and on `workflow_dispatch`. Commits the new snapshot back to `main`, which automatically triggers a re-deploy.

## Bento layout

- **Hero card** — Cumulative Mailchimp reach (combined disjoint total).
- **Instagram tile** — `@stemplayer` follower count + 3 most recent reels with view counts.
- **TikTok tile** — `@stemplayer` follower count + 3 most recent videos with view counts.
- **Mailchimp tile** — filterable cumulative number, segment chip filters, and one card per audience including:
  - **Inferred Kano subscribers** — `458,641 − (84,114 + 8,224 + 9,507 + 27,329)` = **329,467**, shown with a dashed "inferred" badge.
  - Kano + Stemplayer combined raw — 458,641
  - Stemplayer Purchasers — 84,114
  - Stem 2 High spenders (no projector buyers) — 9,507
  - Stemplayer Subscribed, no purchase — 8,224
  - Stem 2 Product interest — 27,329

Toggling segment chips reactively recomputes the cumulative figure, dims inactive cards, and persists selection in `localStorage`.

## Local development

```bash
npm install
cp .env.example .env.local      # add MAILCHIMP_API_KEY if you want live data locally
npm run refresh                 # regenerate public/data/snapshot.json from real APIs
npm run dev                     # http://localhost:3000
```

Without `MAILCHIMP_API_KEY` set, `npm run refresh` falls back to the seeded numbers so the dashboard still renders.

## Build

```bash
npm run build
# output in ./out — the static site GitHub Pages serves
```

## Required GitHub configuration

In the repo settings:

- **Settings → Secrets and variables → Actions → Secrets**
  - `MAILCHIMP_API_KEY` — your Mailchimp Marketing API key
- **Settings → Secrets and variables → Actions → Variables** (optional, defaults shown)
  - `MAILCHIMP_SERVER_PREFIX` — e.g. `us4`
  - `IG_HANDLE` — `stemplayer`
  - `TIKTOK_HANDLE` — `stemplayer`
- **Settings → Pages**
  - Build and deployment source: **GitHub Actions**

Once these are set, push to `main` and the deploy workflow will surface the live URL in the Actions tab.

## How the Kano isolation works

We don't yet know how Kano vs Stemplayer is structured inside Mailchimp (separate lists? tags? merge fields?). Rather than block on that, the refresh script:

1. Pulls every list, tag, segment, and merge field via the Mailchimp API and dumps it to `public/data/mailchimp-discovery.json` on every run. Inspect that file to find the actual signal we should split on.
2. Computes `inferredKano = combinedList − (sum of Stemplayer-side segments)` and exposes it in the dashboard with a clear "Inferred" badge and a tooltip showing the derivation.

Once discovery surfaces a real Kano tag or segment, swap the inference for a direct count by editing `fetchMailchimp` in [scripts/refresh-snapshot.mjs](scripts/refresh-snapshot.mjs).

## Caveats

- **IG / TikTok scraping is best-effort.** Both platforms actively fight scraping and change their markup. If a scrape fails, the previous snapshot's value is preserved and a warning is surfaced in the JSON. Reels view counts in particular may not always be exposed in the public HTML — fall back to opening the post directly when the strip looks empty.
- The "Inferred Kano" figure assumes the four Stemplayer-side segments are subsets of the combined 458,641 list and don't significantly overlap with each other.
- **Rotate the Mailchimp API key** that was originally pasted into chat — it's now in chat history. Generate a fresh one in Mailchimp and store the new value in the GitHub Actions secret.

## File map

- [`app/page.tsx`](app/page.tsx) — bento composition
- [`app/components/MailchimpTile.tsx`](app/components/MailchimpTile.tsx) — segment filter + audience grid
- [`app/lib/snapshot.ts`](app/lib/snapshot.ts) — typed snapshot loader
- [`scripts/refresh-snapshot.mjs`](scripts/refresh-snapshot.mjs) — CI-side data fetcher
- [`public/data/snapshot.json`](public/data/snapshot.json) — what the frontend reads
- [`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml) — daily cron
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — Pages deploy
