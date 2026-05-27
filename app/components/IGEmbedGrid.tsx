'use client';

import { useRef, useState, useCallback } from 'react';
import type { Reel } from '../lib/types';
import { formatNumber } from '../lib/types';

type Props = {
  reels: Reel[];
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

function resolveUrl(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('http')) return src;
  return `${BASE}/${src}`;
}

function ReelCard({ reel }: { reel: Reel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const thumb = resolveUrl(reel.thumbnail);
  const video = resolveUrl(reel.videoUrl);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  if (!video) {
    return (
      <a
        href={reel.url}
        target="_blank"
        rel="noreferrer noopener"
        className="reel-thumb"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={reel.title || 'Reel'} loading="lazy" />
        ) : (
          <span className="reel-thumb-fallback">No preview</span>
        )}
        <span className="reel-views">▶ {formatNumber(reel.views)}</span>
      </a>
    );
  }

  return (
    <div className="reel-player" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={video}
        poster={thumb}
        muted={muted}
        loop
        playsInline
        preload="none"
      />
      {!playing && <div className="reel-play-btn" aria-label="Play" />}
      <div className="reel-player-controls">
        <span className="reel-views">▶ {formatNumber(reel.views)}</span>
        <button
          className="reel-mute-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      {reel.title && <div className="reel-caption">{reel.title}</div>}
    </div>
  );
}

export function IGEmbedGrid({ reels }: Props) {
  return (
    <div className="ig-video-grid">
      {reels.map((reel) => (
        <ReelCard key={reel.shortcode} reel={reel} />
      ))}
    </div>
  );
}
