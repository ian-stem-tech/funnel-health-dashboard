export type Reel = {
  shortcode: string;
  thumbnail: string;
  views: number;
  url: string;
};

export type TikTokVideo = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
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
  mailchimp: {
    cumulativeRaw: number;
    cumulativeDisjoint: number;
    audiences: Audience[];
    error?: string;
  };
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
