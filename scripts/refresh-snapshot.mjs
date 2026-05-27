#!/usr/bin/env node
/**
 * refresh-snapshot.mjs
 *
 * Daily refresh script run by GitHub Actions.
 *   - Instagram:  Apify actor (profile + posts with likes/comments/saves/views)
 *   - TikTok:     Apify actor (profile + videos with likes/comments/shares/views)
 *   - X/Twitter:  Apify actor (profile + tweets with likes/retweets/replies/views)
 *   - Reddit:     Apify actor (user posts with upvotes/comments)
 *   - YouTube:    YouTube Data API v3 (channel stats + videos)
 *   - Mailchimp:  REST API with rate-limit-aware retries
 *
 * Writes:
 *   - public/data/snapshot.json
 *   - public/data/history.json
 *   - public/data/mailchimp-discovery.json
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, 'public', 'data', 'snapshot.json');
const HISTORY_PATH = path.join(ROOT, 'public', 'data', 'history.json');
const DISCOVERY_PATH = path.join(ROOT, 'public', 'data', 'mailchimp-discovery.json');

const IG_HANDLE = process.env.IG_HANDLE || 'stemplayer';
const TIKTOK_HANDLE = process.env.TIKTOK_HANDLE || 'stemplayer';
const X_HANDLE = process.env.X_HANDLE || 'stemplayer';
const YOUTUBE_CHANNEL = process.env.YOUTUBE_CHANNEL || 'stemplayer';
const REDDIT_USER = process.env.REDDIT_USER || 'stemplayer';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us4';

const HISTORY_MAX_DAYS = 90;

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
 * Apify helper — run an actor synchronously and return results
 * ============================================================ */
async function runApifyActor(actorId, input, { timeoutSecs = 120 } = {}) {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not set');
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}&timeout=${timeoutSecs}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

/* ============================================================
 * Instagram via Apify
 * ============================================================ */
