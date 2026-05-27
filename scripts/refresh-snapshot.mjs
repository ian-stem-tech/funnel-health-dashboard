#!/usr/bin/env node
/**
 * refresh-snapshot.mjs
 *
 * Daily refresh script run by GitHub Actions.
 * Actor IDs and inputs are loaded from config/apify-actors.json.
 *
 *   - Instagram:      Apify actor (reels with likes/comments/saves/views)
 *   - TikTok:         Apify actor (profile + videos with likes/comments/shares/views)
 *   - TikTok Hashtag: Apify actor (#stemplayer campaign tracking)
 *   - X/Twitter:      Apify actor (tweets with likes/retweets/replies/views)
 *   - Reddit:         Apify actor (subreddit posts + brand mentions)
 *   - YouTube:        Apify actor (channel stats + videos with views/likes/comments)
 *   - Mailchimp:      REST API with rate-limit-aware retries
 *
 * Writes:
 *   - public/data/snapshot.json
 *   - public/data/history.json
 *   - public/data/mailchimp-discovery.json
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ACTOR_CONFIG = require('../config/apify-actors.json');

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, 'public', 'data', 'snapshot.json');
const HISTORY_PATH = path.join(ROOT, 'public', 'data', 'history.json');
const DISCOVERY_PATH = path.join(ROOT, 'public', 'data', 'mailchimp-discovery.json');
const CACHE_META_PATH = path.join(ROOT, 'public', 'data', 'cache-meta.json');

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us4';

const HISTORY_MAX_DAYS = 90;
const CACHE_COOLDOWN_HOURS = parseInt(process.env.CACHE_COOLDOWN_HOURS ?? '4', 10);
const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true';

/* ============================================================
 * Helpers
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
 * Cache layer — skip actors fetched within the cooldown window
 * ============================================================ */
