'use client';

import type { TimeRange } from '../lib/dateFilter';

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'All' },
];

type Props = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
};

export function TimeRangeFilter({ value, onChange }: Props) {
  return (
    <div className="chart-toggle" style={{ marginBottom: 16 }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
