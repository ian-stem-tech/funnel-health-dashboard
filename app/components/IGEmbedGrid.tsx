'use client';

import { useEffect } from 'react';
import type { Reel } from '../lib/types';

type Props = {
  reels: Reel[];
};

export function IGEmbedGrid({ reels }: Props) {
  useEffect(() => {
    const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    } else if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [reels]);

  return (
    <div className="ig-embed-grid">
      {reels.map((reel) => (
        <div key={reel.shortcode} className="ig-embed-cell">
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={reel.url}
            data-instgrm-version="14"
            style={{
              background: '#FFF',
              border: 0,
              borderRadius: '12px',
              margin: 0,
              maxWidth: '100%',
              minWidth: '200px',
              padding: 0,
              width: '100%',
            }}
          >
            <a href={reel.url} target="_blank" rel="noreferrer noopener">
              {reel.title || `View reel`}
            </a>
          </blockquote>
        </div>
      ))}
    </div>
  );
}
