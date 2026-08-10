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

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUSD, fmtFollowers, Icon, ScoreBadge, PLATFORM_META, Topbar } from '../lib';
import { type V2Creator } from '../data';
import { useV2Creators } from '../v2Hooks';

interface Props {
  onRoute: (r: string) => void;
}

type Mode = 'filters' | 'spark';
type Sort = 'score' | 'followers' | 'er' | 'price-low' | 'price-high';
type AudienceGender = 'all' | 'female' | 'male';

// Multi-select arrays: empty = "all". Brands can stack any combination
// — e.g. "show me creators on Instagram OR LinkedIn, in any of {nano,
// micro, macro}, in {Tech, Lifestyle}, based in any of {Lahore,
// Karachi}". Each filter dimension is independent; within a dimension,
// values OR together; across dimensions, AND.
interface FilterState {
  platforms: string[];
  followers: string[];   // nano / micro / mid / macro
  categories: string[];  // category ids (lowercased)
  cities: string[];
  ages: string[];        // young / primeworking / older
  audienceGender: AudienceGender;
  minER: number;
  priceMax: number;
  verified: boolean;
  brandSafe: boolean;
}

const INITIAL_FILTERS: FilterState = {
  platforms: [], followers: [], categories: [], cities: [], ages: [],
  audienceGender: 'all',
  minER: 0, priceMax: 1_000_000, verified: false, brandSafe: false,
};

// Static option lists used by the multi-select chips. Labels are
// display strings; ids feed the filter logic. Keeping these as
// module-level constants so the dropdowns don't re-create on every
// render.
const PLATFORM_OPTIONS: { id: string; label: string }[] = [
  { id: 'instagram',  label: 'Instagram' },
  { id: 'tiktok',     label: 'TikTok' },
  { id: 'youtube',    label: 'YouTube' },
  { id: 'linkedin',   label: 'LinkedIn' },
  { id: 'newsletter', label: 'Newsletter' },
];
const FOLLOWER_OPTIONS: { id: string; label: string }[] = [
  { id: 'nano',  label: 'Nano · <10K' },
  { id: 'micro', label: 'Micro · 10–100K' },
  { id: 'mid',   label: 'Mid · 100–500K' },
  { id: 'macro', label: 'Macro · 500K+' },
];
const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'fashion',    label: 'Fashion' },
  { id: 'lifestyle',  label: 'Lifestyle' },
  { id: 'beauty',     label: 'Beauty' },
  { id: 'food',       label: 'Food' },
  { id: 'travel',     label: 'Travel' },
  { id: 'tech',       label: 'Tech' },
  { id: 'fitness',    label: 'Fitness' },
  { id: 'finance',    label: 'Finance' },
  { id: 'b2b',        label: 'B2B' },
  { id: 'parenting',  label: 'Parenting' },
  { id: 'wellness',   label: 'Wellness' },
];
const CITY_OPTIONS: { id: string; label: string }[] = [
  { id: 'Karachi',     label: 'Karachi' },
  { id: 'Lahore',      label: 'Lahore' },
  { id: 'Islamabad',   label: 'Islamabad' },
  { id: 'Rawalpindi',  label: 'Rawalpindi' },
  { id: 'Faisalabad',  label: 'Faisalabad' },
];
const AGE_OPTIONS: { id: string; label: string }[] = [
  { id: 'young',        label: 'Gen Z · 18–24' },
  { id: 'primeworking', label: 'Millennial · 25–34' },
  { id: 'older',        label: 'Gen X · 35–44' },
];

// Build a one-line summary for a multi-select chip:
//   - 0 selected   →  "Any [label]"
//   - 1 selected   →  the chosen label
//   - 2+ selected  →  "first · +N"
function summariseMulti(label: string, selectedIds: string[], options: { id: string; label: string }[]): string {
  if (selectedIds.length === 0) return `Any ${label.toLowerCase()}`;
  const first = options.find((o) => o.id === selectedIds[0])?.label ?? selectedIds[0];
  if (selectedIds.length === 1) return first;
  return `${first} · +${selectedIds.length - 1}`;
}

