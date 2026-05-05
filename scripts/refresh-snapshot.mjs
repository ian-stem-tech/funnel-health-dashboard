#!/usr/bin/env node
/**
 * refresh-snapshot.mjs
 *
 * Daily refresh script run by GitHub Actions.
 *   - Instagram: Playwright headless browser (reels page)
 *   - TikTok:    Official Display API v2 (/v2/video/list/)
 *   - Mailchimp: REST API with rate-limit-aware retries
 *
 * Writes:
 *   - public/data/snapshot.json
 *   - public/data/history.json
 *   - public/data/mailchimp-discovery.json
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, 'public', 'data', 'snapshot.json');
const HISTORY_PATH = path.join(ROOT, 'public', 'data', 'history.json');
const DISCOVERY_PATH = path.join(ROOT, 'public', 'data', 'mailchimp-discovery.json');

const IG_HANDLE = process.env.IG_HANDLE || 'stemplayer';
const TIKTOK_HANDLE = process.env.TIKTOK_HANDLE || 'stemplayer';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us4';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const TIKTOK_REFRESH_TOKEN = process.env.TIKTOK_REFRESH_TOKEN;

const HISTORY_MAX_DAYS = 90;

/* ============================================================
 * Retry helper with exponential backoff (handles 429)
 * ============================================================ */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, { maxRetries = 3, baseDelay = 2000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : baseDelay * Math.pow(2, attempt);
      console.warn(`[429] Rate limited on ${url}, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await sleep(waitMs);
      continue;
    }

    return res;
  }
  throw new Error(`Rate limited after ${maxRetries + 1} attempts: ${url}`);
}

/* ============================================================
 * File helpers
 * ============================================================ */
async function readPrevious() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

/* ============================================================
 * Shared browser instance (Instagram only)
 * ============================================================ */
let _browser = null;

async function getBrowser() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/* ============================================================
 * Instagram public profile scrape (Playwright)
 * ============================================================ */
async function scrapeInstagram(handle, previous) {
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(`https://www.instagram.com/${handle}/reels/`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });

    await page.waitForTimeout(4000);

    let followers = previous?.followers ?? 0;
    try {
      const ogDesc = await page.$eval(
        'meta[property="og:description"]',
        (el) => el.getAttribute('content') || '',
      );
      const followerMatch = ogDesc.match(/([\d.,KMB]+)\s+Followers/i);
      if (followerMatch) followers = parseAbbreviated(followerMatch[1]);
    } catch {
      const bodyText = await page.textContent('body');
      const match = bodyText?.match(/([\d.,KMB]+)\s+followers/i);
      if (match) followers = parseAbbreviated(match[1]);
    }

    const reels = await page.evaluate(() => {
      const results = [];
      const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
      const seen = new Set();

      for (const link of reelLinks) {
        if (results.length >= 20) break;
        const href = link.getAttribute('href') || '';
        const shortcodeMatch = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
        if (!shortcodeMatch) continue;
        const shortcode = shortcodeMatch[1];
        if (seen.has(shortcode)) continue;
        seen.add(shortcode);

        let views = 0;
        const viewText = link.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
        const viewMatch = viewText.match(/([\d,]+)\s*(views|plays)/i);
        if (viewMatch) {
          views = parseInt(viewMatch[1].replace(/,/g, ''), 10) || 0;
        }
        if (!views) {
          const spans = link.querySelectorAll('span');
          for (const span of spans) {
            const txt = span.textContent?.trim() || '';
            const numMatch = txt.match(/^([\d.,]+[KMB]?)$/i);
            if (numMatch && !txt.includes('@') && !txt.includes('/')) {
              const parsed = parseFloat(txt.replace(/,/g, ''));
              const suffix = txt.slice(-1).toUpperCase();
              if (suffix === 'K') views = Math.round(parsed * 1000);
              else if (suffix === 'M') views = Math.round(parsed * 1000000);
              else if (suffix === 'B') views = Math.round(parsed * 1000000000);
              else if (!isNaN(parsed)) views = Math.round(parsed);
              if (views > 0) break;
            }
          }
        }

        const img = link.querySelector('img');
        const thumbnail = img?.getAttribute('src') || '';

        results.push({
          shortcode,
          thumbnail,
          views,
          url: `https://www.instagram.com/reel/${shortcode}/`,
        });
      }
      return results;
    });

    await context.close();

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
 * TikTok Display API v2
 *
 * Uses the official /v2/video/list/ endpoint (requires OAuth).
 * Falls back to previous data if credentials are missing.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET,
 *   TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN
 * ============================================================ */

async function refreshTikTokToken() {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REFRESH_TOKEN) {
    return null;
  }
  try {
    const res = await fetchWithRetry('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: TIKTOK_REFRESH_TOKEN,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      console.log('[tiktok] Token refreshed successfully');
      return data.access_token;
    }
    console.warn('[tiktok] Token refresh response:', JSON.stringify(data).slice(0, 200));
    return null;
  } catch (err) {
    console.warn('[tiktok] Token refresh failed:', err.message);
    return null;
  }
}

async function fetchTikTok(handle, previous) {
  // Try to get a valid access token
  let accessToken = TIKTOK_ACCESS_TOKEN;

  if (!accessToken && TIKTOK_REFRESH_TOKEN) {
    accessToken = await refreshTikTokToken();
  }

  if (!accessToken) {
    console.warn('[tiktok] No TikTok API credentials, using previous data');
    return {
      handle,
      followers: previous?.followers ?? 0,
      videos: previous?.videos ?? [],
      error: 'No TikTok API credentials configured',
    };
  }

  try {
    // Try refreshing the token first in case the current one expired
    const refreshedToken = await refreshTikTokToken();
    if (refreshedToken) accessToken = refreshedToken;

    // Fetch user info for follower count
    let followers = previous?.followers ?? 0;
    try {
      const userRes = await fetchWithRetry(
        'https://open.tiktokapis.com/v2/user/info/?fields=follower_count,display_name',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const userData = await userRes.json();
      if (userData?.data?.user?.follower_count) {
        followers = userData.data.user.follower_count;
      }
    } catch (userErr) {
      console.warn('[tiktok] user/info failed:', userErr.message);
    }

    await sleep(500);

    // Fetch 20 most recent videos
    const videoFields = [
      'id', 'title', 'video_description', 'duration',
      'cover_image_url', 'share_url', 'view_count',
      'like_count', 'comment_count', 'share_count', 'create_time',
    ].join(',');

    const videoRes = await fetchWithRetry(
      `https://open.tiktokapis.com/v2/video/list/?fields=${videoFields}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20 }),
      },
    );

    const videoData = await videoRes.json();

    if (videoData?.error?.code && videoData.error.code !== 'ok') {
      throw new Error(`TikTok API: ${videoData.error.code} - ${videoData.error.message}`);
    }

    const videoList = videoData?.data?.videos ?? [];
    const videos = videoList.map((v) => ({
      id: String(v.id),
      thumbnail: v.cover_image_url ?? '',
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
      title: v.title ?? '',
      url: v.share_url ?? `https://www.tiktok.com/@${handle}/video/${v.id}`,
      createdAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : '',
    }));

    console.log(`[tiktok] API returned ${videos.length} videos`);

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
 * Mailchimp (with rate-limit retries)
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

async function mailchimpGet(reqPath, query = {}) {
  const base = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;
  const qs = new URLSearchParams(query).toString();
  const url = `${base}${reqPath}${qs ? `?${qs}` : ''}`;
  const res = await fetchWithRetry(url, { headers: mailchimpAuthHeaders() });
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

    // Process lists sequentially with a small delay to avoid rate limits
    for (const list of lists.lists ?? []) {
      await sleep(300);
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

    const audiences = SEED_AUDIENCES.map((a) => ({ ...a }));

    for (const a of audiences) {
      const matchingList = discovery.lists.find(
        (l) => l.name && a.label.toLowerCase().includes(l.name.toLowerCase()),
      );
      if (matchingList?.member_count != null) {
        a.count = matchingList.member_count;
      }
    }

    // Fetch subscriber locations (with delay between lists)
    let mailchimpLocations = [];
    for (const list of lists.lists ?? []) {
      await sleep(300);
      try {
        const locData = await mailchimpGet(`/lists/${list.id}/locations`);
        const locs = (locData.locations ?? locData ?? [])
          .filter((l) => l.country && l.country_code)
          .map((l) => ({
            country: l.country,
            cc: l.country_code,
            count: l.total ?? l.member_count ?? 0,
            percent: l.percent ?? 0,
          }));
        for (const loc of locs) {
          const existing = mailchimpLocations.find((e) => e.cc === loc.cc);
          if (existing) {
            existing.count += loc.count;
            existing.percent = 0;
          } else {
            mailchimpLocations.push({ ...loc });
          }
        }
      } catch (locErr) {
        console.warn(`[mailchimp] locations for ${list.id}:`, locErr.message);
      }
    }
    mailchimpLocations.sort((a, b) => b.count - a.count);

    const result = computeMailchimp(audiences);
    result.mailchimpLocations = mailchimpLocations;
    return result;
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

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
 * History accumulation
 * ============================================================ */
async function appendHistory(instagram, tiktok) {
  const history = await readHistory();
  const today = todayDateString();

  const totalReelViews = (instagram.reels ?? []).reduce((s, r) => s + (r.views || 0), 0);
  const totalVideoViews = (tiktok.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);

  const entry = {
    date: today,
    instagram: {
      followers: instagram.followers,
      totalReelViews,
      reels: (instagram.reels ?? []).map((r) => ({
        shortcode: r.shortcode,
        thumbnail: r.thumbnail,
        views: r.views,
        url: r.url,
      })),
    },
    tiktok: {
      followers: tiktok.followers,
      totalVideoViews,
      videos: (tiktok.videos ?? []).map((v) => ({
        id: v.id,
        thumbnail: v.thumbnail,
        views: v.views,
        url: v.url,
      })),
    },
  };

  const existing = history.entries.filter((e) => e.date !== today);
  existing.push(entry);

  existing.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = existing.slice(-HISTORY_MAX_DAYS);

  const updated = { entries: trimmed };
  await fs.writeFile(HISTORY_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`  History: ${trimmed.length} entries (appended ${today})`);
}

/* ============================================================
 * Main
 * ============================================================ */
async function main() {
  const previous = await readPrevious();

  console.log('Refreshing Instagram, TikTok, Mailchimp...');

  // Mailchimp runs in parallel; IG uses the browser; TikTok uses the API
  const mailchimpPromise = fetchMailchimp(previous);
  const tiktokPromise = fetchTikTok(TIKTOK_HANDLE, previous?.tiktok);
  const instagram = await scrapeInstagram(IG_HANDLE, previous?.instagram);
  await closeBrowser();
  const [tiktok, mailchimp] = await Promise.all([tiktokPromise, mailchimpPromise]);

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

  await appendHistory(instagram, tiktok);
}

main().catch((err) => {
  closeBrowser().catch(() => {});
  console.error(err);
  process.exit(1);
});
