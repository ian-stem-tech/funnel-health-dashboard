'use client';

import type { Reel } from '../lib/types';
import { formatNumber } from '../lib/types';

type Props = {
  reels: Reel[];
};

function resolveThumb(thumbnail: string | undefined): string | undefined {
  if (!thumbnail) return undefined;
  if (thumbnail.startsWith('http')) return thumbnail;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}/${thumbnail}`;
}

export function IGEmbedGrid({ reels }: Props) {
  return (
    <div className="reel-card-grid">
      {reels.map((reel) => {
        const src = resolveThumb(reel.thumbnail);
        return (
          <a
            key={reel.shortcode}
            className="reel-card"
            href={reel.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className="reel-card-media">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={reel.title || `Reel ${reel.shortcode}`}
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const ph = document.createElement('div');
                    ph.className = 'reel-card-placeholder';
                    ph.textContent = '▶ Instagram Reel';
                    el.parentElement?.insertBefore(ph, el);
                  }}
                />
              ) : (
                <div className="reel-card-placeholder">No preview</div>
              )}
              <div className="reel-card-play">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.45)" />
                  <path d="M14 11l12 7-12 7V11z" fill="white" />
                </svg>
              </div>
              <div className="reel-card-stats">
                <span>▶ {formatNumber(reel.views)}</span>
                {reel.likes != null && <span>♥ {formatNumber(reel.likes)}</span>}
              </div>
            </div>
            {reel.title && (
              <p className="reel-card-caption">{reel.title}</p>
            )}
          </a>
        );
      })}
    </div>
  );
}
