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
import { fmtUSD, fmtFollowers, Icon, PLATFORM_META } from '../lib';
import { type V2Creator } from '../data';
import { useV2Campaigns, useV2Creators, useV2BrandShortlist, v2ToggleSavedCreator } from '../v2Hooks';
import { useStore } from '@/lib/api/store';
import { SendBriefModal } from './WorkflowModals';
import { bestEngagement, topChannel } from '../channels';
import { matchCreatorToCampaign } from '../matching';
import { brandAccent } from '../brandPalette';
import { HomeHead, dollars } from './homeParts';
import { perCreatorOf } from './BrowseBriefs';

interface Props {
  onRoute: (r: string) => void;
}

type Sort = 'fit' | 'score' | 'followers' | 'er' | 'price-low' | 'price-high';
const PAGE = 12;
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
}

const INITIAL_FILTERS: FilterState = {
  platforms: [], followers: [], categories: [], cities: [], ages: [],
  audienceGender: 'all',
  minER: 0, priceMax: 1_000_000, verified: false,
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

export function Discover({ onRoute }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const allCreators = useV2Creators();
  const savedIds = useV2BrandShortlist();
  const db = useStore((s) => s.db);

  // Rank for one of the brand's live campaigns: the same matcher creators
  // see on Briefs, run from the brand's side. Defaults to the first live one.
  const liveCampaigns = useV2Campaigns().filter((c) => c.status === 'Live');
  const [forCampaign, setForCampaign] = useState<string>('');
  const campaign = liveCampaigns.find((c) => c.id === forCampaign) ?? liveCampaigns[0];
  const [sort, setSort] = useState<Sort>(liveCampaigns.length > 0 ? 'fit' : 'score');
  const fitScores = useMemo(() => {
    const m = new Map<string, number | null>();
    if (!campaign) return m;
    const raw = db.campaigns.find((c) => c.id === campaign.id);
    const pay = perCreatorOf(campaign);
    for (const c of allCreators) {
      m.set(c.id, matchCreatorToCampaign(db.creators.find((x) => x.id === c.id), raw, db, pay).score);
    }
    return m;
  }, [campaign, allCreators, db]);

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
    // No reported demographics = no age lean. Returning [] means such a
    // creator matches no age filter, which is the honest outcome: we can't
    // claim they fit, and we mustn't invent a distribution to pretend.
    if (!a) return [];
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
    (filters.minER > 0 ? 1 : 0) +
    (filters.priceMax < 1_000_000 ? 1 : 0);

  const results = useMemo(() => {
    let r = allCreators.slice();
    const q = query.toLowerCase().trim();
    if (q) {
      r = r.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
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
        const max = topChannel(c.channels)?.followers ?? 0;
        return filters.followers.includes(followerBucket(max));
      });
    }
    if (filters.ages.length > 0) {
      r = r.filter((c) => {
        const buckets = ageBucketsFor(c.audience);
        return buckets.some((b) => filters.ages.includes(b));
      });
    }
    // Same rule as the age filter: a creator with no reported demographics
    // can't be asserted to match a gender skew, so they drop out of a
    // gender-filtered search rather than being counted as a match.
    if (filters.audienceGender === 'female') r = r.filter((c) => (c.audience?.female ?? 0) >= 60);
    if (filters.audienceGender === 'male')   r = r.filter((c) => (c.audience?.male   ?? 0) >= 60);
    if (filters.verified) r = r.filter((c) => c.verified);
    if (filters.minER > 0) {
      r = r.filter((c) => bestEngagement(c.channels) >= filters.minER);
    }
    if (filters.priceMax < 1_000_000) r = r.filter((c) => c.rate <= filters.priceMax);
    // Open for briefs: not booked up and not away.
    if (openOnly) r = r.filter((c) => c.availability?.status !== 'booked' && !c.availability?.vacationMode);
    if (savedOnly) r = r.filter((c) => savedIds.includes(c.id));

    // Unreviewed creators sort last rather than inheriting a default
    // rating. The label for this sort is corrected below too — it ranks
    // by review rating, which is not the same thing as fit (P-10).
    if (sort === 'fit') r.sort((a, b) => (fitScores.get(b.id) ?? -1) - (fitScores.get(a.id) ?? -1));
    else if (sort === 'score') r.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else if (sort === 'followers') {
      r.sort((a, b) =>
        (topChannel(b.channels)?.followers ?? 0) - (topChannel(a.channels)?.followers ?? 0),
      );
    } else if (sort === 'er') {
      r.sort((a, b) =>
        bestEngagement(b.channels) - bestEngagement(a.channels),
      );
    } else if (sort === 'price-low')  r.sort((a, b) => a.rate - b.rate);
    else if (sort === 'price-high')   r.sort((a, b) => b.rate - a.rate);
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCreators, filters, query, sort, openOnly, savedOnly, savedIds, fitScores]);

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

  const openCount = allCreators.filter((c) => c.availability?.status !== 'booked' && !c.availability?.vacationMode).length;
  const narrowed = activeChips.length > 0 || openOnly || savedOnly || query.trim() !== '';
  const resetPage = () => setShown(PAGE);

  return (
    <div className="v2-hm">
      <div className="v2-hm-ground">
        <HomeHead
          title="Discover"
          sub={`${allCreators.length} creators with published rates. Brief one directly, or save them for later.`}
          actions={<button type="button" className="v2-hm-btn is-dark" onClick={() => onRoute('campaign-new')}>New campaign</button>}
        />
        <div className="v2-ls-bar v2-ls-ground-bar">
          <label className="v2-ls-search">
            {Icon.search}
            <span className="v2-sr-only">Search creators</span>
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPage(); }}
              placeholder="Search by name, niche or city"
            />
          </label>
        </div>
      </div>

      <div className="v2-ls-body">
        <div className="v2-ls-bar is-scroll" role="group" aria-label="Filter creators">
          <MultiChipDropdown
            label="Platform"
            values={filters.platforms}
            options={PLATFORM_OPTIONS}
            onToggle={(id) => { toggleMulti('platforms', id); resetPage(); }}
            onClear={() => setFilters((f) => ({ ...f, platforms: [] }))}
            summary={summariseMulti('platforms', filters.platforms, PLATFORM_OPTIONS)}
          />
          <MultiChipDropdown
            label="Followers"
            values={filters.followers}
            options={FOLLOWER_OPTIONS}
            onToggle={(id) => { toggleMulti('followers', id); resetPage(); }}
            onClear={() => setFilters((f) => ({ ...f, followers: [] }))}
            summary={summariseMulti('sizes', filters.followers, FOLLOWER_OPTIONS)}
          />
          <MultiChipDropdown
            label="Niche"
            values={filters.categories}
            options={CATEGORY_OPTIONS}
            onToggle={(id) => { toggleMulti('categories', id); resetPage(); }}
            onClear={() => setFilters((f) => ({ ...f, categories: [] }))}
            summary={summariseMulti('niches', filters.categories, CATEGORY_OPTIONS)}
          />
          <MultiChipDropdown
            label="City"
            values={filters.cities}
            options={CITY_OPTIONS}
            onToggle={(id) => { toggleMulti('cities', id); resetPage(); }}
            onClear={() => setFilters((f) => ({ ...f, cities: [] }))}
            summary={summariseMulti('cities', filters.cities, CITY_OPTIONS)}
          />
          <button type="button" className="v2-ls-chip" aria-expanded={showMore} aria-pressed={moreCount > 0} onClick={() => setShowMore((v) => !v)}>
            More filters{moreCount > 0 && <b>{moreCount}</b>}
          </button>
          <span className="v2-ls-sep" aria-hidden="true" />
          <button type="button" className="v2-ls-chip" aria-pressed={openOnly} onClick={() => { setOpenOnly((v) => !v); resetPage(); }}>
            Open for briefs <b>{openCount}</b>
          </button>
          <button type="button" className="v2-ls-chip" aria-pressed={savedOnly} onClick={() => { setSavedOnly((v) => !v); resetPage(); }}>
            Saved <b>{savedIds.length}</b>
          </button>
          <select className="v2-ls-chip v2-ls-push" aria-label="Sort creators" value={sort} onChange={(e) => { setSort(e.target.value as Sort); resetPage(); }}>
            {campaign && <option value="fit">Best fit for {campaign.name}</option>}
            <option value="score">Review rating</option>
            <option value="followers">Most followers</option>
            <option value="er">Highest engagement</option>
            <option value="price-low">Lowest price</option>
            <option value="price-high">Highest price</option>
          </select>
        </div>

        {showMore && (
          <div className="v2-ls-bar" role="group" aria-label="More filters">
            <MultiChipDropdown
              label="Audience age"
              values={filters.ages}
              options={AGE_OPTIONS}
              onToggle={(id) => toggleMulti('ages', id)}
              onClear={() => setFilters((f) => ({ ...f, ages: [] }))}
              summary={summariseMulti('ages', filters.ages, AGE_OPTIONS)}
            />
            <SingleChipDropdown
              label="Audience"
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
              label="Min engagement"
              value={filters.minER}
              min={0}
              max={10}
              step={0.5}
              format={(v) => `${v}%`}
              onChange={(v) => setFilters((f) => ({ ...f, minER: v }))}
            />
            <RangeChip
              label="Max price"
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
          </div>
        )}

        {activeChips.length > 0 && (
          <div className="v2-ls-bar" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" className="v2-ls-chip" onClick={chip.clear} aria-label={`Remove ${chip.label}`}>
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="v2-hm-more" style={{ marginLeft: 0 }} onClick={() => { clearAll(); setOpenOnly(false); setSavedOnly(false); setQuery(''); }}>Clear all</button>
          </div>
        )}

        {campaign && sort === 'fit' && (
          <div className="v2-dc-for">
            <span className="v2-ls-tile" style={{ background: brandAccent(campaign.name).bg }} aria-hidden="true">{campaign.name[0]?.toUpperCase()}</span>
            <span className="v2-dc-for-txt">
              <b>Ranked for {campaign.name}</b>
              <small>{campaign.category ? `${campaign.category} · ` : ''}{campaign.placement}{` · ${dollars(perCreatorOf(campaign))} a creator`}</small>
            </span>
            {liveCampaigns.length > 1 && (
              <select className="v2-ls-chip" aria-label="Rank for campaign" value={campaign.id} onChange={(e) => { setForCampaign(e.target.value); resetPage(); }}>
                {liveCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}

        {results.length > 0 ? (
          <>
            <div className="v2-dc-grid">
              {results.slice(0, shown).map((c) => (
                <CreatorCard
                  key={c.id}
                  creator={c}
                  saved={savedIds.includes(c.id)}
                  fit={sort === 'fit' ? fitScores.get(c.id) ?? null : null}
                  onRoute={onRoute}
                />
              ))}
            </div>
            <div className="v2-ls-foot">
              <span>Showing <b>{Math.min(shown, results.length)}</b> of {results.length}{narrowed ? ` matching · ${allCreators.length} in all` : ''}</span>
              {results.length > shown && (
                <button type="button" className="v2-hm-btn" onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, results.length - shown)} more
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="v2-ls-empty">
            <b>No creators match.</b>
            <p>Widen a filter, or clear them all.</p>
            <button type="button" className="v2-hm-btn is-sm" onClick={() => { clearAll(); setOpenOnly(false); setSavedOnly(false); setQuery(''); }}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
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
        className="v2-ls-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-pressed={active}
      >
        <span>{active ? summary : label}</span>
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
        className="v2-ls-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-pressed={active}
      >
        <span>{active ? summary : label}</span>
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
    <label className="v2-ls-chip">
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
    <label className="v2-ls-chip">
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

// One creator, photo first: who they are, where, their two biggest
// channels, engagement and starting price. Save and Send brief act from the
// card; the photo and name open the storefront.
function CreatorCard({ creator, saved, fit, onRoute }: {
  creator: V2Creator;
  saved: boolean;
  /** The campaign fit when ranking for one; null hides it. */
  fit: number | null;
  onRoute: (r: string) => void;
}) {
  const [briefOpen, setBriefOpen] = useState(false);
  const channels = [...creator.channels].sort((a, b) => b.followers - a.followers).slice(0, 2);
  const er = bestEngagement(creator.channels);
  const photo = creator.avatar || creator.cover;
  const open = () => onRoute(`creator:${creator.id}`);
  const away = creator.availability?.vacationMode || creator.availability?.status === 'booked';

  return (
    <>
      <article className="v2-dc-card">
        <div className="v2-dc-photo">
          <button type="button" className="v2-dc-photo-btn" onClick={open} aria-label={`Open ${creator.name}’s storefront`}>
            {photo ? <img src={photo} alt="" loading="lazy" /> : <span aria-hidden="true">{creator.name[0]}</span>}
          </button>
          {/* Seeded demo creators: nobody real will answer a brief. */}
          {creator.isDemo && <em className="v2-dc-tag">Sample creator</em>}
          {away && !creator.isDemo && <em className="v2-dc-tag">{creator.availability?.vacationMode ? 'Away' : 'Booked'}</em>}
          <button
            type="button"
            className="v2-dc-save"
            aria-pressed={saved}
            aria-label={saved ? `Saved: ${creator.name}` : `Save ${creator.name}`}
            title={saved ? 'Saved' : 'Save for later'}
            onClick={() => v2ToggleSavedCreator(creator.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10v16l-5-4-5 4z" /></svg>
          </button>
        </div>
        <div className="v2-dc-name">
          <button type="button" onClick={open}>{creator.name}</button>
          <span className="v2-ls-price">from {dollars(creator.priceMin || creator.rate)}</span>
        </div>
        <div className="v2-dc-facts">
          {creator.city && <span className="v2-dc-city">{creator.city}</span>}
          {channels.map((ch, i) => (
            <span key={`${ch.platform}-${i}`}>{PLATFORM_META[ch.platform]?.name ?? ch.platform} <b>{fmtFollowers(ch.followers)}</b></span>
          ))}
          {er > 0 && <span>Engagement <b>{er.toFixed(1)}%</b></span>}
          {fit !== null && <span className="v2-dc-fit"><b>{fit}%</b> fit</span>}
        </div>
        <div className="v2-dc-acts">
          <button type="button" className="v2-hm-btn is-sm" onClick={() => setBriefOpen(true)}>Send brief</button>
          <button type="button" className="v2-hm-btn is-sm" onClick={open}>Storefront</button>
        </div>
      </article>
      {briefOpen && (
        <SendBriefModal creator={creator} onRoute={onRoute} onClose={() => setBriefOpen(false)} />
      )}
    </>
  );
}