async function fetchInstagram(handle, previous) {
  if (!APIFY_API_TOKEN) {
    console.warn('[instagram] APIFY_API_TOKEN not set, using previous data');
    return previous?.instagram ?? { handle, followers: 0, reels: [] };
  }

  try {
    console.log(`[instagram] Fetching @${handle} via Apify...`);
    const items = await runApifyActor('apify/instagram-profile-scraper', {
      usernames: [handle],
      resultsLimit: 30,
    }, { timeoutSecs: 180 });

    const profile = items?.[0];
    if (!profile) throw new Error('No profile data returned');

    const followers = profile.followersCount ?? profile.edge_followed_by?.count ?? previous?.instagram?.followers ?? 0;

    const posts = profile.latestPosts ?? profile.posts ?? [];
    const reels = posts
      .filter((p) => p.type === 'Video' || p.videoUrl || p.isVideo)
      .slice(0, 30)
      .map((p) => ({
        shortcode: p.shortCode ?? p.shortcode ?? p.id ?? '',
        thumbnail: p.displayUrl ?? p.thumbnailUrl ?? '',
        views: p.videoViewCount ?? p.videoPlayCount ?? 0,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        saves: p.savesCount ?? 0,
        title: p.caption?.slice(0, 100) ?? '',
        url: p.url ?? `https://www.instagram.com/reel/${p.shortCode ?? p.shortcode}/`,
      }));

    console.log(`[instagram] ${followers} followers, ${reels.length} reels`);
    return { handle, followers, reels };
  } catch (err) {
    console.warn('[instagram] Apify failed:', err.message);
    return {
      handle,
      followers: previous?.instagram?.followers ?? 0,
      reels: previous?.instagram?.reels ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * TikTok via Apify
 * ============================================================ */
async function fetchTikTok(handle, previous) {
  if (!APIFY_API_TOKEN) {
    console.warn('[tiktok] APIFY_API_TOKEN not set, using previous data');
    return previous?.tiktok ?? { handle, followers: 0, videos: [] };
  }

  try {
    console.log(`[tiktok] Fetching @${handle} via Apify...`);
    const items = await runApifyActor('clockworks/free-tiktok-scraper', {
      profiles: [handle],
      resultsPerPage: 20,
      shouldDownloadVideos: false,
    }, { timeoutSecs: 180 });

    let followers = previous?.tiktok?.followers ?? 0;
    const videos = [];

    for (const item of items ?? []) {
      if (item.authorMeta?.fans) {
        followers = item.authorMeta.fans;
      }

      if (item.id && item.videoMeta) {
        videos.push({
          id: String(item.id),
          thumbnail: item.videoMeta?.coverUrl ?? item.covers?.[0] ?? '',
          views: item.playCount ?? item.videoMeta?.playCount ?? 0,
          likes: item.diggCount ?? item.likes ?? 0,
          comments: item.commentCount ?? item.comments ?? 0,
          shares: item.shareCount ?? item.shares ?? 0,
          title: item.text?.slice(0, 100) ?? '',
          url: item.webVideoUrl ?? `https://www.tiktok.com/@${handle}/video/${item.id}`,
          createdAt: item.createTimeISO ?? undefined,
        });
      }
    }

    console.log(`[tiktok] ${followers} followers, ${videos.length} videos`);
    return { handle, followers, videos: videos.slice(0, 20) };
  } catch (err) {
    console.warn('[tiktok] Apify failed:', err.message);
    return {
      handle,
      followers: previous?.tiktok?.followers ?? 0,
      videos: previous?.tiktok?.videos ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * X/Twitter via Apify
 * ============================================================ */
async function fetchX(handle, previous) {
  if (!APIFY_API_TOKEN) {
    console.warn('[x] APIFY_API_TOKEN not set, using previous data');
    return previous?.x ?? { handle, followers: 0, tweets: [] };
  }

  try {
    console.log(`[x] Fetching @${handle} via Apify...`);
    const items = await runApifyActor('apidojo/tweet-scraper', {
      handles: [handle],
      tweetsDesired: 20,
      addUserInfo: true,
    }, { timeoutSecs: 180 });

    let followers = previous?.x?.followers ?? 0;
    const tweets = [];

    for (const item of items ?? []) {
      if (item.author?.followers) {
        followers = item.author.followers;
      }

      tweets.push({
        id: item.id ?? item.tweetId ?? '',
        text: (item.text ?? item.full_text ?? '').slice(0, 280),
        likes: item.likeCount ?? item.favorite_count ?? 0,
        retweets: item.retweetCount ?? item.retweet_count ?? 0,
        replies: item.replyCount ?? item.reply_count ?? 0,
        views: item.viewCount ?? item.views ?? 0,
        url: item.url ?? `https://x.com/${handle}/status/${item.id}`,
        createdAt: item.createdAt ?? item.created_at ?? undefined,
      });
    }

    console.log(`[x] ${followers} followers, ${tweets.length} tweets`);
    return { handle, followers, tweets: tweets.slice(0, 20) };
  } catch (err) {
    console.warn('[x] Apify failed:', err.message);
    return {
      handle,
      followers: previous?.x?.followers ?? 0,
      tweets: previous?.x?.tweets ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * Reddit via Apify
 * ============================================================ */
async function fetchReddit(user, previous) {
  if (!APIFY_API_TOKEN) {
    console.warn('[reddit] APIFY_API_TOKEN not set, using previous data');
    return previous?.reddit ?? { user, karma: 0, posts: [] };
  }

  try {
    console.log(`[reddit] Fetching u/${user} via Apify...`);
    const items = await runApifyActor('trudax/reddit-scraper', {
      type: 'user',
      urls: [`https://www.reddit.com/user/${user}/`],
      maxItems: 20,
    }, { timeoutSecs: 120 });

    let karma = previous?.reddit?.karma ?? 0;
    const posts = [];

    for (const item of items ?? []) {
      if (item.karma) karma = item.karma;

      if (item.title || item.body) {
        posts.push({
          id: item.id ?? '',
          title: (item.title ?? item.body ?? '').slice(0, 200),
          upvotes: item.upVotes ?? item.score ?? item.ups ?? 0,
          comments: item.numberOfComments ?? item.numComments ?? item.num_comments ?? 0,
          url: item.url ?? '',
          subreddit: item.subreddit ?? item.communityName ?? undefined,
          createdAt: item.createdAt ?? item.created ?? undefined,
        });
      }
    }

    console.log(`[reddit] ${karma} karma, ${posts.length} posts`);
    return { user, karma, posts: posts.slice(0, 20) };
  } catch (err) {
    console.warn('[reddit] Apify failed:', err.message);
    return {
      user,
      karma: previous?.reddit?.karma ?? 0,
      posts: previous?.reddit?.posts ?? [],
      error: err.message,
    };
  }
}

/* ============================================================
 * YouTube via Data API v3
 * ============================================================ */
async function fetchYouTube(channel, previous) {
  if (!YOUTUBE_API_KEY) {
    console.warn('[youtube] YOUTUBE_API_KEY not set, using previous data');
    return previous?.youtube ?? { channel, subscribers: 0, videos: [] };
  }

  try {
    console.log(`[youtube] Fetching channel "${channel}" via Data API v3...`);

    // Step 1: Resolve channel — try by handle first, fall back to forUsername
    let channelId = null;
    let subscribers = previous?.youtube?.subscribers ?? 0;

    const handleRes = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${channel}&key=${YOUTUBE_API_KEY}`,
    );
    if (handleRes.ok) {
      const handleData = await handleRes.json();
      if (handleData.items?.length > 0) {
        channelId = handleData.items[0].id;
        subscribers = Number(handleData.items[0].statistics?.subscriberCount ?? 0);
      }
    }

    if (!channelId) {
      const userRes = await fetchWithRetry(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forUsername=${channel}&key=${YOUTUBE_API_KEY}`,
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.items?.length > 0) {
          channelId = userData.items[0].id;
          subscribers = Number(userData.items[0].statistics?.subscriberCount ?? 0);
        }
      }
    }

    // If channel looks like a channel ID already (UC...)
    if (!channelId && channel.startsWith('UC')) {
      channelId = channel;
      const idRes = await fetchWithRetry(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel}&key=${YOUTUBE_API_KEY}`,
      );
      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData.items?.length > 0) {
          subscribers = Number(idData.items[0].statistics?.subscriberCount ?? 0);
        }
      }
    }

    if (!channelId) {
      throw new Error(`Could not resolve YouTube channel: ${channel}`);
    }

    // Step 2: Get recent video IDs via search
    const searchRes = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&order=date&maxResults=20&type=video&key=${YOUTUBE_API_KEY}`,
    );
    if (!searchRes.ok) throw new Error(`YouTube search ${searchRes.status}`);
    const searchData = await searchRes.json();
    const videoIds = (searchData.items ?? []).map((i) => i.id?.videoId).filter(Boolean);

    let videos = [];

    if (videoIds.length > 0) {
      // Step 3: Get video details (stats + snippet)
      const detailRes = await fetchWithRetry(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`,
      );
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        videos = (detailData.items ?? []).map((v) => ({
          id: v.id,
          title: v.snippet?.title ?? '',
          thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? '',
          views: Number(v.statistics?.viewCount ?? 0),
          likes: Number(v.statistics?.likeCount ?? 0),
          comments: Number(v.statistics?.commentCount ?? 0),
          url: `https://www.youtube.com/watch?v=${v.id}`,
          publishedAt: v.snippet?.publishedAt ?? undefined,
        }));
      }
    }

    console.log(`[youtube] ${subscribers} subscribers, ${videos.length} videos`);
    return { channel, subscribers, videos };
  } catch (err) {
    console.warn('[youtube] API failed:', err.message);
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
async function appendHistory(instagram, tiktok, youtube, x, reddit) {
  const history = await readHistory();
  const today = todayDateString();

  const totalReelViews = (instagram.reels ?? []).reduce((s, r) => s + (r.views || 0), 0);
  const totalVideoViews = (tiktok.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);
  const totalYtViews = (youtube.videos ?? []).reduce((s, v) => s + (v.views || 0), 0);
  const totalTweetViews = (x.tweets ?? []).reduce((s, t) => s + (t.views || 0), 0);
  const totalUpvotes = (reddit.posts ?? []).reduce((s, p) => s + (p.upvotes || 0), 0);

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
      karma: reddit.karma ?? 0,
      totalUpvotes,
      posts: (reddit.posts ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        upvotes: p.upvotes,
        comments: p.comments,
        url: p.url,
        subreddit: p.subreddit,
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

  console.log('Refreshing Instagram, TikTok, YouTube, X, Reddit, Mailchimp...');

  // Run all fetches in parallel (each handles its own errors)
  const [instagram, tiktok, youtube, x, reddit, mailchimp] = await Promise.all([
    fetchInstagram(IG_HANDLE, previous),
    fetchTikTok(TIKTOK_HANDLE, previous),
    fetchYouTube(YOUTUBE_CHANNEL, previous),
    fetchX(X_HANDLE, previous),
    fetchReddit(REDDIT_USER, previous),
    fetchMailchimp(previous),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    instagram,
    tiktok,
    youtube,
    x,
    reddit,
    mailchimp,
  };

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Wrote ${SNAPSHOT_PATH}`);
  console.log(`  IG followers: ${instagram.followers}, reels: ${(instagram.reels ?? []).length}`);
  console.log(`  TikTok followers: ${tiktok.followers}, videos: ${(tiktok.videos ?? []).length}`);
  console.log(`  YouTube subscribers: ${youtube.subscribers}, videos: ${(youtube.videos ?? []).length}`);
  console.log(`  X followers: ${x.followers}, tweets: ${(x.tweets ?? []).length}`);
  console.log(`  Reddit karma: ${reddit.karma}, posts: ${(reddit.posts ?? []).length}`);
  console.log(`  Mailchimp combined: ${mailchimp.cumulativeDisjoint}, audiences: ${mailchimp.audiences.length}`);

  await appendHistory(instagram, tiktok, youtube, x, reddit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
