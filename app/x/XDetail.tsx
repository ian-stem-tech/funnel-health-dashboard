'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { sliceChartData, toDailyDeltas, type TimeRange } from '../lib/dateFilter';
import { formatNumber } from '../lib/types';

type TweetItem = {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  views1d: number;
  views7d: number;
  views30d: number;
  url: string;
  createdAt?: string;
};

type Props = {
  chartData: DataPoint[];
  tweets: TweetItem[];
};

function getViews(tweet: TweetItem, range: TimeRange): number {
  if (range === '1d') return tweet.views1d;
  if (range === '7d') return tweet.views7d;
  if (range === '30d') return tweet.views30d;
  return tweet.views;
}

export function XDetail({ chartData, tweets }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const dailyGains = toDailyDeltas(chartData);
  const filteredChart = sliceChartData(dailyGains, range);

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Daily Views Gained" iconLetter="X">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Views gained" />
      </BentoCard>

      <BentoCard
        title="All Tweets"
        subtitle={`${tweets.length} tracked`}
        iconLetter="X"
      >
        {tweets.length === 0 ? (
          <div className="content-table-empty">
            No tweet data collected yet. Data accumulates with each daily refresh.
          </div>
        ) : (
          <div className="content-table-scroll">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Tweet</th>
                  <th>{range === 'all' ? 'Views' : `Views (${range})`}</th>
                  <th>Likes</th>
                  <th>Retweets</th>
                  <th>Replies</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {tweets.map((tweet) => (
                  <tr key={tweet.id}>
                    <td className="content-table-id content-table-id-wide">
                      {tweet.text.slice(0, 100)}{tweet.text.length > 100 ? '...' : ''}
                    </td>
                    <td className="content-table-views">{formatNumber(getViews(tweet, range))}</td>
                    <td className="content-table-views">{formatNumber(tweet.likes)}</td>
                    <td className="content-table-views">{formatNumber(tweet.retweets)}</td>
                    <td className="content-table-views">{formatNumber(tweet.replies)}</td>
                    <td>
                      <a href={tweet.url} target="_blank" rel="noreferrer noopener" className="content-table-link">
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>
    </>
  );
}
