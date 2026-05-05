'use client';

import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { IGEmbedGrid } from '../components/IGEmbedGrid';
import type { Reel } from '../lib/types';

type ReelItem = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
  firstSeen: string;
};

type Props = {
  chartData: DataPoint[];
  reels: ReelItem[];
  currentReels: Reel[];
};

export function InstagramDetail({ chartData, reels, currentReels }: Props) {
  return (
    <>
      <BentoCard title="Reels" subtitle={`${currentReels.length} videos`} iconLetter="IG">
        <IGEmbedGrid reels={currentReels} />
      </BentoCard>

      <BentoCard title="Reel Views Over Time" iconLetter="IG">
        <ViewsChart data={chartData} color="#1f1f1f" label="Reel views" />
      </BentoCard>

      <BentoCard title="All Reels" subtitle={`${reels.length} tracked`} iconLetter="IG">
        <ContentTable items={reels} idLabel="Shortcode" platform="instagram" />
      </BentoCard>
    </>
  );
}
