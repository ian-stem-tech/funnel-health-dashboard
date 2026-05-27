'use client';

import { useState } from 'react';
import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { BentoCard } from '../components/BentoCard';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { filterByDateRange, sliceChartData, type TimeRange } from '../lib/dateFilter';
import { formatNumber } from '../lib/types';

type TweetItem = {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  url: string;
  createdAt?: string;
};

type Props = {
  chartData: DataPoint[];
  tweets: TweetItem[];
};

export function XDetail({ chartData, tweets }: Props) {
  const [range, setRange] = useState<TimeRange>('all');
  const filteredChart = sliceChartData(chartData, range);
  const filteredTweets = filterByDateRange(tweets, range, 'createdAt');

  return (
    <>
      <TimeRangeFilter value={range} onChange={setRange} />

      <BentoCard title="Tweet Views Over Time" iconLetter="X">
        <ViewsChart data={filteredChart} color="#1f1f1f" label="Tweet views" />
      </BentoCard>

      <BentoCard
        title="All Tweets"
        subtitle={range === 'all' ? `${tweets.length} tracked` : `${filteredTweets.length} of ${tweets.length} tweets`}
        iconLetter="X"
      >
        {filteredTweets.length === 0 ? (
          <div className="content-table-empty">
            No tweet data collected yet. Data accumulates with each daily refresh.
          </div>
        ) : (
          <div className="content-table-scroll">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Tweet</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Retweets</th>
                  <th>Replies</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredTweets.map((tweet) => (
                  <tr key={tweet.id}>
                    <td className="content-table-id" style={{ maxWidth: 280 }}>
                      {tweet.text.slice(0, 100)}{tweet.text.length > 100 ? '...' : ''}
                    </td>
                    <td className="content-table-views">{formatNumber(tweet.views)}</td>
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
