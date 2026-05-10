// Discover.tsx · v2 brand-side creator search · refined per design spec
//
// Three big shifts vs the pre-§refined version:
//   1. Unified search — single input, the Spark toggle flips it between
//      "search by name/keyword" and "describe in plain English". Was
//      previously a search bar plus a separate "Ask Spark instead"
//      button that routed the user away; now Spark stays inline.
//   2. Filter row collapsed — 4 primary chips (Platform / Followers /
//      Category / City) stay visible by default, with "+ More filters"
//      expanding the rest (Audience gender, Age, Min ER, Max rate,
//      Verified, Brand-safe). Sort sits flush right via `v2-spacer`.
//   3. Lighter cards — drop the "Why match" / category pill clutter;
//      surface channels + ER inline on one line, an audience summary
//      with a slim gender-split bar, and past brands in a single muted
//      line. Total reach + price tier drop to the footer.

import { useMemo, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, ScoreBadge, PLATFORM_META, Topbar } from '../lib';
import { type V2Creator } from '../data';
import { useV2Creators } from '../v2Hooks';

interface Props {
  onRoute: (r: string) => void;
}

type Mode = 'filters' | 'spark';
type Sort = 'score' | 'followers' | 'er' | 'price-low' | 'price-high';

interface FilterState {
  // Primary (always visible)
  platform: string;
  follower: string;
  category: string;
  city: string;
  // Advanced (under +More)
  audienceGender: 'all' | 'female' | 'male';
  audienceAge: 'all' | 'young' | 'primeworking' | 'older';
  minER: number;          // 0 means off; pct
  priceMax: number;       // huge default means off
  verified: boolean;
  brandSafe: boolean;
}

const INITIAL_FILTERS: FilterState = {
  platform: 'all', follower: 'all', category: 'all', city: 'all',
  audienceGender: 'all', audienceAge: 'all',
  minER: 0, priceMax: 1_000_000, verified: false, brandSafe: false,
};

const SPARK_SUGGESTIONS = [
  'Find me 5 lifestyle creators in Lahore with mostly female audience',
  'Tech reviewers under $1,500 with 5%+ engagement',
  'Verified food creators in Karachi for an Eid campaign',
];

