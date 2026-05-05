'use client';

import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { ContentTable } from '../components/ContentTable';
import { BentoCard } from '../components/BentoCard';

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
  return (
    <>
      <BentoCard title="Video Views Over Time" iconLetter="TT">
        <ViewsChart data={chartData} color="#1f1f1f" label="Video views" />
      </BentoCard>

      <BentoCard title="All Videos" subtitle={`${videos.length} tracked`} iconLetter="TT">
        <ContentTable items={videos} idLabel="Video ID" platform="tiktok" />
      </BentoCard>
    </>
  );
}
