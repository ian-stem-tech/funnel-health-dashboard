#!/usr/bin/env node
/**
 * refresh-snapshot.mjs
 *
 * Daily refresh script run by GitHub Actions. Scrapes Instagram + TikTok
 * public profiles, calls Mailchimp for audience counts, and writes
 *   - public/data/snapshot.json     (consumed by the static dashboard)
 *   - public/data/mailchimp-discovery.json (lists/tags/segments dump for
 *     promoting the inferred Kano figure to a direct query later)
 *
 * Graceful fallback: if any source fails we keep the previous snapshot's
 * value for that source and surface the error in the JSON.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, 'public', 'data', 'snapshot.json');
const DISCOVERY_PATH = path.join(ROOT, 'public', 'data', 'mailchimp-discovery.json');

const IG_HANDLE = process.env.IG_HANDLE || 'stemplayer';
const TIKTOK_HANDLE = process.env.TIKTOK_HANDLE || 'stemplayer';
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us4';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const COMMON_HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function readPrevious() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { ...COMMON_HEADERS, ...extraHeaders },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return await res.text();
}

/* ============================================================
 * Instagram public profile scrape
 * ============================================================ */
async function scrapeInstagram(handle, previous) {
  try {
    const html = await fetchText(`https://www.instagram.com/${handle}/`);

    // og:description usually looks like:
    //   "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from..."
    const ogMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    let followers = previous?.followers ?? 0;
    if (ogMatch) {
      const followerMatch = ogMatch[1].match(/([\d.,KMB]+)\s+Followers/i);
      if (followerMatch) followers = parseAbbreviated(followerMatch[1]);
    }

    // Try to extract recent reels from inline JSON. Instagram serves a
    // big inline blob with edges; this regex is best-effort.
    const reels = [];
    const shortcodeMatches = [...html.matchAll(/"shortcode":"([A-Za-z0-9_-]+)"/g)];
    const playCountMatches = [...html.matchAll(/"play_count":(\d+)/g)];
    const thumbMatches = [...html.matchAll(/"display_url":"([^"]+)"/g)];

    const seen = new Set();
    for (let i = 0; i < shortcodeMatches.length && reels.length < 3; i++) {
      const shortcode = shortcodeMatches[i][1];
      if (seen.has(shortcode)) continue;
      seen.add(shortcode);
      const views = playCountMatches[i] ? Number(playCountMatches[i][1]) : 0;
      const thumbnail = thumbMatches[i]
        ? thumbMatches[i][1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
        : '';
      reels.push({
        shortcode,
        thumbnail,
        views,
        url: `https://www.instagram.com/reel/${shortcode}/`,
      });
    }

    return {
      handle,
      followers,
      reels: reels.length > 0 ? reels : previous?.reels ?? [],
    };
  } catch (err) {
    console.warn('[instagram]', err.message);
    return {
      handle,
      followers: previous?.followers ?? 0,
      reels: previous?.reels ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * TikTok public profile scrape
 * ============================================================ */
async function scrapeTikTok(handle, previous) {
  try {
    const html = await fetchText(`https://www.tiktok.com/@${handle}`);

    // TikTok ships state as <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{...}</script>
    const blobMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!blobMatch) {
      throw new Error('Could not find rehydration data blob');
    }
    const blob = JSON.parse(blobMatch[1]);
    const scope = blob?.__DEFAULT_SCOPE__ ?? {};
    const userDetail = scope['webapp.user-detail'];
    const userPostList = scope['webapp.user-post'];

    const followers = userDetail?.userInfo?.stats?.followerCount ?? previous?.followers ?? 0;

    const items = userPostList?.itemList ?? userDetail?.userInfo?.itemList ?? [];
    const videos = items.slice(0, 3).map((item) => ({
      id: String(item.id),
      thumbnail: item?.video?.cover ?? item?.video?.originCover ?? '',
      views: item?.stats?.playCount ?? 0,
      url: `https://www.tiktok.com/@${handle}/video/${item.id}`,
    }));

    return {
      handle,
      followers,
      videos: videos.length > 0 ? videos : previous?.videos ?? [],
    };
  } catch (err) {
    console.warn('[tiktok]', err.message);
    return {
      handle,
      followers: previous?.followers ?? 0,
      videos: previous?.videos ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * Mailchimp
 * ============================================================ */

const SEED_AUDIENCES = [
  {
    key: 'kano_stemplayer_combined',
    label: 'Kano + Stemplayer subscribers (raw list)',
    count: 458641,
    side: 'combined',
  },
  {
    key: 'stemplayer_purchasers',
    label: 'Stemplayer Purchasers',
    count: 84114,
    side: 'stemplayer',
  },
  {
    key: 'stem2_high_spenders',
    label: 'Stem 2 High spenders (no projector buyers)',
    count: 9507,
    side: 'stemplayer',
  },
  {
    key: 'stemplayer_no_purchase',
    label: 'Stemplayer Subscribed, no purchase',
    count: 8224,
    side: 'stemplayer',
  },
  {
    key: 'stem2_product_interest',
    label: 'Stem 2 Product interest',
    count: 27329,
    side: 'stemplayer',
  },
];

function mailchimpAuthHeaders() {
  const token = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function mailchimpGet(path, query = {}) {
  const base = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;
  const qs = new URLSearchParams(query).toString();
  const url = `${base}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: mailchimpAuthHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchimp ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchMailchimp(previous) {
  if (!MAILCHIMP_API_KEY) {
    console.warn('[mailchimp] MAILCHIMP_API_KEY not set, using previous/seed data');
    return previous?.mailchimp ?? buildMailchimpFromSeed();
  }

  try {
    const [lists, _ping] = await Promise.all([
      mailchimpGet('/lists', { count: 100, fields: 'lists.id,lists.name,lists.stats' }),
      mailchimpGet('/ping'),
    ]);

    const discovery = { generatedAt: new Date().toISOString(), lists: [] };
    for (const list of lists.lists ?? []) {
      const [tags, segments, mergeFields] = await Promise.all([
        mailchimpGet(`/lists/${list.id}/tag-search`).catch(() => ({ tags: [] })),
        mailchimpGet(`/lists/${list.id}/segments`, { count: 100 }).catch(() => ({
          segments: [],
        })),
        mailchimpGet(`/lists/${list.id}/merge-fields`).catch(() => ({ merge_fields: [] })),
      ]);
      discovery.lists.push({
        id: list.id,
        name: list.name,
        member_count: list.stats?.member_count ?? null,
        tags: tags.tags ?? [],
        segments: (segments.segments ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          member_count: s.member_count,
        })),
        merge_fields: (mergeFields.merge_fields ?? []).map((m) => ({
          tag: m.tag,
          name: m.name,
          type: m.type,
        })),
      });
    }

    await fs.writeFile(DISCOVERY_PATH, JSON.stringify(discovery, null, 2) + '\n');

    // We don't yet know how the user labels Kano vs Stemplayer in their account,
    // so until discovery shows us a clear signal we keep the seed audience
    // counts and update only what we can correlate.
    const audiences = SEED_AUDIENCES.map((a) => ({ ...a }));

    for (const a of audiences) {
      const matchingList = discovery.lists.find(
        (l) => l.name && a.label.toLowerCase().includes(l.name.toLowerCase()),
      );
      if (matchingList?.member_count != null) {
        a.count = matchingList.member_count;
      }
    }

    return computeMailchimp(audiences);
  } catch (err) {
    console.warn('[mailchimp]', err.message);
    const base = previous?.mailchimp ?? buildMailchimpFromSeed();
    return { ...base, error: err.message };
  }
}

function computeMailchimp(audiences) {
  const combined =
    audiences.find((a) => a.key === 'kano_stemplayer_combined')?.count ?? 0;
  const stemplayerSide = audiences
    .filter((a) => a.side === 'stemplayer')
    .reduce((sum, a) => sum + a.count, 0);

  const inferredKano = Math.max(combined - stemplayerSide, 0);
  const derivation = `${combined.toLocaleString()} - (${audiences
    .filter((a) => a.side === 'stemplayer')
    .map((a) => a.count.toLocaleString())
    .join(' + ')})`;

  const enriched = [
    {
      key: 'inferred_kano',
      label: 'Inferred Kano subscribers',
      count: inferredKano,
      side: 'kano',
      inferred: true,
      derivation,
    },
    ...audiences,
  ];

  const cumulativeRaw = enriched.reduce((sum, a) => sum + a.count, 0);

  return {
    cumulativeRaw,
    cumulativeDisjoint: combined,
    audiences: enriched,
  };
}

function buildMailchimpFromSeed() {
  return computeMailchimp(SEED_AUDIENCES.map((a) => ({ ...a })));
}

/* ============================================================
 * Helpers
 * ============================================================ */
function parseAbbreviated(s) {
  const trimmed = s.replace(/,/g, '').trim();
  const m = trimmed.match(/^([\d.]+)\s*([KMB]?)$/i);
  if (!m) return Number(trimmed) || 0;
  const n = parseFloat(m[1]);
  const suffix = m[2].toUpperCase();
  if (suffix === 'K') return Math.round(n * 1_000);
  if (suffix === 'M') return Math.round(n * 1_000_000);
  if (suffix === 'B') return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

/* ============================================================
 * Main
 * ============================================================ */
async function main() {
  const previous = await readPrevious();

  console.log('Refreshing Instagram, TikTok, Mailchimp...');
  const [instagram, tiktok, mailchimp] = await Promise.all([
    scrapeInstagram(IG_HANDLE, previous?.instagram),
    scrapeTikTok(TIKTOK_HANDLE, previous?.tiktok),
    fetchMailchimp(previous),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    instagram,
    tiktok,
    mailchimp,
  };

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Wrote ${SNAPSHOT_PATH}`);
  console.log(
    `  IG followers: ${snapshot.instagram.followers}, reels: ${snapshot.instagram.reels.length}`,
  );
  console.log(
    `  TikTok followers: ${snapshot.tiktok.followers}, videos: ${snapshot.tiktok.videos.length}`,
  );
  console.log(
    `  Mailchimp combined: ${snapshot.mailchimp.cumulativeDisjoint}, audiences: ${snapshot.mailchimp.audiences.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