async function readCacheMeta() {
  try {
    const raw = await fs.readFile(CACHE_META_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCacheMeta(meta) {
  await fs.writeFile(CACHE_META_PATH, JSON.stringify(meta, null, 2) + '\n');
}

function isCacheValid(meta, key) {
  if (FORCE_REFRESH) return false;
  const entry = meta[key];
  if (!entry?.lastFetchedAt) return false;
  const ageMs = Date.now() - new Date(entry.lastFetchedAt).getTime();
  const cooldownMs = CACHE_COOLDOWN_HOURS * 60 * 60 * 1000;
  return ageMs < cooldownMs && entry.status === 'ok';
}

function markCacheEntry(meta, key, status, itemCount = 0) {
  meta[key] = {
    lastFetchedAt: new Date().toISOString(),
    status,
    itemCount,
  };
}

/* ============================================================
 * Apify helper — run an actor synchronously and return results
 * ============================================================ */
async function runApifyActor(actorId, input, { timeoutSecs = 120 } = {}) {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not set');
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSecs}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${APIFY_API_TOKEN}`,
      },
      body: JSON.stringify(input),
    },
    { maxRetries: 2, baseDelay: 5000 },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify ${actorId} returned ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

function loadActorConfig(key) {
  const cfg = ACTOR_CONFIG[key];
  if (!cfg) throw new Error(`No actor config found for key: ${key}`);
  return cfg;
}

/* ============================================================
 * Instagram via Apify (config: instagramReels)
 * ============================================================ */
async function fetchInstagram(previous, cacheMeta) {
  const cfg = loadActorConfig('instagramReels');
  const handle = cfg.account;

  if (!APIFY_API_TOKEN) {
    console.warn('[instagram] APIFY_API_TOKEN not set, using previous data');
    return previous?.instagram ?? { handle, followers: 0, reels: [] };
  }

  if (isCacheValid(cacheMeta, 'instagram')) {
    console.log('[instagram] Cache still valid, skipping fetch');
    return previous?.instagram ?? { handle, followers: 0, reels: [] };
  }

  try {
    console.log(`[instagram] Fetching @${handle} via Apify actor ${cfg.actorId}...`);
    const items = await runApifyActor(cfg.actorId, cfg.input, { timeoutSecs: 180 });

    let followers = previous?.instagram?.followers ?? 0;
    const reels = [];

    for (const p of items ?? []) {
      if (p.followersCount ?? p.ownerFollowerCount) {
        followers = p.followersCount ?? p.ownerFollowerCount;
      }

      const shortcode = p.shortCode ?? p.shortcode ?? p.code ?? p.id ?? '';
      if (shortcode) {
        reels.push({
          shortcode,
          thumbnail: p.displayUrl ?? p.thumbnailUrl ?? p.imageUrl ?? '',
          views: p.videoViewCount ?? p.videoPlayCount ?? p.playCount ?? 0,
          likes: p.likesCount ?? p.likeCount ?? 0,
          comments: p.commentsCount ?? p.commentCount ?? 0,
          saves: p.savesCount ?? p.saveCount ?? 0,
          shares: p.sharesCount ?? p.shareCount ?? 0,
          title: (p.caption ?? p.text ?? '').slice(0, 100),
          url: p.url ?? `https://www.instagram.com/reel/${shortcode}/`,
        });
      }
    }

    console.log(`[instagram] ${followers} followers, ${reels.length} reels`);
    markCacheEntry(cacheMeta, 'instagram', 'ok', reels.length);
    return { handle, followers, reels: reels.slice(0, 30) };
  } catch (err) {
    console.warn('[instagram] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'instagram', 'error');
    return {
      handle,
      followers: previous?.instagram?.followers ?? 0,
      reels: previous?.instagram?.reels ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * TikTok via Apify (config: tiktokProfile)
 * ============================================================ */
async function fetchTikTok(previous, cacheMeta) {
  const cfg = loadActorConfig('tiktokProfile');
  const handle = cfg.account;

  if (!APIFY_API_TOKEN) {
    console.warn('[tiktok] APIFY_API_TOKEN not set, using previous data');
    return previous?.tiktok ?? { handle, followers: 0, videos: [] };
  }

  if (isCacheValid(cacheMeta, 'tiktok')) {
    console.log('[tiktok] Cache still valid, skipping fetch');
    return previous?.tiktok ?? { handle, followers: 0, videos: [] };
  }

  try {
    console.log(`[tiktok] Fetching @${handle} via Apify actor ${cfg.actorId}...`);
    const items = await runApifyActor(cfg.actorId, cfg.input, { timeoutSecs: 180 });

    let followers = previous?.tiktok?.followers ?? 0;
    const videos = [];

    for (const item of items ?? []) {
      if (item.authorMeta?.fans) followers = item.authorMeta.fans;
      if (item.authorStats?.followerCount) followers = item.authorStats.followerCount;

      if (item.id || item.videoId) {
        videos.push({
          id: String(item.id ?? item.videoId),
          thumbnail: item.videoMeta?.coverUrl ?? item.covers?.[0] ?? item.coverUrl ?? '',
          views: item.playCount ?? item.videoMeta?.playCount ?? item.stats?.playCount ?? 0,
          likes: item.diggCount ?? item.likes ?? item.stats?.diggCount ?? 0,
          comments: item.commentCount ?? item.comments ?? item.stats?.commentCount ?? 0,
          shares: item.shareCount ?? item.shares ?? item.stats?.shareCount ?? 0,
          title: (item.text ?? item.desc ?? '').slice(0, 100),
          url: item.webVideoUrl ?? `https://www.tiktok.com/@${handle}/video/${item.id ?? item.videoId}`,
          createdAt: item.createTimeISO ?? item.createTime ? new Date((item.createTime ?? 0) * 1000).toISOString() : undefined,
        });
      }
    }

    console.log(`[tiktok] ${followers} followers, ${videos.length} videos`);
    markCacheEntry(cacheMeta, 'tiktok', 'ok', videos.length);
    return { handle, followers, videos: videos.slice(0, 30) };
  } catch (err) {
    console.warn('[tiktok] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'tiktok', 'error');
    return {
      handle,
      followers: previous?.tiktok?.followers ?? 0,
      videos: previous?.tiktok?.videos ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * TikTok Hashtag via Apify (config: tiktokHashtag)
 * ============================================================ */
async function fetchTikTokHashtag(previous, cacheMeta) {
  const cfg = loadActorConfig('tiktokHashtag');
  const hashtag = cfg.hashtag;

  if (!APIFY_API_TOKEN) {
    console.warn('[tiktok-hashtag] APIFY_API_TOKEN not set, using previous data');
    return previous?.tiktokHashtag ?? { hashtag, videos: [] };
  }

  if (isCacheValid(cacheMeta, 'tiktokHashtag')) {
    console.log('[tiktok-hashtag] Cache still valid, skipping fetch');
    return previous?.tiktokHashtag ?? { hashtag, videos: [] };
  }

  try {
    console.log(`[tiktok-hashtag] Fetching #${hashtag} via Apify actor ${cfg.actorId}...`);
    const items = await runApifyActor(cfg.actorId, cfg.input, { timeoutSecs: 120 });

    const videos = [];

    for (const item of items ?? []) {
      if (item.id || item.videoId) {
        const author = item.authorMeta?.name ?? item.author ?? '';
        videos.push({
          id: String(item.id ?? item.videoId),
          thumbnail: item.videoMeta?.coverUrl ?? item.covers?.[0] ?? item.coverUrl ?? '',
          views: item.playCount ?? item.videoMeta?.playCount ?? 0,
          likes: item.diggCount ?? item.likes ?? 0,
          comments: item.commentCount ?? item.comments ?? 0,
          shares: item.shareCount ?? item.shares ?? 0,
          title: (item.text ?? item.desc ?? '').slice(0, 100),
          author,
          url: item.webVideoUrl ?? `https://www.tiktok.com/@${author}/video/${item.id ?? item.videoId}`,
          createdAt: item.createTimeISO ?? undefined,
        });
      }
    }

    console.log(`[tiktok-hashtag] #${hashtag}: ${videos.length} videos`);
    markCacheEntry(cacheMeta, 'tiktokHashtag', 'ok', videos.length);
    return { hashtag, videos: videos.slice(0, 30) };
  } catch (err) {
    console.warn('[tiktok-hashtag] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'tiktokHashtag', 'error');
    return {
      hashtag,
      videos: previous?.tiktokHashtag?.videos ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * X/Twitter via Apify (config: x)
 * ============================================================ */
async function fetchX(previous, cacheMeta) {
  const cfg = loadActorConfig('x');
  const handle = cfg.account;

  if (!APIFY_API_TOKEN) {
    console.warn('[x] APIFY_API_TOKEN not set, using previous data');
    return previous?.x ?? { handle, followers: 0, tweets: [] };
  }

  if (isCacheValid(cacheMeta, 'x')) {
    console.log('[x] Cache still valid, skipping fetch');
    return previous?.x ?? { handle, followers: 0, tweets: [] };
  }

  try {
    console.log(`[x] Fetching @${handle} via Apify actor ${cfg.actorId}...`);
    const items = await runApifyActor(cfg.actorId, cfg.input, { timeoutSecs: 180 });

    let followers = previous?.x?.followers ?? 0;
    const tweets = [];

    for (const item of items ?? []) {
      if (item.author?.followers) followers = item.author.followers;
      if (item.author?.followersCount) followers = item.author.followersCount;
      if (item.user?.followers_count) followers = item.user.followers_count;

      tweets.push({
        id: item.id ?? item.tweetId ?? item.rest_id ?? '',
        text: (item.text ?? item.full_text ?? item.tweetText ?? '').slice(0, 280),
        likes: item.likeCount ?? item.favorite_count ?? item.favoriteCount ?? 0,
        retweets: item.retweetCount ?? item.retweet_count ?? 0,
        replies: item.replyCount ?? item.reply_count ?? 0,
        views: item.viewCount ?? item.views ?? item.impressionCount ?? 0,
        url: item.url ?? item.tweetUrl ?? `https://x.com/${handle}/status/${item.id ?? item.tweetId}`,
        createdAt: item.createdAt ?? item.created_at ?? item.tweetDate ?? undefined,
      });
    }

    console.log(`[x] ${followers} followers, ${tweets.length} tweets`);
    markCacheEntry(cacheMeta, 'x', 'ok', tweets.length);
    return { handle, followers, tweets: tweets.slice(0, 100) };
  } catch (err) {
    console.warn('[x] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'x', 'error');
    return {
      handle,
      followers: previous?.x?.followers ?? 0,
      tweets: previous?.x?.tweets ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * Reddit via Apify (configs: redditSubreddit + redditMentions)
 * ============================================================ */
function parseRedditPosts(items, source) {
  const posts = [];
  for (const item of items ?? []) {
    if (item.title || item.body) {
      posts.push({
        id: item.id ?? '',
        title: (item.title ?? item.body ?? '').slice(0, 200),
        upvotes: item.upVotes ?? item.score ?? item.ups ?? 0,
        comments: item.numberOfComments ?? item.numComments ?? item.num_comments ?? 0,
        url: item.url ?? '',
        subreddit: item.subreddit ?? item.communityName ?? undefined,
        createdAt: item.createdAt ?? item.created ?? undefined,
        source,
      });
    }
  }
  return posts;
}

async function fetchReddit(previous, cacheMeta) {
  const subCfg = loadActorConfig('redditSubreddit');
  const mentionCfg = loadActorConfig('redditMentions');

  if (!APIFY_API_TOKEN) {
    console.warn('[reddit] APIFY_API_TOKEN not set, using previous data');
    return previous?.reddit ?? { subredditPosts: [], mentions: [] };
  }

  if (isCacheValid(cacheMeta, 'reddit')) {
    console.log('[reddit] Cache still valid, skipping fetch');
    return previous?.reddit ?? { subredditPosts: [], mentions: [] };
  }

  try {
    console.log(`[reddit] Fetching subreddit + mentions via Apify actor ${subCfg.actorId}...`);

    const [subItems, mentionItems] = await Promise.all([
      runApifyActor(subCfg.actorId, subCfg.input, { timeoutSecs: 120 }),
      runApifyActor(mentionCfg.actorId, mentionCfg.input, { timeoutSecs: 120 }),
    ]);

    const subredditPosts = parseRedditPosts(subItems, 'subreddit').slice(0, 20);
    const mentions = parseRedditPosts(mentionItems, 'mention').slice(0, 20);

    console.log(`[reddit] ${subredditPosts.length} subreddit posts, ${mentions.length} mentions`);
    markCacheEntry(cacheMeta, 'reddit', 'ok', subredditPosts.length + mentions.length);
    return { subredditPosts, mentions };
  } catch (err) {
    console.warn('[reddit] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'reddit', 'error');
    return {
      subredditPosts: previous?.reddit?.subredditPosts ?? [],
      mentions: previous?.reddit?.mentions ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * YouTube via Apify (config: youtube)
 * ============================================================ */
async function fetchYouTube(previous, cacheMeta) {
  const cfg = loadActorConfig('youtube');
  const channel = cfg.account;

  if (!APIFY_API_TOKEN) {
    console.warn('[youtube] APIFY_API_TOKEN not set, using previous data');
    return previous?.youtube ?? { channel, subscribers: 0, videos: [] };
  }

  if (isCacheValid(cacheMeta, 'youtube')) {
    console.log('[youtube] Cache still valid, skipping fetch');
    return previous?.youtube ?? { channel, subscribers: 0, videos: [] };
  }

  try {
    console.log(`[youtube] Fetching "${channel}" via Apify actor ${cfg.actorId}...`);
    const items = await runApifyActor(cfg.actorId, cfg.input, { timeoutSecs: 180 });

    let subscribers = previous?.youtube?.subscribers ?? 0;
    const videos = [];

    for (const item of items ?? []) {
      if (item.channelSubscribers) {
        subscribers = typeof item.channelSubscribers === 'number'
          ? item.channelSubscribers
          : parseAbbreviated(String(item.channelSubscribers));
      }
      if (item.subscriberCount) subscribers = item.subscriberCount;
      if (item.numberOfSubscribers) subscribers = item.numberOfSubscribers;

      if (item.id || item.videoId || item.url?.includes('watch')) {
        const videoId = item.id ?? item.videoId ?? '';
        videos.push({
          id: String(videoId),
          title: item.title ?? '',
          thumbnail: item.thumbnailUrl ?? item.thumbnail ?? '',
          views: item.viewCount ?? item.views ?? 0,
          likes: item.likes ?? item.likeCount ?? 0,
          comments: item.commentsCount ?? item.commentCount ?? item.comments ?? 0,
          url: item.url ?? `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: item.uploadDate ?? item.publishedAt ?? item.date ?? undefined,
        });
      }
    }

    console.log(`[youtube] ${subscribers} subscribers, ${videos.length} videos`);
    markCacheEntry(cacheMeta, 'youtube', 'ok', videos.length);
    return { channel, subscribers, videos: videos.slice(0, 20) };
  } catch (err) {
    console.warn('[youtube] Apify failed:', err.message);
    markCacheEntry(cacheMeta, 'youtube', 'error');
    return {
      channel,
      subscribers: previous?.youtube?.subscribers ?? 0,
      videos: previous?.youtube?.videos ?? [],
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
 * History accumulation
 * ============================================================ */
async function appendHistory(instagram, tiktok, tiktokHashtag, youtube, x, reddit) {
  const history = await readHistory();
  const today = todayDateString();

  const totalReelViews = (instagram.reels ?? []).reduce((s, r) => s + (r.views || 0), 0);
  const totalVideoViews = (tiktok.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);
  const totalHashtagViews = (tiktokHashtag.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);
  const totalYtViews = (youtube.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);
  const totalTweetViews = (x.tweets ?? []).reduce((s, t) => s + (t.views || 0), 0);
  const allRedditPosts = [...(reddit.subredditPosts ?? []), ...(reddit.mentions ?? [])];
  const totalUpvotes = allRedditPosts.reduce((s, p) => s + (p.upvotes || 0), 0);

  const entry = {
    date: today,
    instagram: {
      followers: instagram.followers,
      totalReelViews,
      reels: (instagram.reels ?? []).map((r) => ({
        shortcode: r.shortcode,
        thumbnail: r.thumbnail,
        views: r.views,
        likes: r.likes,
        comments: r.comments,
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
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        url: v.url,
      })),
    },
    tiktokHashtag: {
      hashtag: tiktokHashtag.hashtag,
      totalVideoViews: totalHashtagViews,
      videoCount: (tiktokHashtag.videos ?? []).length,
    },
    youtube: {
      subscribers: youtube.subscribers ?? 0,
      totalVideoViews: totalYtViews,
      videos: (youtube.videos ?? []).map((v) => ({
        id: v.id,
        title: v.title,
        thumbnail: v.thumbnail,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        url: v.url,
      })),
    },
    x: {
      followers: x.followers ?? 0,
      totalTweetViews,
      tweets: (x.tweets ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        likes: t.likes,
        retweets: t.retweets,
        replies: t.replies,
        views: t.views,
        url: t.url,
      })),
    },
    reddit: {
      totalUpvotes,
      subredditPostCount: (reddit.subredditPosts ?? []).length,
      mentionCount: (reddit.mentions ?? []).length,
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
  const cacheMeta = await readCacheMeta();

  console.log('='.repeat(60));
  console.log('Refreshing all channels...');
  console.log(`  Cache cooldown: ${CACHE_COOLDOWN_HOURS}h | Force refresh: ${FORCE_REFRESH}`);
  console.log('='.repeat(60));

  const [instagram, tiktok, tiktokHashtag, youtube, x, reddit, mailchimp] = await Promise.all([
    fetchInstagram(previous, cacheMeta),
    fetchTikTok(previous, cacheMeta),
    fetchTikTokHashtag(previous, cacheMeta),
    fetchYouTube(previous, cacheMeta),
    fetchX(previous, cacheMeta),
    fetchReddit(previous, cacheMeta),
    fetchMailchimp(previous),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    instagram,
    tiktok,
    tiktokHashtag,
    youtube,
    x,
    reddit,
    mailchimp,
  };

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');

  await writeCacheMeta(cacheMeta);

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  const results = [
    { channel: 'Instagram', ok: !instagram.error, detail: `${instagram.followers} followers, ${(instagram.reels ?? []).length} reels` },
    { channel: 'TikTok', ok: !tiktok.error, detail: `${tiktok.followers} followers, ${(tiktok.videos ?? []).length} videos` },
    { channel: 'TikTok #' + tiktokHashtag.hashtag, ok: !tiktokHashtag.error, detail: `${(tiktokHashtag.videos ?? []).length} videos` },
    { channel: 'YouTube', ok: !youtube.error, detail: `${youtube.subscribers} subscribers, ${(youtube.videos ?? []).length} videos` },
    { channel: 'X/Twitter', ok: !x.error, detail: `${x.followers} followers, ${(x.tweets ?? []).length} tweets` },
    { channel: 'Reddit', ok: !reddit.error, detail: `${(reddit.subredditPosts ?? []).length} subreddit, ${(reddit.mentions ?? []).length} mentions` },
    { channel: 'Mailchimp', ok: !mailchimp.error, detail: `${mailchimp.cumulativeDisjoint} combined, ${mailchimp.audiences.length} audiences` },
  ];

  let hasErrors = false;
  for (const r of results) {
    const icon = r.ok ? 'OK' : 'WARN';
    console.log(`  [${icon}] ${r.channel}: ${r.detail}`);
    if (!r.ok) hasErrors = true;
  }

  if (hasErrors) {
    console.log('\nSome channels had errors (see warnings above). Previous data was preserved for those.');
  }

  console.log(`\nWrote ${SNAPSHOT_PATH}`);
  await appendHistory(instagram, tiktok, tiktokHashtag, youtube, x, reddit);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
