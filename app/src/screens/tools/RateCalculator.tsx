// RateCalculator · Phase 52d
//
// One component, three URLs: /tools/tiktok-calculator,
// /tools/instagram-calculator, /tools/youtube-calculator. The platform
// is read from the URL pathname (no path param needed) so each route
// gets its own SEO-clean URL while sharing one component.
//
// Methodology — public, transparent. Each platform has its own
// follower-rate baseline and engagement multiplier:
//
//   tiktok    : $0.020 per follower base, +/- multiplier on engagement
//   instagram : $0.010 per follower base
//   youtube   : $0.030 per CPM (heavier weight on view count)
//
// The calculator shows a low / median / high range so the visitor
// sees a band rather than a single number. A "How we calculate" panel
// expands the methodology — no black box. Below the calculator: a
// soft CTA to sign up and get your *real* rate from cleared platform
// deals (which beats any benchmark estimate).

import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { PersonaPalette } from '@/screens/cover/scenes/PersonaPalette';
import { TopNav } from '@/screens/cover/scenes/TopNav';
import { Logo } from '@/components/ui/Logo';
import { fmtMoneyFull } from '@/lib/utils/format';
// P6 §5.4 — per-platform tuning (basePerThousand, engagement bounds,
// methodology blurbs) lives in a dedicated constants file so the
// calculator math + methodology panel stay in lockstep when tuning
// changes.
import { PLATFORMS, LOW_RATIO, HIGH_RATIO, platformFromPath, type PlatformConfig } from './calculatorConstants';

/** Count-up that re-animates whenever the target changes. Used to make
 *  the calculator's low / median / high values climb to the new number
 *  on every recompute, instead of snapping. */
function useCountUpReactive(target: number, duration = 600): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (reduced || target === value) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const from = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // value omitted from deps so the hook re-fires on target change
  // (otherwise we'd loop on every increment).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);
  return value;
}

import '@/styles/cinematic.css';

