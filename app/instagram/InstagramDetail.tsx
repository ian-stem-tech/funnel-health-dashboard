'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { IGEmbedGrid } from '../components/IGEmbedGrid';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { sliceChartData, toDailyDeltas, type TimeRange } from '../lib/dateFilter';
import type { Reel } from '../lib/types';

type ReelItem = {
  id: string;
  thumbnail: string;
  views: number;
  views1d: number;
  views7d: number;
  views30d: number;
  url: string;
  firstSeen: string;
};

type Props = {
  chartData: DataPoint[];
  reels: ReelItem[];
  currentReels: Reel[];
};

export function InstagramDetail({ chartData, reels, currentReels }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const dailyGains = toDailyDeltas(chartData);
  const filteredChart = sliceChartData(dailyGains, range);

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Reels" subtitle={`${currentReels.length} videos`} iconLetter="IG">
        <IGEmbedGrid reels={currentReels} />
      </BentoCard>

      <BentoCard title="Daily Views Gained" iconLetter="IG">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Views gained" />
      </BentoCard>

      <BentoCard
        title="All Reels"
        subtitle={`${reels.length} tracked`}
        iconLetter="IG"
      >
        <ContentTable items={reels} idLabel="Shortcode" platform="instagram" timeRange={range} />
      </BentoCard>
    </>
  );
}
