'use client';

import { useEffect, useMemo, useState } from 'react';
import { BentoCard } from './BentoCard';
import { formatNumber, type Snapshot, type Audience } from '../lib/types';

const STORAGE_KEY = 'fhd:selected-segment';

function loadSelected(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function MailchimpTile({ data }: { data: Snapshot['mailchimp'] }) {
  const disjoint = useMemo(
    () => data.audiences.filter((a) => a.key !== 'kano_stemplayer_combined'),
    [data.audiences],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelected(loadSelected());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (selected) {
        window.localStorage.setItem(STORAGE_KEY, selected);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [selected, hydrated]);

  function handleChipClick(key: string) {
    setSelected((prev) => (prev === key ? null : key));
  }

  const selectedSegment = selected
    ? disjoint.find((a) => a.key === selected)
    : null;

  const displayValue = selectedSegment
    ? selectedSegment.count
    : data.cumulativeDisjoint;

  const caption = selectedSegment
    ? `Showing: ${selectedSegment.label}`
    : 'Showing: all segments combined';

  return (
    <BentoCard
      title="Email funnel — Mailchimp"
      subtitle="us4"
      iconLetter="MC"
      headerExtra={
        selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              background: 'transparent',
              color: 'var(--gray-900)',
              border: '1px solid rgb(31 31 31 / 0.24)',
              minHeight: 0,
              padding: '0.34rem 0.7rem',
              fontSize: '0.78rem',
            }}
          >
            Show all
          </button>
        ) : null
      }
    >
      <div className="hero-stat">
        <span className="hero-stat-label">
          {selectedSegment ? 'Segment subscribers' : 'Cumulative subscribers'}
        </span>
        <span className="hero-stat-value">{formatNumber(displayValue)}</span>
        <span className="hero-stat-caption">{caption}</span>
      </div>

      <div className="segment-filter" role="group" aria-label="Segment filters">
        {disjoint.map((segment) => {
          const on = selected === segment.key;
          return (
            <button
              key={segment.key}
              type="button"
              className={`segment-chip${on ? ' active' : ''}`}
              onClick={() => handleChipClick(segment.key)}
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
          const isHighlighted = !selected || segment.key === selected || !inDisjoint;
          const classes = ['audience-card'];
          if (segment.inferred) classes.push('inferred');
          if (inDisjoint && !isHighlighted) classes.push('inactive');
          if (selected === segment.key) classes.push('selected');
          return (
            <div
              key={segment.key}
              className={classes.join(' ')}
              onClick={() => inDisjoint && handleChipClick(segment.key)}
              role={inDisjoint ? 'button' : undefined}
              tabIndex={inDisjoint ? 0 : undefined}
              onKeyDown={(e) => {
                if (!inDisjoint) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleChipClick(segment.key);
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

      {data.mailchimpLocations && data.mailchimpLocations.length > 0 && (
        <div className="location-section">
          <span className="stat-label">Top countries</span>
          <div className="location-grid">
            {data.mailchimpLocations.slice(0, 10).map((loc) => (
              <div key={loc.country} className="location-row">
                <span className="location-country">{loc.country}</span>
                <span className="location-count">{formatNumber(loc.count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
