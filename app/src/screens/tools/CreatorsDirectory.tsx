// CreatorsDirectory · Phase 52e
//
// Public Top Creators directory at /creators. Lists every verified
// creator from the seed with category / platform / region filters.
// Each card links to the public storefront (/c/:handle). SEO surface
// for organic traffic from "best food creators in [region]" queries.

import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PersonaPalette } from '@/screens/cover/scenes/PersonaPalette';
import { TopNav } from '@/screens/cover/scenes/TopNav';
import { Logo } from '@/components/ui/Logo';
import { useStore } from '@/lib/api/store';
import { fmtCount, fmtMoneyFull } from '@/lib/utils/format';
import type { Creator } from '@/lib/api/types';

import '@/styles/cinematic.css';

// Pull union options from the seeded creators rather than hard-coding.
function useFilterOptions(creators: Creator[]) {
  return useMemo(() => {
    const cats = new Set<string>();
    const platforms = new Set<string>();
    const regions = new Set<string>();
    for (const c of creators) {
      c.categories.forEach((x) => cats.add(x));
      c.platforms.forEach((p) => platforms.add(p.name));
      if (c.country) regions.add(c.country);
    }
    return {
      categories: Array.from(cats).sort(),
      platforms: Array.from(platforms).sort(),
      regions: Array.from(regions).sort(),
    };
  }, [creators]);
}

const PER_PAGE = 24;

export function CreatorsDirectory() {
  const db = useStore((s) => s.db);

  // SEO meta
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Top creators on Alamut · Browse vetted creators by category';
    return () => { document.title = prevTitle; };
  }, []);

  const allCreators = useMemo(
    () => db.creators.filter((c) => c.verified || c.tier !== 'Rising'),
    [db.creators],
  );
  const opts = useFilterOptions(allCreators);

  const [category, setCategory] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [page, setPage] = useState<number>(0);

  const filtered = useMemo(() => {
    return allCreators.filter((c) => {
      if (category && !c.categories.includes(category)) return false;
      if (platform && !c.platforms.some((p) => p.name === platform)) return false;
      if (region && c.country !== region) return false;
      return true;
    }).sort((a, b) => b.reach - a.reach); // Most-reach first
  }, [allCreators, category, platform, region]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageStart = page * PER_PAGE;
  const pageEnd = pageStart + PER_PAGE;
  const visible = filtered.slice(pageStart, pageEnd);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [category, platform, region]);

  return (
    <PersonaPalette>
      <div data-surface="landing-light" className="lp-light-root tools-page">
        <TopNav />

        <main className="tools-main">
          <header className="tools-head">
            <div className="cn-h-eyebrow">Directory · {allCreators.length} verified</div>
            <h1 className="cn-h-display tools-h">
              Top creators <span className="accent">on Alamut</span>.
            </h1>
            <p className="cn-lede">
              Every creator on the platform has been reviewed before they could apply to a brief. Filter by category, platform, or region — every profile links to a real storefront.
            </p>
          </header>

          <section className="dir-filters">
            <div className="dir-filter">
              <label htmlFor="dir-cat" className="mono-meta">Category</label>
              <select
                id="dir-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="dir-filter">
              <label htmlFor="dir-plat" className="mono-meta">Platform</label>
              <select
                id="dir-plat"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="">All platforms</option>
                {opts.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="dir-filter">
              <label htmlFor="dir-region" className="mono-meta">Region</label>
              <select
                id="dir-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">All regions</option>
                {opts.regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="dir-filter-meta mono-meta">
              {filtered.length} {filtered.length === 1 ? 'match' : 'matches'}
            </div>
          </section>

          <section className="dir-grid">
            {visible.length === 0 ? (
              <div className="dir-empty">
                <p>No creators match these filters yet.</p>
                <button
                  type="button"
                  className="cn-btn cn-btn-ghost"
                  onClick={() => { setCategory(''); setPlatform(''); setRegion(''); }}
                >
                  Clear filters
                </button>
              </div>
            ) : visible.map((c) => (
              <Link
                key={c.id}
                to={`/c/${c.handle.replace('@', '')}`}
                className="dir-card"
                aria-label={`${c.name} on Alamut`}
              >
                <img
                  className="dir-card-portrait"
                  src={c.portrait}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="dir-card-body">
                  <div className="dir-card-name">{c.name}</div>
                  <div className="dir-card-handle mono-meta">{c.handle}</div>
                  <div className="dir-card-tagline">{c.tagline}</div>
                  <div className="dir-card-meta">
                    <span className="mono-meta">{c.tier}</span>
                    <span className="dir-card-meta-sep" aria-hidden="true">·</span>
                    <span className="mono-meta">{c.city}, {c.country}</span>
                  </div>
                  <div className="dir-card-platforms">
                    {c.platforms.slice(0, 3).map((p) => (
                      <span key={p.name} className="dir-card-platform">
                        <span className="dir-card-platform-name">{p.name}</span>
                        <span className="dir-card-platform-followers mono-meta">
                          {fmtCount(p.followers)}
                        </span>
                      </span>
                    ))}
                  </div>
                  {c.lifetimeEarnings > 0 && (
                    <div className="dir-card-earnings mono-meta">
                      {fmtMoneyFull(c.lifetimeEarnings)} earned via Alamut
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </section>

          {pageCount > 1 && (
            <nav className="dir-pagination" aria-label="Pagination">
              <button
                type="button"
                className="cn-btn cn-btn-ghost"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Previous
              </button>
              <span className="mono-meta">
                Page {page + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="cn-btn cn-btn-ghost"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page === pageCount - 1}
              >
                Next →
              </button>
            </nav>
          )}

          <section className="tools-cross-sell">
            <h2 className="cn-h-section">Tools for creators</h2>
            <div className="tools-cross-sell-grid">
              <Link to="/tools/instagram-calculator" className="tools-cross-sell-card">
                <div className="cn-h-eyebrow">Calculator</div>
                <div className="tools-cross-sell-h">Instagram sponsorship rates</div>
                <span className="airy-meta">Open calculator <span aria-hidden="true">→</span></span>
              </Link>
              <Link to="/tools/tiktok-calculator" className="tools-cross-sell-card">
                <div className="cn-h-eyebrow">Calculator</div>
                <div className="tools-cross-sell-h">TikTok sponsorship rates</div>
                <span className="airy-meta">Open calculator <span aria-hidden="true">→</span></span>
              </Link>
              <Link to="/tools/youtube-calculator" className="tools-cross-sell-card">
                <div className="cn-h-eyebrow">Calculator</div>
                <div className="tools-cross-sell-h">YouTube sponsorship rates</div>
                <span className="airy-meta">Open calculator <span aria-hidden="true">→</span></span>
              </Link>
            </div>
          </section>
        </main>

        <footer className="cn-footer">
          <div className="cn-footer-bottom">
            <span><Logo size={14} tag="ALAMUT" /> · 2026</span>
            <span className="cn-footer-bottom-meta">Public directory · vetted creators only</span>
          </div>
        </footer>
      </div>
    </PersonaPalette>
  );
}
