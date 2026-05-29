'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { BentoCard } from './BentoCard';
import { formatNumber, type WaitlistData } from '../lib/types';

type Range = '7d' | '30d' | '90d';

export function WaitlistTile({ data }: { data: WaitlistData }) {
  const [range, setRange] = useState<Range>('30d');

  const chartData = useMemo(() => {
    const sorted = [...(data.dailySignups ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const sliced = sorted.slice(-days);
    return sliced.map((d) => ({
      date: d.date.slice(5),
      count: d.count,
    }));
  }, [data.dailySignups, range]);

  const periodTotal = useMemo(
    () => chartData.reduce((sum, d) => sum + d.count, 0),
    [chartData],
  );

  const avgPerDay = chartData.length > 0 ? Math.round(periodTotal / chartData.length) : 0;

  return (
    <BentoCard
      title="Waitlist signups"
      subtitle={data.campaign}
      iconLetter="WL"
      headerExtra={
        <div className="waitlist-range-group" role="group" aria-label="Date range">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`waitlist-range-btn${range === r ? ' active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div className="waitlist-stats-row">
        <div className="waitlist-stat">
          <span className="waitlist-stat-value">{formatNumber(data.totalEmails)}</span>
          <span className="waitlist-stat-label">Total emails</span>
        </div>
        <div className="waitlist-stat">
          <span className="waitlist-stat-value">{formatNumber(periodTotal)}</span>
          <span className="waitlist-stat-label">Last {range}</span>
        </div>
        <div className="waitlist-stat">
          <span className="waitlist-stat-value">{formatNumber(avgPerDay)}</span>
          <span className="waitlist-stat-label">Avg / day</span>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="waitlist-chart-wrap">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,31,31,0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: '#1f1f1f',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fffde4',
                  fontSize: '0.82rem',
                }}
                labelStyle={{ color: '#d3d3d3' }}
              />
              <Bar
                dataKey="count"
                name="Signups"
                fill="rgb(31 31 31 / 0.82)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="waitlist-empty">No daily signup data available yet.</p>
      )}

      {data.error && (
        <p className="card-subtitle" style={{ color: '#a16207' }}>
          Last refresh warning: {data.error}
        </p>
      )}
    </BentoCard>
  );
}
