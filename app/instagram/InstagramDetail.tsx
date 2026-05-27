'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { IGEmbedGrid } from '../components/IGEmbedGrid';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { filterByDateRange, sliceChartData, type TimeRange } from '../lib/dateFilter';
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
  const [range, setRange] = useState<TimeRange>('all');
  const filteredChart = sliceChartData(chartData, range);
  const filteredReels = filterByDateRange(reels, range, 'firstSeen');

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Reels" subtitle={`${currentReels.length} videos`} iconLetter="IG">
        <IGEmbedGrid reels={currentReels} />
      </BentoCard>

      <BentoCard title="Reel Views Over Time" iconLetter="IG">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Reel views" />
      </BentoCard>

      <BentoCard
        title="All Reels"
        subtitle={range === 'all' ? `${reels.length} tracked` : `${filteredReels.length} of ${reels.length} reels`}
        iconLetter="IG"
      >
        <ContentTable items={filteredReels} idLabel="Shortcode" platform="instagram" />
      </BentoCard>
    </>
  );
}
