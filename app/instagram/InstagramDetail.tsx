'use client';

import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';

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
};

export function InstagramDetail({ chartData, reels }: Props) {
  return (
    <>
      <BentoCard title="Reel Views Over Time" iconLetter="IG">
        <ViewsChart data={chartData} color="#1f1f1f" label="Reel views" />
      </BentoCard>

      <BentoCard title="All Reels" subtitle={`${reels.length} tracked`} iconLetter="IG">
        <ContentTable items={reels} idLabel="Shortcode" platform="instagram" />
      </BentoCard>
    </>
  );
}
