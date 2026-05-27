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
  likes?: number;
  comments?: number;
  title?: string;
};

type Props = {
  chartData: DataPoint[];
  videos: VideoItem[];
};

export function YouTubeDetail({ chartData, videos }: Props) {
  return (
    <>
      <BentoCard title="Video Views Over Time" iconLetter="YT">
        <ViewsChart data={chartData} color="#1f1f1f" label="Video views" />
      </BentoCard>

      <BentoCard title="All Videos" subtitle={`${videos.length} tracked`} iconLetter="YT">
        <ContentTable items={videos} idLabel="Video ID" platform="youtube" />
      </BentoCard>
    </>
  );
}