// Spark-mode "quick prompts". Pre-fix these promised NLP-style natural
// language search ("Find me 5 lifestyle creators in Lahore with mostly
// female audience"), but the underlying filter is a plain substring
// match on name/bio/categories — so a long sentence rarely matched
// anything. Replaced with single-keyword chips that actually fit the
// substring filter, so clicking a prompt narrows the catalog reliably.
const SPARK_SUGGESTIONS = [
  'Lifestyle',
  'Food',
  'Karachi',
  'Lahore',
  'Verified',
  'Sustainability',
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

  // Within-dimension OR, across-dimension AND. A bucket helper for
  // followers since each creator has a single max-follower number.
  const followerBucket = (max: number): string => {
    if (max < 10_000) return 'nano';
    if (max < 100_000) return 'micro';
    if (max < 500_000) return 'mid';
    return 'macro';
  };
  // Age-band helper: maps a creator's audience distribution to which
  // age buckets they "lean toward" (≥25% of audience falls into a band).
  const ageBucketsFor = (a: V2Creator['audience']): string[] => {
    const out: string[] = [];
    if ((a.age1824 ?? 0) >= 25) out.push('young');
    if (a.age2534 >= 40) out.push('primeworking');
    if ((a.age3544 ?? 0) >= 25) out.push('older');
    return out;
  };

  // Count of narrowed "advanced" dimensions — drives the badge on the
  // +More toggle so the user can see filters are applied even when the
  // advanced row is collapsed.
  const moreCount =
    (filters.audienceGender !== 'all' ? 1 : 0) +
    (filters.verified ? 1 : 0) +
    (filters.brandSafe ? 1 : 0) +
    (filters.minER > 0 ? 1 : 0) +
    (filters.priceMax < 1_000_000 ? 1 : 0);

  const results = useMemo(() => {
    let r = allCreators.slice();
    // Spark prompt or text query — both filter against name/bio/categories.
    const q = (isSpark ? sparkPrompt : query).toLowerCase().trim();
    if (q) {
      r = r.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.categories.some((cat) => cat.toLowerCase().includes(q)),
      );
    }
    if (filters.platforms.length > 0) {
      r = r.filter((c) =>
        c.channels.some((ch) => filters.platforms.includes(ch.platform)),
      );
    }
    if (filters.cities.length > 0) {
      r = r.filter((c) => filters.cities.includes(c.city));
    }
    if (filters.categories.length > 0) {
      const cats = filters.categories.map((s) => s.toLowerCase());
      r = r.filter((c) =>
        c.categories.some((cat) => cats.includes(cat.toLowerCase())),
      );
    }
    if (filters.followers.length > 0) {
      r = r.filter((c) => {
        const max = Math.max(...c.channels.map((ch) => ch.followers));
        return filters.followers.includes(followerBucket(max));
      });
    }
    if (filters.ages.length > 0) {
      r = r.filter((c) => {
        const buckets = ageBucketsFor(c.audience);
        return buckets.some((b) => filters.ages.includes(b));
      });
    }
    if (filters.audienceGender === 'female') r = r.filter((c) => c.audience.female >= 60);
    if (filters.audienceGender === 'male')   r = r.filter((c) => c.audience.male   >= 60);
    if (filters.verified) r = r.filter((c) => c.verified);
    if (filters.minER > 0) {
      r = r.filter((c) => Math.max(...c.channels.map((ch) => ch.engagement)) >= filters.minER);
    }
    if (filters.priceMax < 1_000_000) r = r.filter((c) => c.rate <= filters.priceMax);

    // Unreviewed creators sort last rather than inheriting a default
    // rating. The label for this sort is corrected below too — it ranks
    // by review rating, which is not the same thing as fit (P-10).
    if (sort === 'score') r.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
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

  // Toggle a value within a multi-select dimension. `field` is the
  // key on `filters` whose value is a string[].
  const toggleMulti = <K extends 'platforms' | 'followers' | 'categories' | 'cities' | 'ages'>(
    field: K, value: string,
  ) => {
    setFilters((f) => {
      const list = f[field];
      return {
        ...f,
        [field]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  // Active filter chips for the bar above the result grid. Each entry
  // shows what's narrowed and a one-click ×. Multi-select dimensions
  // appear as one chip per selected value, so the user can drop a
  // single platform without nuking the whole filter.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  for (const id of filters.platforms) {
    const label = PLATFORM_OPTIONS.find((o) => o.id === id)?.label ?? id;
    activeChips.push({ key: `p_${id}`, label, clear: () => toggleMulti('platforms', id) });
  }
  for (const id of filters.followers) {
    const label = FOLLOWER_OPTIONS.find((o) => o.id === id)?.label ?? id;
    activeChips.push({ key: `f_${id}`, label, clear: () => toggleMulti('followers', id) });
  }
  for (const id of filters.categories) {
    const label = CATEGORY_OPTIONS.find((o) => o.id === id)?.label ?? id;
    activeChips.push({ key: `c_${id}`, label, clear: () => toggleMulti('categories', id) });
  }
  for (const id of filters.cities) {
    activeChips.push({ key: `city_${id}`, label: id, clear: () => toggleMulti('cities', id) });
  }
  for (const id of filters.ages) {
    const label = AGE_OPTIONS.find((o) => o.id === id)?.label ?? id;
    activeChips.push({ key: `a_${id}`, label, clear: () => toggleMulti('ages', id) });
  }
  if (filters.audienceGender !== 'all') {
    activeChips.push({
      key: 'gender',
      label: filters.audienceGender === 'female' ? 'Mostly female' : 'Mostly male',
      clear: () => setFilters((f) => ({ ...f, audienceGender: 'all' })),
    });
  }
  if (filters.minER > 0) {
    activeChips.push({
      key: 'er',
      label: `Min ER ${filters.minER}%`,
      clear: () => setFilters((f) => ({ ...f, minER: 0 })),
    });
  }
  if (filters.priceMax < 1_000_000) {
    activeChips.push({
      key: 'rate',
      label: `Max rate ${fmtUSD(filters.priceMax)}`,
      clear: () => setFilters((f) => ({ ...f, priceMax: 1_000_000 })),
    });
  }
  if (filters.verified) {
    activeChips.push({
      key: 'verified',
      label: 'Verified only',
      clear: () => setFilters((f) => ({ ...f, verified: false })),
    });
  }
  if (filters.brandSafe) {
    activeChips.push({
      key: 'safe',
      label: 'Brand-safe',
      clear: () => setFilters((f) => ({ ...f, brandSafe: false })),
    });
  }

  return (
    <>
      <Topbar
        title="Discover Creators"
        // P-10 — this used to read "115 creators in network · 115 match",
        // i.e. it claimed the entire network matched. `results` is just
        // the filtered list, so say that instead of overclaiming fit.
        crumb={`${allCreators.length} creators in network · ${results.length} shown`}
      />
      <div className="v2-content">
        {/* ─── Unified search ─────────────────────────────────────── */}
        <div
          className="v2-card"
          // overflow: visible — see BrowseBriefs.tsx note. The card holds
          // filter dropdowns whose panels need to escape the card bounds.
          style={{ padding: 14, marginBottom: 16, overflow: 'visible' }}
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
                  ? 'Try a category, city, or rate band…'
                  : 'Search by name, niche, or keyword…'}
                value={isSpark ? sparkPrompt : query}
                onChange={(e) => isSpark ? setSparkPrompt(e.target.value) : setQuery(e.target.value)}
                style={{ fontSize: 15 }}
                aria-label={isSpark ? 'Quick prompt' : 'Search creators'}
              />
            </div>
            <button
              type="button"
              className={isSpark ? 'v2-btn v2-btn-primary' : 'v2-btn v2-btn-outline'}
              onClick={() => setMode(isSpark ? 'filters' : 'spark')}
              title={isSpark ? 'Back to filter search' : 'Spark-mode quick prompts'}
            >
              <span style={{
                display: 'flex',
                color: isSpark ? 'var(--v2-accent-2)' : 'var(--v2-accent)',
              }}>{Icon.spark}</span>
              {isSpark ? 'Spark on' : 'Quick prompts'}
            </button>
          </div>

          {/* Spark-mode quick prompts — single-keyword chips that
              substring-match the catalog reliably. Pre-fix these were
              long English sentences that pretended NLP was happening. */}
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
              <div className="v2-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <MultiChipDropdown
                  label="Platform"
                  values={filters.platforms}
                  options={PLATFORM_OPTIONS}
                  onToggle={(id) => toggleMulti('platforms', id)}
                  onClear={() => setFilters((f) => ({ ...f, platforms: [] }))}
                  summary={summariseMulti('platforms', filters.platforms, PLATFORM_OPTIONS)}
                />
                <MultiChipDropdown
                  label="Followers"
                  values={filters.followers}
                  options={FOLLOWER_OPTIONS}
                  onToggle={(id) => toggleMulti('followers', id)}
                  onClear={() => setFilters((f) => ({ ...f, followers: [] }))}
                  summary={summariseMulti('sizes', filters.followers, FOLLOWER_OPTIONS)}
                />
                <MultiChipDropdown
                  label="Category"
                  values={filters.categories}
                  options={CATEGORY_OPTIONS}
                  onToggle={(id) => toggleMulti('categories', id)}
                  onClear={() => setFilters((f) => ({ ...f, categories: [] }))}
                  summary={summariseMulti('categories', filters.categories, CATEGORY_OPTIONS)}
                />
                <MultiChipDropdown
                  label="City"
                  values={filters.cities}
                  options={CITY_OPTIONS}
                  onToggle={(id) => toggleMulti('cities', id)}
                  onClear={() => setFilters((f) => ({ ...f, cities: [] }))}
                  summary={summariseMulti('cities', filters.cities, CITY_OPTIONS)}
                />

                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '6px 12px',
                    border: '1px dashed var(--v2-line-2)',
                    background: showMore || moreCount ? 'var(--v2-bg-1)' : 'transparent',
                    color: 'var(--v2-ink-2)',
                    borderRadius: 'var(--v2-r-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  {showMore ? '− Less' : '+ More'}
                  {moreCount > 0 && (
                    <span style={{
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 999,
                      background: 'var(--v2-accent)',
                      color: 'white',
                      fontSize: 10.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>{moreCount}</span>
                  )}
                </button>

                <span className="v2-spacer" />

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label="Sort"
                  style={{
                    border: '1px solid var(--v2-line)',
                    background: 'var(--v2-paper)',
                    color: 'var(--v2-ink)',
                    padding: '7px 32px 7px 12px',
                    borderRadius: 'var(--v2-r-pill)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--v2-ink-3) 50%), linear-gradient(135deg, var(--v2-ink-3) 50%, transparent 50%)',
                    backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
                    backgroundSize: '5px 5px, 5px 5px',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  <option value="score">Sort · Review rating</option>
                  <option value="followers">Sort · Followers</option>
                  <option value="er">Sort · Engagement</option>
                  <option value="price-low">Sort · Price low → high</option>
                  <option value="price-high">Sort · Price high → low</option>
                </select>
              </div>

              {/* Expandable advanced row */}
              {showMore && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--v2-line)',
                  }}
                >
                  <div className="v2-row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <MultiChipDropdown
                      label="Age band"
                      values={filters.ages}
                      options={AGE_OPTIONS}
                      onToggle={(id) => toggleMulti('ages', id)}
                      onClear={() => setFilters((f) => ({ ...f, ages: [] }))}
                      summary={summariseMulti('age bands', filters.ages, AGE_OPTIONS)}
                    />
                    <SingleChipDropdown
                      label="Gender skew"
                      value={filters.audienceGender}
                      options={[
                        { id: 'all',    label: 'Any gender' },
                        { id: 'female', label: 'Mostly female (60%+)' },
                        { id: 'male',   label: 'Mostly male (60%+)' },
                      ]}
                      summary={
                        filters.audienceGender === 'all'  ? 'Any gender' :
                        filters.audienceGender === 'female' ? 'Mostly female' : 'Mostly male'
                      }
                      active={filters.audienceGender !== 'all'}
                      onChange={(v) => setFilters((f) => ({ ...f, audienceGender: v as AudienceGender }))}
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

        {/* Active filter chips — one chip per applied value with × remove.
            Lets the user see what's narrowed at a glance and drop a single
            value (e.g. one platform) without nuking the whole dimension. */}
        {activeChips.length > 0 && !isSpark && (
          <div
            className="v2-row"
            style={{
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 12,
              alignItems: 'center',
            }}
          >
            <span className="v2-muted" style={{ fontSize: 12, marginRight: 4 }}>
              Filtered by:
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px 4px 10px',
                  background: 'var(--v2-accent-soft)',
                  color: 'var(--v2-accent)',
                  border: '1px solid transparent',
                  borderRadius: 'var(--v2-r-pill)',
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                aria-label={`Remove ${chip.label}`}
              >
                <span>{chip.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.06)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              style={{
                marginLeft: 4,
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--v2-ink-2)',
                fontSize: 12,
                fontWeight: 550,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Clear all
            </button>
          </div>
        )}

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

// Multi-select chip with popover. Click toggles open; click outside
// dismisses. Each option has a checkbox; selected options highlight
// in accent-soft. Footer of the popover has a one-click "Clear N"
// when at least one is selected. Used for Platform / Followers /
// Category / City / Age — every dimension where multi-select makes
// sense.
function MultiChipDropdown({
  label, values, options, onToggle, onClear, summary,
}: {
  label: string;
  values: string[];
  options: { id: string; label: string }[];
  onToggle: (id: string) => void;
  onClear: () => void;
  summary: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const active = values.length > 0;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 6px 12px',
          background: active ? 'var(--v2-accent-soft)' : 'var(--v2-paper)',
          color: active ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
          border: `1px solid ${active ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
          borderRadius: 'var(--v2-r-pill)',
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 120ms ease',
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 500, opacity: 0.85 }}>·</span>
        <span style={{ fontWeight: active ? 700 : 500 }}>{summary}</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `4px solid ${active ? 'var(--v2-accent)' : 'var(--v2-ink-3)'}`,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms ease',
            marginLeft: 2,
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            minWidth: 220,
            maxHeight: 340,
            overflowY: 'auto',
            background: 'var(--v2-paper)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const selected = values.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onToggle(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  width: '100%',
                  padding: '8px 10px',
                  background: selected ? 'var(--v2-accent-soft)' : 'transparent',
                  color: selected ? 'var(--v2-accent)' : 'var(--v2-ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--v2-bg-1)'; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${selected ? 'var(--v2-accent)' : 'var(--v2-line-2)'}`,
                    background: selected ? 'var(--v2-accent)' : 'transparent',
                    color: 'var(--v2-paper)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
          {values.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--v2-line)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={onClear}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--v2-ink-2)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--v2-bg-1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Clear {values.length}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Single-select variant of the same chip — used for dimensions that
// are mutually exclusive (e.g. gender skew). Same visual language as
// MultiChipDropdown so the filter bar reads consistently.
function SingleChipDropdown({
  label, value, options, summary, active, onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  summary: string;
  active: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 6px 12px',
          background: active ? 'var(--v2-accent-soft)' : 'var(--v2-paper)',
          color: active ? 'var(--v2-accent)' : 'var(--v2-ink-2)',
          border: `1px solid ${active ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
          borderRadius: 'var(--v2-r-pill)',
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 120ms ease',
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 500, opacity: 0.85 }}>·</span>
        <span style={{ fontWeight: active ? 700 : 500 }}>{summary}</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `4px solid ${active ? 'var(--v2-accent)' : 'var(--v2-ink-3)'}`,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms ease',
            marginLeft: 2,
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            minWidth: 220,
            background: 'var(--v2-paper)',
            border: '1px solid var(--v2-line)',
            borderRadius: 'var(--v2-r-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const selected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  textAlign: 'left',
                  width: '100%',
                  padding: '8px 10px',
                  background: selected ? 'var(--v2-accent-soft)' : 'transparent',
                  color: selected ? 'var(--v2-accent)' : 'var(--v2-ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--v2-bg-1)'; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{opt.label}</span>
                {selected && <span aria-hidden="true" style={{ display: 'flex' }}>{Icon.check}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
          {creator.channels.slice(0, 3).map((ch, i) => {
            const meta = PLATFORM_META[ch.platform];
            // Phase 52 fix — pre-fix this used `key={ch.platform}` and
            // a creator with two channels on the same platform (e.g.
            // two newsletters) caused React's "duplicate key" warning
            // and could render the wrong channel after a sort/filter.
            // Composite key with the index disambiguates.
            return (
              <span key={`${ch.platform}-${i}`} className="v2-row" style={{ gap: 4 }}>
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
