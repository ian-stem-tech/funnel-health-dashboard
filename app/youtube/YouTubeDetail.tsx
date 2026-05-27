'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { sliceChartData, type TimeRange } from '../lib/dateFilter';

type VideoItem = {
  id: string;
  thumbnail: string;
  views: number;
  views1d: number;
  views7d: number;
  views30d: number;
  url: string;
  firstSeen: string;
  likes?: number;
  comments?: number;
  title?: string;
};

type Props = {
  chartData: DataPoint[];
  videos: VideoItem[];
};

export function YouTubeDetail({ chartData, videos }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const filteredChart = sliceChartData(chartData, range);

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Featured Video" iconLetter="YT">
        <div className="yt-embed-wrap">
          <iframe
            src="https://www.youtube.com/embed/tqFodSPhHtQ"
            title="Stem Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </BentoCard>

      <BentoCard title="Video Views Over Time" iconLetter="YT">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Video views" />
      </BentoCard>

      <BentoCard
        title="All Videos"
        subtitle={`${videos.length} tracked`}
        iconLetter="YT"
      >
        <ContentTable items={videos} idLabel="Video ID" platform="youtube" timeRange={range} />
      </BentoCard>
    </>
  );
}
