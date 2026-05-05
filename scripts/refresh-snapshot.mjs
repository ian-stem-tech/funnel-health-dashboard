#!/usr/bin/env node
/**
 * refresh-snapshot.mjs
 *
 * Daily refresh script run by GitHub Actions.
 *   - Instagram: Playwright headless browser (reels page)
 *   - TikTok:    Playwright headless browser (profile page)
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
 * Shared browser instance
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
 * Instagram scrape — multi-strategy approach
 *
 * Strategy 1: Instagram mobile API (i.instagram.com)
 * Strategy 2: Playwright with network interception (captures
 *             the GraphQL/API responses the page itself fetches)
 * Strategy 3: Playwright DOM parsing (last resort)
 *
 * Each strategy falls through to the next on failure.
 * ============================================================ */

const IG_APP_ID = '936619743392459';

const IG_API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'X-IG-App-ID': IG_APP_ID,
  'X-Requested-With': 'XMLHttpRequest',
  Accept: '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  Referer: 'https://www.instagram.com/',
};

// Strategy 1: Instagram web APIs (no browser needed)
//   Step A: web_profile_info for followers + user ID + initial view counts
//   Step B: feed/user paginated for all videos with real-time view counts
async function igWebApis(handle) {
  console.log('[instagram] Strategy 1: web APIs');

  // Step A: profile info for followers, user ID, and baseline view counts
  const profileRes = await fetchWithRetry(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`,
    { headers: IG_API_HEADERS },
    { maxRetries: 2, baseDelay: 3000 },
  );
  if (!profileRes.ok) throw new Error(`Profile API ${profileRes.status}`);
  const profileJson = await profileRes.json();
  const user = profileJson?.data?.user;
  if (!user) throw new Error('No user object in profile API response');

  const userId = user.id;
  const followers = user.edge_followed_by?.count ?? 0;

  // Build a map of shortcode -> view count from the profile response
  // (the profile API returns view counts for older videos that the feed API misses)
  const profileViewCounts = new Map();
  for (const edges of [
    user.edge_felix_video_timeline?.edges ?? [],
    (user.edge_owner_to_timeline_media?.edges ?? []).filter((e) => e.node?.is_video),
  ]) {
    for (const e of edges) {
      const sc = e.node?.shortcode;
      const views = e.node?.video_view_count;
      if (sc && views) profileViewCounts.set(sc, views);
    }
  }

  await sleep(1000);

  // Step B: paginate feed/user to get all video posts with real-time view counts
  const allVideos = [];
  let maxId = '';
  let page = 0;

  while (page < 5 && allVideos.length < 30) {
    const feedUrl =
      `https://www.instagram.com/api/v1/feed/user/${userId}/?count=30` +
      (maxId ? `&max_id=${maxId}` : '');
    const feedRes = await fetchWithRetry(
      feedUrl,
      { headers: { ...IG_API_HEADERS, Referer: `https://www.instagram.com/${handle}/` } },
    );
    if (!feedRes.ok) {
      console.warn(`[instagram] Feed page ${page + 1} returned ${feedRes.status}`);
      break;
    }
    const feedJson = await feedRes.json();
    const items = feedJson.items ?? [];

    for (const item of items) {
      if (item.media_type !== 2) continue; // only videos
      const shortcode = item.code;
      if (!shortcode) continue;
      if (allVideos.some((v) => v.shortcode === shortcode)) continue;

      // Prefer feed play_count (real-time), fall back to profile view count
      const views = item.play_count ?? profileViewCounts.get(shortcode) ?? 0;
      const thumb =
        item.image_versions2?.candidates?.[0]?.url ??
        item.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ??
        '';

      allVideos.push({
        shortcode,
        thumbnail: thumb,
        views,
        timestamp: item.taken_at ?? 0,
        url: `https://www.instagram.com/reel/${shortcode}/`,
      });
    }

    page++;
    if (!feedJson.more_available || !feedJson.next_max_id) break;
    maxId = feedJson.next_max_id;
    await sleep(1000);
  }

  // Also add any reels from the profile API that the feed missed
  for (const [sc, views] of profileViewCounts) {
    if (allVideos.some((v) => v.shortcode === sc)) continue;
    allVideos.push({
      shortcode: sc,
      thumbnail: '',
      views,
      timestamp: 0,
      url: `https://www.instagram.com/reel/${sc}/`,
    });
  }

  // Sort newest first
  allVideos.sort((a, b) => b.timestamp - a.timestamp);
  const reels = allVideos.slice(0, 30).map(({ timestamp, ...rest }) => rest);

  console.log(`[instagram] Web APIs: ${followers} followers, ${reels.length} reels (${page} feed pages)`);
  return { followers, reels };
}