export function RateCalculator() {
  const { pathname } = useLocation();
  const platformId = platformFromPath(pathname);
  const config = PLATFORMS[platformId];

  // SEO meta — different per platform.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${config.name} sponsorship rate calculator · Alamut`;
    return () => { document.title = prevTitle; };
  }, [config.name]);

  const [audience, setAudience] = useState<string>('');
  const [engagement, setEngagement] = useState<string>(String(config.avgEngagementPct));

  const result = useMemo(() => {
    const audienceNum = parseFloat(audience);
    const engagementNum = parseFloat(engagement);
    if (!audienceNum || audienceNum <= 0 || !engagementNum) return null;

    // Engagement multiplier — clamp to platform-specific bounds.
    const engRatio = engagementNum / config.avgEngagementPct;
    const engClamped = Math.max(
      config.minEngMultiplier,
      Math.min(config.maxEngMultiplier, engRatio),
    );

    // Median rate. Spread comes from `LOW_RATIO` / `HIGH_RATIO`
    // exported from `calculatorConstants.ts` — tweak the constants
    // there to shift the entire band.
    const median = (audienceNum / 1000) * config.basePerThousand * engClamped;
    const low = median * LOW_RATIO;
    const high = median * HIGH_RATIO;

    return { low, median, high };
  }, [audience, engagement, config]);

  // Tier 1.6 — count-up on the result values so they climb to the new
  // number on every recompute instead of snapping. Targets reset to 0
  // whenever the result is null (input cleared).
  const lowAnim = useCountUpReactive(Math.round(result?.low ?? 0));
  const medianAnim = useCountUpReactive(Math.round(result?.median ?? 0));
  const highAnim = useCountUpReactive(Math.round(result?.high ?? 0));

  const switchTo = (id: PlatformConfig['id']) => `/tools/${id}-calculator`;

  return (
    <PersonaPalette>
      <div data-surface="landing-light" className="lp-light-root tools-page">
        <TopNav />

        <main className="tools-main">
          <header className="tools-head">
            <div className="cn-h-eyebrow">Free tool · {config.name}</div>
            <h1 className="cn-h-display tools-h">
              {config.name} sponsorship rate <span className="accent">calculator</span>.
            </h1>
            <p className="cn-lede">
              A fair-rate band based on follower count and engagement. The platform's average is pre-filled — adjust to match your account.
            </p>
            <nav className="tools-platform-tabs" aria-label="Switch platform">
              {Object.values(PLATFORMS).map((p) => {
                const isOn = p.id === platformId;
                return (
                  <Link
                    key={p.id}
                    to={switchTo(p.id)}
                    className={['tools-platform-tab', isOn ? 'is-on' : ''].filter(Boolean).join(' ')}
                    // QA fix: screen readers need aria-current to know
                    // which tab represents the current page. Without it,
                    // the tab list reads as three indistinguishable links.
                    aria-current={isOn ? 'page' : undefined}
                  >
                    {p.name}
                  </Link>
                );
              })}
            </nav>
          </header>

          <section className="tools-calc-card">
            <div className="tools-calc-form">
              <div className="field">
                <label className="field-label" htmlFor="rc-audience">{config.inputLabel}</label>
                <input
                  id="rc-audience"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder={config.inputPlaceholder}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="rc-eng">Engagement rate (%)</label>
                <input
                  id="rc-eng"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={50}
                  step={0.1}
                  value={engagement}
                  onChange={(e) => setEngagement(e.target.value)}
                  placeholder={String(config.avgEngagementPct)}
                />
                <span className="field-help">{config.engagementHint}</span>
              </div>
            </div>

            <div className="tools-calc-result">
              {result ? (
                <>
                  <div className="tools-calc-result-band">
                    <div className="tools-calc-result-low">
                      <div className="mono-meta">Low</div>
                      <div className="tools-calc-result-v">{fmtMoneyFull(lowAnim)}</div>
                    </div>
                    <div className="tools-calc-result-median">
                      <div className="mono-meta tools-calc-result-median-label">Median</div>
                      <div className="tools-calc-result-v tools-calc-result-v-big">
                        {fmtMoneyFull(medianAnim)}
                      </div>
                    </div>
                    <div className="tools-calc-result-high">
                      <div className="mono-meta">High</div>
                      <div className="tools-calc-result-v">{fmtMoneyFull(highAnim)}</div>
                    </div>
                  </div>
                  <div className="mono-meta tools-calc-result-unit">
                    Per {config.unitLabel}
                  </div>
                </>
              ) : (
                <div className="tools-calc-result-empty">
                  Enter your numbers to see a fair-rate band.
                </div>
              )}
            </div>
          </section>

          <details className="tools-methodology">
            <summary className="tools-methodology-q">
              <span>How we calculate this</span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 9l6 6l6 -6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="tools-methodology-a">
              <p>{config.methodology}</p>
              <p>
                The band you see assumes a one-off {config.unitLabel}, no exclusivity, no whitelisting. Long-term retainers, exclusivity windows, and whitelisting rights add 30–80% to the high estimate.
              </p>
              <p className="tools-methodology-cta">
                <strong>This is a benchmark, not a quote.</strong> Your actual cleared rate on Alamut depends on the brand, the brief, the deliverable, and the market. Sign up to see what brands are actually paying creators in your tier — pulled from real cleared deals.
              </p>
              <Link to="/signup?role=creator" className="cn-btn cn-btn-solid">
                Get your real rate on Alamut <span aria-hidden="true">→</span>
              </Link>
            </div>
          </details>

          <section className="tools-cross-sell">
            <h2 className="cn-h-section">Other calculators</h2>
            <div className="tools-cross-sell-grid">
              {Object.values(PLATFORMS).filter((p) => p.id !== platformId).map((p) => (
                <Link key={p.id} to={switchTo(p.id)} className="tools-cross-sell-card">
                  <div className="cn-h-eyebrow">{p.name}</div>
                  <div className="tools-cross-sell-h">{p.name} sponsorship rates</div>
                  <span className="airy-meta">Open calculator <span aria-hidden="true">→</span></span>
                </Link>
              ))}
              <Link to="/creators" className="tools-cross-sell-card">
                <div className="cn-h-eyebrow">Directory</div>
                <div className="tools-cross-sell-h">Top Creators on Alamut</div>
                <span className="airy-meta">Browse by category <span aria-hidden="true">→</span></span>
              </Link>
            </div>
          </section>
        </main>

        <footer className="cn-footer">
          <div className="cn-footer-bottom">
            <span><Logo size={14} tag="ALAMUT" /> · 2026</span>
            <span className="cn-footer-bottom-meta">Free tool · benchmarks only</span>
          </div>
        </footer>
      </div>
    </PersonaPalette>
  );
}
