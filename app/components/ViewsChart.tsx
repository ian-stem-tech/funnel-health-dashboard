'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export type DataPoint = {
  date: string;
  views: number;
  followers: number;
};

type Props = {
  data: DataPoint[];
  color?: string;
  label?: string;
};

function aggregateWeekly(daily: DataPoint[]): DataPoint[] {
  if (daily.length === 0) return [];
  const weeks: DataPoint[] = [];
  let weekViews = 0;
  let weekFollowers = 0;
  let weekStart = daily[0].date;
  let count = 0;

  for (const point of daily) {
    weekViews += point.views;
    weekFollowers = point.followers;
    count++;
    if (count === 7) {
      weeks.push({ date: weekStart, views: weekViews, followers: weekFollowers });
      weekViews = 0;
      count = 0;
      weekStart = '';
    } else if (!weekStart) {
      weekStart = point.date;
    }
  }
  if (count > 0) {
    weeks.push({ date: weekStart, views: weekViews, followers: weekFollowers });
  }
  return weeks;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function ViewsChart({ data, color = '#1f1f1f', label = 'Views' }: Props) {
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');

  const chartData = useMemo(
    () => (mode === 'weekly' ? aggregateWeekly(data) : data),
    [data, mode],
  );

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        No historical data yet. Data accumulates with each daily refresh.
      </div>
    );
  }

  return (
    <div className="views-chart">
      <div className="chart-controls">
        <span className="chart-label">{label}</span>
        <div className="chart-toggle">
          <button
            type="button"
            className={mode === 'daily' ? 'active' : ''}
            onClick={() => setMode('daily')}
          >
            Daily
          </button>
          <button
            type="button"
            className={mode === 'weekly' ? 'active' : ''}
            onClick={() => setMode('weekly')}
          >
            Weekly
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(31,31,31,0.08)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 12, fill: '#7a7a7a' }}
            axisLine={{ stroke: 'rgba(31,31,31,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 12, fill: '#7a7a7a' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value) => [new Intl.NumberFormat('en-US').format(Number(value)), label]}
            labelFormatter={(label) => formatDateLabel(String(label))}
            contentStyle={{
              background: 'rgba(255,255,225,0.95)',
              border: '1px solid rgba(31,31,31,0.14)',
              borderRadius: '10px',
              fontFamily: 'DeepSeaRegular, sans-serif',
              fontSize: '0.84rem',
            }}
          />
          <Line
            type="monotone"
            dataKey="views"
            stroke={color}
            strokeWidth={2}
            dot={chartData.length <= 30}
            activeDot={{ r: 5, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