// Strategy 2: Playwright with network interception
async function igNetworkIntercept(handle) {
  console.log('[instagram] Strategy 2: Playwright + network interception');
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();
  const capturedData = { followers: 0, reels: [] };

  // Intercept XHR/fetch responses from Instagram's API
  page.on('response', async (response) => {
    const url = response.url();
    try {
      if (
        url.includes('/graphql/query') ||
        url.includes('/api/v1/clips/') ||
        url.includes('/api/v1/feed/reels_media') ||
        url.includes('web_profile_info')
      ) {
        const json = await response.json();
        extractIgDataFromResponse(json, capturedData);
      }
    } catch {
      // Not JSON or parse error, ignore
    }
  });

  await page.goto(`https://www.instagram.com/${handle}/reels/`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  // Wait for API calls to complete
  await page.waitForTimeout(6000);

  // Scroll down to trigger more loads
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(3000);

  // Also try parsing embedded JSON from the page HTML
  try {
    const pageContent = await page.content();
    extractIgDataFromHtml(pageContent, capturedData, handle);
  } catch {
    // Ignore
  }

  // Fallback: try og:description for followers
  if (capturedData.followers === 0) {
    try {
      const ogDesc = await page.$eval(
        'meta[property="og:description"]',
        (el) => el.getAttribute('content') || '',
      );
      const m = ogDesc.match(/([\d.,KMB]+)\s+Followers/i);
      if (m) capturedData.followers = parseAbbreviated(m[1]);
    } catch {
      // Ignore
    }
  }

  // Fallback: DOM parsing for reel links
  if (capturedData.reels.length === 0) {
    const domReels = await igDomParse(page);
    if (domReels.length > 0) capturedData.reels = domReels;
  }

  await context.close();
  console.log(
    `[instagram] Network intercept: ${capturedData.followers} followers, ${capturedData.reels.length} reels`,
  );
  return capturedData;
}

function extractIgDataFromResponse(json, out) {
  // GraphQL user data
  const user =
    json?.data?.user ??
    json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.user ??
    null;
  if (user?.edge_followed_by?.count) {
    out.followers = user.edge_followed_by.count;
  }
  if (user?.follower_count) {
    out.followers = user.follower_count;
  }

  // Reels from GraphQL edges
  const edges =
    user?.edge_felix_video_timeline?.edges ??
    json?.data?.xdt_api__v1__clips__user__connection_v2?.edges ??
    [];
  for (const e of edges) {
    const node = e.node?.media ?? e.node;
    if (!node?.shortcode && !node?.code) continue;
    const shortcode = node.shortcode ?? node.code;
    if (out.reels.some((r) => r.shortcode === shortcode)) continue;
    out.reels.push({
      shortcode,
      thumbnail: node.thumbnail_src ?? node.display_url ?? node.image_versions2?.candidates?.[0]?.url ?? '',
      views: node.video_view_count ?? node.play_count ?? node.video_play_count ?? 0,
      url: `https://www.instagram.com/reel/${shortcode}/`,
    });
  }

  // Reels from clips/feed API response
  const items = json?.items ?? json?.data?.items ?? [];
  for (const item of items) {
    const media = item.media ?? item;
    const shortcode = media.code ?? media.shortcode;
    if (!shortcode) continue;
    if (out.reels.some((r) => r.shortcode === shortcode)) continue;
    out.reels.push({
      shortcode,
      thumbnail: media.image_versions2?.candidates?.[0]?.url ?? '',
      views: media.play_count ?? media.video_view_count ?? 0,
      url: `https://www.instagram.com/reel/${shortcode}/`,
    });
  }

  // Cap at 20
  if (out.reels.length > 20) out.reels.length = 20;
}

function extractIgDataFromHtml(html, out, handle) {
  // Try to find JSON blobs embedded in script tags
  const patterns = [
    /window\._sharedData\s*=\s*({[\s\S]*?});<\/script>/,
    /window\.__additionalDataLoaded\s*\([^,]*,\s*({[\s\S]*?})\s*\)/,
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      try {
        const json = JSON.parse(match[1]);
        extractIgDataFromResponse(json, out);
        // Also check nested entry_data
        const profilePage = json?.entry_data?.ProfilePage?.[0];
        if (profilePage) extractIgDataFromResponse(profilePage, out);
      } catch {
        // Not valid JSON
      }
    }
  }

  // Regex fallback: extract shortcodes and play_counts from raw HTML
  if (out.reels.length === 0) {
    const shortcodes = [...html.matchAll(/"shortcode":"([A-Za-z0-9_-]+)"/g)];
    const playCounts = [...html.matchAll(/"(?:play_count|video_view_count)":(\d+)/g)];
    const thumbs = [...html.matchAll(/"(?:thumbnail_src|display_url)":"([^"]+)"/g)];
    const seen = new Set();

    for (let i = 0; i < shortcodes.length && out.reels.length < 20; i++) {
      const sc = shortcodes[i][1];
      if (seen.has(sc)) continue;
      seen.add(sc);
      out.reels.push({
        shortcode: sc,
        thumbnail: thumbs[i]
          ? thumbs[i][1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
          : '',
        views: playCounts[i] ? Number(playCounts[i][1]) : 0,
        url: `https://www.instagram.com/reel/${sc}/`,
      });
    }
  }
}

// Strategy 3 (inline): basic DOM link parsing
async function igDomParse(page) {
  return page.evaluate(() => {
    const results = [];
    const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
    const seen = new Set();
    for (const link of reelLinks) {
      if (results.length >= 20) break;
      const href = link.getAttribute('href') || '';
      const m = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
      if (!m) continue;
      const shortcode = m[1];
      if (seen.has(shortcode)) continue;
      seen.add(shortcode);

      let views = 0;
      const ariaLabel = link.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
      const vm = ariaLabel.match(/([\d,]+)\s*(views|plays)/i);
      if (vm) views = parseInt(vm[1].replace(/,/g, ''), 10) || 0;
      if (!views) {
        for (const span of link.querySelectorAll('span')) {
          const txt = span.textContent?.trim() || '';
          const nm = txt.match(/^([\d.,]+)([KMB]?)$/i);
          if (nm) {
            const n = parseFloat(nm[1].replace(/,/g, ''));
            const s = (nm[2] || '').toUpperCase();
            if (s === 'K') views = Math.round(n * 1000);
            else if (s === 'M') views = Math.round(n * 1000000);
            else if (s === 'B') views = Math.round(n * 1000000000);
            else views = Math.round(n);
            if (views > 0) break;
          }
        }
      }

      const img = link.querySelector('img');
      results.push({
        shortcode,
        thumbnail: img?.getAttribute('src') || '',
        views,
        url: `https://www.instagram.com/reel/${shortcode}/`,
      });
    }
    return results;
  });
}

// Curated reel shortcodes to track (newest first)
const TRACKED_REELS = [
  'DX9Pez4t9yH',
  'DX34l4cNKEN',
  'DXzhXkwt0Cs',
  'DXxnIA_oIgk',
  'DXxKJc4N8ee',
  'DXxDDcyNdpp',
  'DXw9hQjtCi9',
  'DXwhfxoMfzl',
  'DXpwp-gDNzo',
  'DXpf4IrkiJI',
  'DXpJAghD0g6',
];

// Fetch reel metadata via Instagram oEmbed (public, no auth needed)
async function igOEmbed(shortcode) {
  const url = `https://www.instagram.com/api/v1/oembed/?url=https://www.instagram.com/reel/${shortcode}/`;
  const res = await fetchWithRetry(url, {}, { maxRetries: 2, baseDelay: 2000 });
  if (!res.ok) throw new Error(`oEmbed ${res.status} for ${shortcode}`);
  return res.json();
}

// Fetch all tracked reels via oEmbed with embed HTML
async function fetchTrackedReels(previous) {
  console.log(`[instagram] Fetching ${TRACKED_REELS.length} tracked reels via oEmbed`);
  const reels = [];
  const previousMap = new Map((previous?.reels ?? []).map((r) => [r.shortcode, r]));

  for (const shortcode of TRACKED_REELS) {
    try {
      const data = await igOEmbed(shortcode);
      reels.push({
        shortcode,
        thumbnail: data.thumbnail_url ?? '',
        title: data.title ?? '',
        views: 0,
        url: `https://www.instagram.com/reel/${shortcode}/`,
        embedHtml: data.html ?? '',
      });
      await sleep(400);
    } catch (err) {
      console.warn(`[instagram] oEmbed failed for ${shortcode}:`, err.message);
      // Fall back to previous data for this reel if available
      const prev = previousMap.get(shortcode);
      if (prev) {
        reels.push(prev);
      } else {
        reels.push({
          shortcode,
          thumbnail: '',
          title: '',
          views: 0,
          url: `https://www.instagram.com/reel/${shortcode}/`,
          embedHtml: '',
        });
      }
    }
  }

  console.log(`[instagram] oEmbed: ${reels.filter((r) => r.embedHtml).length}/${reels.length} with embed HTML`);
  return reels;
}

// Orchestrator
async function scrapeInstagram(handle, previous) {
  let followers = previous?.followers ?? 0;
  const errors = [];

  // Get follower count from the profile API
  try {
    const result = await igWebApis(handle);
    if (result.followers > 0) followers = result.followers;
  } catch (err) {
    console.warn('[instagram] Profile API failed:', err.message);
    errors.push(`Profile: ${err.message}`);
  }

  await sleep(1000);

  // Fetch tracked reels via oEmbed
  const reels = await fetchTrackedReels(previous);

  console.log(`[instagram] Final: ${followers} followers, ${reels.length} reels`);

  return {
    handle,
    followers,
    reels,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  };
}

/* ============================================================
 * TikTok public profile scrape (Playwright)
 * ============================================================ */
async function scrapeTikTok(handle, previous) {
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(`https://www.tiktok.com/@${handle}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });

    await page.waitForTimeout(4000);

    let followers = previous?.followers ?? 0;
    let videos = [];

    // Primary: extract from the rehydration JSON blob
    try {
      const blobContent = await page.$eval(
        'script#__UNIVERSAL_DATA_FOR_REHYDRATION__',
        (el) => el.textContent || '',
      );
      if (blobContent) {
        const blob = JSON.parse(blobContent);
        const scope = blob?.__DEFAULT_SCOPE__ ?? {};
        const userDetail = scope['webapp.user-detail'];
        const userPostList = scope['webapp.user-post'];

        followers = userDetail?.userInfo?.stats?.followerCount ?? followers;

        const items = userPostList?.itemList ?? userDetail?.userInfo?.itemList ?? [];
        videos = items.slice(0, 20).map((item) => ({
          id: String(item.id),
          thumbnail: item?.video?.cover ?? item?.video?.originCover ?? '',
          views: item?.stats?.playCount ?? 0,
          url: `https://www.tiktok.com/@${handle}/video/${item.id}`,
        }));
      }
    } catch {
      // Blob not available, fall through to DOM extraction
    }

    // Fallback: extract from the rendered DOM
    if (videos.length === 0) {
      const domData = await page.evaluate((profileHandle) => {
        const results = [];
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');
        const seen = new Set();

        for (const link of videoLinks) {
          if (results.length >= 20) break;
          const href = link.getAttribute('href') || '';
          const idMatch = href.match(/\/video\/(\d+)/);
          if (!idMatch) continue;
          const id = idMatch[1];
          if (seen.has(id)) continue;
          seen.add(id);

          let views = 0;
          const strongEl = link.querySelector('strong');
          if (strongEl) {
            const txt = strongEl.textContent?.trim() || '';
            const parsed = parseFloat(txt.replace(/,/g, ''));
            const suffix = txt.slice(-1).toUpperCase();
            if (suffix === 'K') views = Math.round(parsed * 1000);
            else if (suffix === 'M') views = Math.round(parsed * 1000000);
            else if (suffix === 'B') views = Math.round(parsed * 1000000000);
            else if (!isNaN(parsed)) views = Math.round(parsed);
          }

          const img = link.querySelector('img');
          const thumbnail = img?.getAttribute('src') || '';

          results.push({
            id,
            thumbnail,
            views,
            url: `https://www.tiktok.com/@${profileHandle}/video/${id}`,
          });
        }
        return results;
      }, handle);

      if (domData.length > 0) videos = domData;
    }

    // Try follower count from DOM if the blob didn't have it
    if (followers === (previous?.followers ?? 0)) {
      try {
        const followerText = await page.$eval(
          '[data-e2e="followers-count"]',
          (el) => el.textContent || '',
        );
        if (followerText) followers = parseAbbreviated(followerText.trim());
      } catch {
        // Keep previous value
      }
    }

    await context.close();

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

  // Mailchimp runs in parallel; IG + TikTok share the browser sequentially
  const mailchimpPromise = fetchMailchimp(previous);
  const instagram = await scrapeInstagram(IG_HANDLE, previous?.instagram);
  await sleep(2000);
  const tiktok = await scrapeTikTok(TIKTOK_HANDLE, previous?.tiktok);
  await closeBrowser();
  const mailchimp = await mailchimpPromise;

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
