'use client';

import { ViewsChart, type DataPoint } from '../components/ViewsChart';
import { BentoCard } from '../components/BentoCard';
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
  return (
    <>
      <BentoCard title="Tweet Views Over Time" iconLetter="X">
        <ViewsChart data={chartData} color="#1f1f1f" label="Tweet views" />
      </BentoCard>

      <BentoCard title="All Tweets" subtitle={`${tweets.length} tracked`} iconLetter="X">
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
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Retweets</th>
                  <th>Replies</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {tweets.map((tweet) => (
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