export function Discover({ onRoute }: Props) {
  const [mode, setMode] = useState<Mode>('filters');
  const [query, setQuery] = useState('');
  const [sparkPrompt, setSparkPrompt] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sort, setSort] = useState<Sort>('score');
  const [showMore, setShowMore] = useState(false);
  const allCreators = useV2Creators();

  const isSpark = mode === 'spark';

  // Active-count chip — used by `Clear N` and the +More filters badge.
  const moreCount =
    (filters.audienceGender !== 'all' ? 1 : 0) +
    (filters.audienceAge !== 'all' ? 1 : 0) +
    (filters.verified ? 1 : 0) +
    (filters.brandSafe ? 1 : 0) +
    (filters.minER > 0 ? 1 : 0) +
    (filters.priceMax < 1_000_000 ? 1 : 0);
  const primaryCount =
    (filters.platform !== 'all' ? 1 : 0) +
    (filters.follower !== 'all' ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.city !== 'all' ? 1 : 0);
  const activeCount = primaryCount + moreCount;

  const results = useMemo(() => {
    let r = allCreators.slice();
    // Spark prompt or text query — both filter against name/bio/categories
    // for now. The Spark mode in the design also scores prompt keywords;
    // we keep that minimal here and let the user iterate via filters.
    const q = (isSpark ? sparkPrompt : query).toLowerCase().trim();
    if (q) {
      r = r.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.categories.some((cat) => cat.toLowerCase().includes(q)),
      );
    }
    if (filters.platform !== 'all') {
      r = r.filter((c) => c.channels.some((ch) => ch.platform === filters.platform));
    }
    if (filters.city !== 'all') r = r.filter((c) => c.city === filters.city);
    if (filters.category !== 'all') {
      r = r.filter((c) =>
        c.categories.some((cat) => cat.toLowerCase() === filters.category.toLowerCase()),
      );
    }
    if (filters.follower !== 'all') {
      r = r.filter((c) => {
        const max = Math.max(...c.channels.map((ch) => ch.followers));
        if (filters.follower === 'nano') return max < 10_000;
        if (filters.follower === 'micro') return max >= 10_000 && max < 100_000;
        if (filters.follower === 'mid') return max >= 100_000 && max < 500_000;
        if (filters.follower === 'macro') return max >= 500_000;
        return true;
      });
    }
    if (filters.audienceGender === 'female') r = r.filter((c) => c.audience.female >= 60);
    if (filters.audienceGender === 'male')   r = r.filter((c) => c.audience.male   >= 60);
    if (filters.audienceAge === 'young') {
      r = r.filter((c) => (c.audience.age1824 ?? 0) >= 25);
    } else if (filters.audienceAge === 'primeworking') {
      r = r.filter((c) => c.audience.age2534 >= 40);
    } else if (filters.audienceAge === 'older') {
      r = r.filter((c) => (c.audience.age3544 ?? 0) >= 25);
    }
    if (filters.verified) r = r.filter((c) => c.verified);
    if (filters.minER > 0) {
      r = r.filter((c) => Math.max(...c.channels.map((ch) => ch.engagement)) >= filters.minER);
    }
    if (filters.priceMax < 1_000_000) r = r.filter((c) => c.rate <= filters.priceMax);

    if (sort === 'score') r.sort((a, b) => b.score - a.score);
    else if (sort === 'followers') {
      r.sort((a, b) =>
        Math.max(...b.channels.map((ch) => ch.followers)) -
        Math.max(...a.channels.map((ch) => ch.followers)),
      );
    } else if (sort === 'er') {
      r.sort((a, b) =>
        Math.max(...b.channels.map((ch) => ch.engagement)) -
        Math.max(...a.channels.map((ch) => ch.engagement)),
      );
    } else if (sort === 'price-low')  r.sort((a, b) => a.rate - b.rate);
    else if (sort === 'price-high')   r.sort((a, b) => b.rate - a.rate);
    return r;
  }, [allCreators, filters, query, sparkPrompt, isSpark, sort]);

  const clearAll = () => setFilters(INITIAL_FILTERS);

  return (
    <>
      <Topbar
        title="Discover creators"
        crumb={`${allCreators.length} creators in network · ${results.length} match`}
      />
      <div className="v2-content">
        {/* ─── Unified search ─────────────────────────────────────── */}
        <div
          className="v2-card"
          style={{ padding: 14, marginBottom: 16 }}
        >
          {/* Search row — input + Spark toggle */}
          <div className="v2-row" style={{ gap: 8, alignItems: 'stretch' }}>
            <div
              className="v2-input-search"
              style={{
                flex: 1,
                borderColor: isSpark ? 'var(--v2-accent)' : 'var(--v2-line)',
                boxShadow: isSpark ? '0 0 0 3px var(--v2-accent-soft)' : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <span style={{ color: isSpark ? 'var(--v2-accent)' : 'var(--v2-ink-3)', display: 'flex' }}>
                {isSpark ? Icon.spark : Icon.search}
              </span>
              <input
                placeholder={isSpark
                  ? "Describe who you're looking for in plain English…"
                  : 'Search by name, niche, or keyword…'}
                value={isSpark ? sparkPrompt : query}
                onChange={(e) => isSpark ? setSparkPrompt(e.target.value) : setQuery(e.target.value)}
                style={{ fontSize: 15 }}
                aria-label={isSpark ? 'Spark prompt' : 'Search creators'}
              />
            </div>
            <button
              type="button"
              className={isSpark ? 'v2-btn v2-btn-primary' : 'v2-btn v2-btn-outline'}
              onClick={() => setMode(isSpark ? 'filters' : 'spark')}
              title={isSpark ? 'Back to filter search' : 'Search in plain English with Spark'}
            >
              <span style={{
                display: 'flex',
                color: isSpark ? 'var(--v2-accent-2)' : 'var(--v2-accent)',
              }}>{Icon.spark}</span>
              {isSpark ? 'Spark on' : 'Ask Spark'}
            </button>
          </div>

          {/* Spark-mode quick suggestions when no prompt yet. */}
          {isSpark && !sparkPrompt && (
            <div className="v2-row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <span className="v2-muted" style={{ fontSize: 12, alignSelf: 'center' }}>Try:</span>
              {SPARK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSparkPrompt(s)}
                  className="v2-pill"
                  style={{ cursor: 'pointer', fontSize: 12 }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Filter chips + Sort — only in filters mode. */}
          {!isSpark && (
            <>
              <div className="v2-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <FilterChip
                  label="Platform"
                  value={filters.platform}
                  options={[
                    ['all', 'All platforms'],
                    ['instagram', 'Instagram'],
                    ['tiktok', 'TikTok'],
                    ['youtube', 'YouTube'],
                    ['linkedin', 'LinkedIn'],
                    ['newsletter', 'Newsletter'],
                  ]}
                  onChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
                />
                <FilterChip
                  label="Followers"
                  value={filters.follower}
                  options={[
                    ['all', 'Any size'],
                    ['nano', 'Nano (<10K)'],
                    ['micro', 'Micro (10–100K)'],
                    ['mid', 'Mid (100–500K)'],
                    ['macro', 'Macro (500K+)'],
                  ]}
                  onChange={(v) => setFilters((f) => ({ ...f, follower: v }))}
                />
                <FilterChip
                  label="Category"
                  value={filters.category}
                  options={[
                    ['all', 'All categories'],
                    ['fashion', 'Fashion'],
                    ['food', 'Food'],
                    ['travel', 'Travel'],
                    ['tech', 'Tech'],
                    ['fitness', 'Fitness'],
                    ['finance', 'Finance'],
                    ['b2b', 'B2B'],
                    ['parenting', 'Parenting'],
                  ]}
                  onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                />
                <FilterChip
                  label="City"
                  value={filters.city}
                  options={[
                    ['all', 'All cities'],
                    ['Karachi', 'Karachi'],
                    ['Lahore', 'Lahore'],
                    ['Islamabad', 'Islamabad'],
                  ]}
                  onChange={(v) => setFilters((f) => ({ ...f, city: v }))}
                />

                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  className="v2-pill"
                  style={{
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 550,
                    border: '1px dashed var(--v2-line-2)',
                    background: showMore || moreCount ? 'var(--v2-bg-2)' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {showMore ? '− Less' : '+ More filters'}
                  {moreCount > 0 && (
                    <span style={{
                      padding: '0 6px',
                      borderRadius: 999,
                      background: 'var(--v2-accent)',
                      color: 'white',
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}>{moreCount}</span>
                  )}
                </button>

                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '6px 4px',
                      fontSize: 12,
                      color: 'var(--v2-ink-3)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear {activeCount}
                  </button>
                )}

                <span className="v2-spacer" />

                <FilterChip
                  label="Sort"
                  value={sort}
                  options={[
                    ['score', 'Alamut score'],
                    ['followers', 'Followers'],
                    ['er', 'Engagement'],
                    ['price-low', 'Price · low → high'],
                    ['price-high', 'Price · high → low'],
                  ]}
                  onChange={(v) => setSort(v as Sort)}
                />
              </div>

              {/* Expandable advanced row. */}
              {showMore && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--v2-line)',
                  }}
                >
                  <div className="v2-row" style={{ gap: 14, flexWrap: 'wrap' }}>
                    <FilterChip
                      label="Audience"
                      value={filters.audienceGender}
                      options={[
                        ['all', 'Any gender'],
                        ['female', 'Mostly female (60%+)'],
                        ['male', 'Mostly male (60%+)'],
                      ]}
                      onChange={(v) => setFilters((f) => ({ ...f, audienceGender: v as FilterState['audienceGender'] }))}
                    />
                    <FilterChip
                      label="Age"
                      value={filters.audienceAge}
                      options={[
                        ['all', 'Any age'],
                        ['young', 'Gen Z (18–24)'],
                        ['primeworking', 'Millennial (25–34)'],
                        ['older', 'Gen X (35–44)'],
                      ]}
                      onChange={(v) => setFilters((f) => ({ ...f, audienceAge: v as FilterState['audienceAge'] }))}
                    />
                    <RangeChip
                      label="Min ER"
                      value={filters.minER}
                      min={0}
                      max={10}
                      step={0.5}
                      format={(v) => `${v}%`}
                      onChange={(v) => setFilters((f) => ({ ...f, minER: v }))}
                    />
                    <RangeChip
                      label="Max rate"
                      value={filters.priceMax}
                      min={500}
                      max={1_000_000}
                      step={500}
                      format={(v) => v >= 1_000_000 ? 'Any' : fmtUSD(v)}
                      onChange={(v) => setFilters((f) => ({ ...f, priceMax: v }))}
                    />
                    <ToggleChip
                      label="Verified only"
                      checked={filters.verified}
                      onChange={(v) => setFilters((f) => ({ ...f, verified: v }))}
                    />
                    <ToggleChip
                      label="Brand-safe"
                      checked={filters.brandSafe}
                      onChange={(v) => setFilters((f) => ({ ...f, brandSafe: v }))}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Result count line */}
        <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="v2-muted">
            {results.length} {results.length === 1 ? 'creator' : 'creators'}
            {isSpark && sparkPrompt ? ' · Spark match' : ' · matching your filters'}
          </div>
          <div className="v2-muted" style={{ fontSize: 12 }}>
            Showing strongest matches first
          </div>
        </div>

        {/* Creator card grid */}
        {results.length > 0 ? (
          <div className="v2-grid-3">
            {results.map((c) => (
              <CreatorCard
                key={c.id}
                creator={c}
                onClick={() => onRoute(`creator:${c.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center' }}>
            <div className="v2-muted">No creators match — try widening your filters.</div>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function FilterChip({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? options[0][1];
  return (
    <label className="v2-filter-chip" style={{ position: 'relative' }}>
      <span className="v2-muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{current}</span>
      <span className="v2-muted" aria-hidden="true">▾</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {options.map(([v, lbl]) => (
          <option key={v} value={v}>{lbl}</option>
        ))}
      </select>
    </label>
  );
}

function RangeChip({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="v2-filter-chip" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span className="v2-muted" style={{ fontSize: 11.5, marginRight: 4 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 100 }}
        aria-label={label}
      />
      <span className="v2-tabular" style={{ fontWeight: 500, fontSize: 12 }}>
        {format(value)}
      </span>
    </label>
  );
}

function ToggleChip({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="v2-filter-chip" style={{ cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginRight: 4 }}
      />
      <span style={{ fontWeight: 500 }}>{label}</span>
    </label>
  );
}

function CreatorCard({ creator, onClick }: {
  creator: V2Creator;
  onClick: () => void;
}) {
  const topChannel = creator.channels.reduce(
    (a, b) => a.followers > b.followers ? a : b,
    creator.channels[0],
  );
  const totalFollowers = creator.channels.reduce((s, ch) => s + ch.followers, 0);

  return (
    <article
      className="v2-card v2-card-clickable"
      onClick={onClick}
      style={{ overflow: 'hidden' }}
    >
      {/* Cover band — slimmer than pre-§refined; fewer overlay pills. */}
      <div
        style={{
          height: 70,
          background: `url(${creator.cover}) center/cover, var(--v2-bg-2)`,
          position: 'relative',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent, rgba(28, 26, 21, 0.30))',
          }}
        />
        {creator.availability?.vacationMode && (
          <span
            className="v2-pill"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'var(--v2-accent-soft)',
              color: 'var(--v2-accent)',
              border: '1px solid var(--v2-accent)',
              fontSize: 11,
            }}
            title={
              creator.availability.untilDate
                ? `Back ${new Date(creator.availability.untilDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Not actively monitoring'
            }
          >
            ✈ Vacation
          </span>
        )}
      </div>

      <div style={{ padding: '0 16px 16px', marginTop: -24, position: 'relative' }}>
        <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div
            className="v2-avatar v2-avatar-lg"
            style={{
              backgroundImage: `url(${creator.avatar})`,
              border: '3px solid var(--v2-paper)',
              width: 52,
              height: 52,
              borderRadius: 14,
            }}
            aria-label={creator.name}
          />
          <ScoreBadge score={creator.score} />
        </div>

        {/* Name + verified glyph + handle/city. */}
        <div className="v2-row" style={{ marginTop: 8, gap: 6 }}>
          <h3
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 17,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.02em',
              color: 'var(--v2-ink)',
            }}
          >
            {creator.name}
          </h3>
          {creator.verified && (
            <span style={{ color: 'var(--v2-info)', display: 'flex' }} title="Verified">
              {Icon.check}
            </span>
          )}
        </div>
        <div className="v2-muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
          @{creator.handle} · {creator.city}
        </div>

        {/* Channels + ER on one line — top 3 platforms with follower
            count, then the dominant channel's ER %. Replaces the older
            channel-pill row + per-card category-pill cluster. */}
        <div
          className="v2-row"
          style={{ gap: 10, marginBottom: 10, flexWrap: 'wrap', fontSize: 11.5 }}
        >
          {creator.channels.slice(0, 3).map((ch) => {
            const meta = PLATFORM_META[ch.platform];
            return (
              <span key={ch.platform} className="v2-row" style={{ gap: 4 }}>
                <span style={{ color: meta.color, display: 'flex' }}>{meta.icon}</span>
                <span className="v2-tabular" style={{ fontWeight: 550 }}>
                  {fmtFollowers(ch.followers)}
                </span>
              </span>
            );
          })}
          <span style={{ color: 'var(--v2-moss)', fontWeight: 600 }}>
            · {topChannel.engagement}% ER
          </span>
        </div>

        {/* Audience — one-line summary + slim gender-split bar. */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--v2-ink-2)', marginBottom: 4 }}>
            <span style={{ fontWeight: 550 }}>{creator.audience.female}%</span> female ·{' '}
            <span style={{ fontWeight: 550 }}>{creator.audience.age2534}%</span> 25–34 ·{' '}
            <span>{creator.audience.topCity}</span>
          </div>
          <div style={{
            display: 'flex',
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
            background: 'var(--v2-bg-2)',
          }}>
            <div style={{ width: `${creator.audience.female}%`, background: 'var(--v2-accent)' }} />
            <div style={{ width: `${creator.audience.male}%`,   background: 'var(--v2-moss)'   }} />
          </div>
        </div>

        {/* Past brands — quieter inline line, capped at 2 with "+N more". */}
        {creator.pastBrands.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--v2-ink-3)', marginBottom: 12, lineHeight: 1.5 }}>
            <span>Worked with </span>
            <span style={{ color: 'var(--v2-ink-2)', fontWeight: 550 }}>
              {creator.pastBrands.slice(0, 2).join(', ')}
              {creator.pastBrands.length > 2 && ` +${creator.pastBrands.length - 2}`}
            </span>
          </div>
        )}

        {/* Footer row: total reach + price tier. */}
        <div
          className="v2-row"
          style={{
            justifyContent: 'space-between',
            borderTop: '1px solid var(--v2-line)',
            paddingTop: 10,
          }}
        >
          <div>
            <div className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Total reach
            </div>
            <div
              className="v2-tabular"
              style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {fmtFollowers(totalFollowers)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              From
            </div>
            <div
              className="v2-tabular"
              style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--v2-accent)',
              }}
            >
              {fmtUSD(creator.priceMin)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
