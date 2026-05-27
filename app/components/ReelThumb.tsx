import { formatNumber } from '../lib/types';

type Props = {
  thumbnail?: string;
  views: number;
  url: string;
  label?: string;
};

function resolveThumb(thumbnail: string | undefined): string | undefined {
  if (!thumbnail) return undefined;
  if (thumbnail.startsWith('http')) return thumbnail;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}/${thumbnail}`;
}

export function ReelThumb({ thumbnail, views, url, label }: Props) {
  const src = resolveThumb(thumbnail);
  return (
    <a className="reel-thumb" href={url} target="_blank" rel="noreferrer noopener">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? 'Reel thumbnail'} loading="lazy" />
      ) : (
        <div className="reel-thumb-fallback">No preview</div>
      )}
      <span className="reel-views">▶ {formatNumber(views)}</span>
    </a>
  );
}
