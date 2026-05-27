'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { filterByDateRange, sliceChartData, type TimeRange } from '../lib/dateFilter';

type VideoItem = {
  id: string;
  thumbnail: string;
  views: number;
  url: string;
  firstSeen: string;
};

type Props = {
  chartData: DataPoint[];
  videos: VideoItem[];
};

export function TikTokDetail({ chartData, videos }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const filteredChart = sliceChartData(chartData, range);
  const filteredVideos = filterByDateRange(videos, range, 'firstSeen');

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Video Views Over Time" iconLetter="TT">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Video views" />
      </BentoCard>

      <BentoCard
        title="All Videos"
        subtitle={range === 'all' ? `${videos.length} tracked` : `${filteredVideos.length} of ${videos.length} videos`}
        iconLetter="TT"
      >
        <ContentTable items={filteredVideos} idLabel="Video ID" platform="tiktok" />
      </BentoCard>
    </>
  );
}
