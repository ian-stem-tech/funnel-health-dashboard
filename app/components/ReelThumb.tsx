import { formatNumber } from '../lib/types';

type Props = {
  thumbnail?: string;
  views: number;
  url: string;
  label?: string;
};

export function ReelThumb({ thumbnail, views, url, label }: Props) {
  return (
    <a className="reel-thumb" href={url} target="_blank" rel="noreferrer noopener">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt={label ?? 'Reel thumbnail'} loading="lazy" />
      ) : (
        <div className="reel-thumb-fallback">No preview</div>
      )}
      <span className="reel-views">▶ {formatNumber(views)}</span>
    </a>
  );
}
