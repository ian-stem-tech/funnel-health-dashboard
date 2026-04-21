'use client';

import { useEffect, useMemo, useState } from 'react';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot, type Audience } from '../lib/types';

const STORAGE_KEY = 'fhd:active-segments';

function loadActive(defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return defaults;
    return parsed;
  } catch {
    return defaults;
  }
}

export function MailchimpTile({ data }: { data: Snapshot['mailchimp'] }) {
  // Disjoint buckets used for the filterable cumulative number.
  // The "raw combined" list is intentionally excluded so the math stays clean.
  const disjoint = useMemo(
    () => data.audiences.filter((a) => a.key !== 'kano_stemplayer_combined'),
    [data.audiences],
  );

  const defaultActive = useMemo(() => disjoint.map((a) => a.key), [disjoint]);
  const [active, setActive] = useState<string[]>(defaultActive);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setActive(loadActive(defaultActive));
    setHydrated(true);
  }, [defaultActive]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
    } catch {
      /* ignore */
    }
  }, [active, hydrated]);

  function toggle(key: string) {
    setActive((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const cumulative = useMemo(
    () =>
      disjoint
        .filter((a) => active.includes(a.key))
        .reduce((sum, a) => sum + a.count, 0),
    [disjoint, active],
  );

  const allActive = active.length === defaultActive.length;
  const noneActive = active.length === 0;

  const caption = noneActive
    ? 'No segments selected'
    : allActive
    ? 'Showing: all segments (Inferred Kano + Stemplayer side)'
    : `Showing: ${active.length} segment${active.length === 1 ? '' : 's'}`;

  return (
    <BentoCard
      title="Email funnel — Mailchimp"
      subtitle="us4"
      iconLetter="MC"
      headerExtra={
        <button
          type="button"
          onClick={() => setActive(allActive ? [] : defaultActive)}
          style={{
            background: 'transparent',
            color: 'var(--gray-900)',
            border: '1px solid rgb(31 31 31 / 0.24)',
            minHeight: 0,
            padding: '0.34rem 0.7rem',
            fontSize: '0.78rem',
          }}
        >
          {allActive ? 'Clear all' : 'Select all'}
        </button>
      }
    >
      <div className="hero-stat">
        <span className="hero-stat-label">Cumulative subscribers (filtered)</span>
        <span className="hero-stat-value">{formatNumber(cumulative)}</span>
        <span className="hero-stat-caption">{caption}</span>
      </div>

      <div className="segment-filter" role="group" aria-label="Segment filters">
        {disjoint.map((segment) => {
          const on = active.includes(segment.key);
          return (
            <button
              key={segment.key}
              type="button"
              className={`segment-chip${on ? ' active' : ''}`}
              onClick={() => toggle(segment.key)}
              aria-pressed={on}
            >
              <span>{shortLabel(segment)}</span>
              <span className="segment-chip-count">{formatNumber(segment.count)}</span>
            </button>
          );
        })}
      </div>

      <div className="audience-grid">
        {data.audiences.map((segment) => {
          const inDisjoint = segment.key !== 'kano_stemplayer_combined';
          const isActive = inDisjoint ? active.includes(segment.key) : true;
          const classes = ['audience-card'];
          if (segment.inferred) classes.push('inferred');
          if (inDisjoint && !isActive) classes.push('inactive');
          return (
            <div
              key={segment.key}
              className={classes.join(' ')}
              onClick={() => inDisjoint && toggle(segment.key)}
              role={inDisjoint ? 'button' : undefined}
              tabIndex={inDisjoint ? 0 : undefined}
              onKeyDown={(e) => {
                if (!inDisjoint) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(segment.key);
                }
              }}
              title={segment.derivation}
            >
              {segment.inferred && <span className="inferred-badge">Inferred</span>}
              <span className="audience-label">{segment.label}</span>
              <span className="audience-count">{formatNumber(segment.count)}</span>
              <span className={`audience-side ${segment.side}`}>{sideLabel(segment.side)}</span>
              {segment.derivation && (
                <span className="derivation">= {segment.derivation}</span>
              )}
            </div>
          );
        })}
      </div>

      {data.error && (
        <p className="card-subtitle" style={{ color: '#a16207' }}>
          Last refresh warning: {data.error}
        </p>
      )}
    </BentoCard>
  );
}

function shortLabel(segment: Audience): string {
  switch (segment.key) {
    case 'inferred_kano':
      return 'Kano (inferred)';
    case 'stemplayer_purchasers':
      return 'SP Purchasers';
    case 'stem2_high_spenders':
      return 'Stem 2 high spenders';
    case 'stemplayer_no_purchase':
      return 'SP no-purchase';
    case 'stem2_product_interest':
      return 'Stem 2 interest';
    default:
      return segment.label;
  }
}

function sideLabel(side: Audience['side']): string {
  switch (side) {
    case 'kano':
      return 'Kano';
    case 'stemplayer':
      return 'Stemplayer';
    case 'combined':
      return 'Raw combined';
  }
}
