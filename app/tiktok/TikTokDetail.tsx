'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { sliceChartData, toDailyDeltas, type TimeRange } from '../lib/dateFilter';

type VideoItem = {
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
  videos: VideoItem[];
};

export function TikTokDetail({ chartData, videos }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const dailyGains = toDailyDeltas(chartData);
  const filteredChart = sliceChartData(dailyGains, range);

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Daily Views Gained" iconLetter="TT">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Views gained" />
      </BentoCard>

      <BentoCard
        title="All Videos"
        subtitle={`${videos.length} tracked`}
        iconLetter="TT"
      >
        <ContentTable items={videos} idLabel="Video ID" platform="tiktok" timeRange={range} />
      </BentoCard>
    </>
  );
}
