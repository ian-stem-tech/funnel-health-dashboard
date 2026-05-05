'use client';

import { useEffect, useRef } from 'react';

type Props = {
  shortcode: string;
  title?: string;
};

export function IGEmbed({ shortcode, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Instagram embed.js if not already loaded
    const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    } else if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [shortcode]);

  return (
    <div className="ig-embed-wrap" ref={containerRef}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`https://www.instagram.com/reel/${shortcode}/`}
        data-instgrm-version="14"
        data-instgrm-captioned=""
        style={{
          background: '#FFF',
          border: 0,
          borderRadius: '12px',
          margin: 0,
          maxWidth: '100%',
          minWidth: '280px',
          padding: 0,
          width: '100%',
        }}
      >
        <a href={`https://www.instagram.com/reel/${shortcode}/`} target="_blank" rel="noreferrer noopener">
          {title || `View reel ${shortcode}`}
        </a>
      </blockquote>
    </div>
  );
}
