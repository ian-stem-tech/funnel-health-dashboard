export type Reel = {
  shortcode: string;
  thumbnail: string;
  videoUrl?: string;
  views: number;
  url: string;
  title?: string;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
};

export type TikTokVideo = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
  likes?: number;
  comments?: number;
  shares?: number;
  title?: string;
  createdAt?: string;
};

export type TikTokHashtagVideo = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
  likes?: number;
  comments?: number;
  shares?: number;
  title?: string;
  author?: string;
  createdAt?: string;
};

export type XTweet = {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  url: string;
  createdAt?: string;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
  publishedAt?: string;
};

export type RedditPost = {
  id: string;
  title: string;
  upvotes: number;
  comments: number;
  url: string;
  subreddit?: string;
  createdAt?: string;
  source?: 'subreddit' | 'mention';
};

export type AudienceSide = 'kano' | 'stemplayer' | 'combined';

export type Audience = {
  key: string;
  label: string;
  count: number;
  side: AudienceSide;
  inferred?: boolean;
  derivation?: string;
};

export type MailchimpLocation = {
  country: string;
  cc: string;
  count: number;
  percent: number;
};

export type WaitlistDailySignup = {
  date: string;
  count: number;
};

export type WaitlistData = {
  campaign: string;
  totalEmails: number;
  dailySignups: WaitlistDailySignup[];
  error?: string;
};

export type Snapshot = {
  generatedAt: string;
  instagram: {
    handle: string;
    followers: number;
    reels: Reel[];
    error?: string;
  };
  tiktok: {
    handle: string;
    followers: number;
    videos: TikTokVideo[];
    error?: string;
  };
  tiktokHashtag: {
    hashtags: string[];
    videos: TikTokHashtagVideo[];
    error?: string;
  };
  youtube: {
    channel: string;
    subscribers: number;
    videos: YouTubeVideo[];
    error?: string;
  };
  x: {
    handle: string;
    followers: number;
    tweets: XTweet[];
    error?: string;
  };
  reddit: {
    subredditPosts: RedditPost[];
    mentions: RedditPost[];
    error?: string;
  };
  mailchimp: {
    cumulativeRaw: number;
    cumulativeDisjoint: number;
    audiences: Audience[];
    mailchimpLocations?: MailchimpLocation[];
    error?: string;
  };
  waitlist?: WaitlistData;
};

export type HistoryEntry = {
  date: string;
  instagram: {
    followers: number;
    totalReelViews: number;
    reels: Reel[];
  };
  tiktok: {
    followers: number;
    totalVideoViews: number;
    videos: TikTokVideo[];
  };
  tiktokHashtag?: {
    hashtags: string[];
    totalVideoViews: number;
    videoCount: number;
  };
  youtube?: {
    subscribers: number;
    totalVideoViews: number;
    videos: YouTubeVideo[];
  };
  x?: {
    followers: number;
    totalTweetViews: number;
    tweets: XTweet[];
  };
  reddit?: {
    totalUpvotes: number;
    subredditPostCount: number;
    mentionCount: number;
  };
  waitlist?: {
    totalEmails: number;
    dailySignup: number;
  };
};

export type History = {
  entries: HistoryEntry[];
};

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
