// PublicCreator · /c/:handle — public, unauthenticated storefront.
//
// §5.1 single-render + design-system sync — every data-bearing section
// renders from a shared component in `@/components/storefront/sections`,
// and the entire surface uses `data-surface="v2"` (the workspace's
// "refined cream" register). The pre-sync version used the airy
// system, which gave the public storefront a different visual identity
// from every other authenticated surface in the product. Now the only
// chrome difference between this surface and the workspace preview
// (`public:<handle>`) is the topnav banner; the data-bearing sections
// are byte-equivalent. Snapshot test pins the equivalence.

import { Link, useNavigate, useParams } from 'react-router-dom';
import '@/styles/workspace-v2.css';
import { useStore } from '@/lib/api/store';
import { useFeaturedReviews } from '@/components/storefront/useFeaturedReviews';
import {
  StorefrontHero, StorefrontVacationBanner, StorefrontWork,
  StorefrontAudience, StorefrontChannels, StorefrontPackages,
  StorefrontReviews, StorefrontPress,
} from '@/components/storefront/sections';
import { fmtCount } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { Icon } from '@/screens/workspace-v2/lib';
import { useEffect } from 'react';

export function PublicCreator() {
  const { handle } = useParams<{ handle: string }>();
  const db = useStore((s) => s.db);
  const nav = useNavigate();

  const target = handle?.toLowerCase().replace(/^@/, '');
  const creator = db.creators.find((c) => c.handle.toLowerCase().replace('@', '') === target);
  // Hook before any conditional return — stable across handle changes.
  // Only `total` is consumed at the wrapper for the KPI strip; the
  // ordered `reviews` list is consumed inside StorefrontReviews itself.
  const { total } = useFeaturedReviews(creator ?? null, db);

  // SEO + social meta. Snapshot original tag content on mount so we can
  // restore on cleanup — otherwise navigating storefront → home leaves
  // the previous creator's tags stamped into <head>.
  useEffect(() => {
    if (!creator) {
      document.title = `Not found · Alamut`;
      return;
    }
    const prevTitle = document.title;
    const tagline = creator.tagline || `Creator on Alamut`;
    document.title = `${creator.name} · ${tagline} · Alamut`;

    type Restore = { el: HTMLMetaElement; prev: string | null; created: boolean };
    const toRestore: Restore[] = [];

    const setMeta = (key: 'name' | 'property', value: string, content: string) => {
      const selector = `meta[${key}="${value}"]`;
      let el = document.querySelector<HTMLMetaElement>(selector);
      let created = false;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(key, value);
        document.head.appendChild(el);
        created = true;
      }
      toRestore.push({ el, prev: el.getAttribute('content'), created });
      el.setAttribute('content', content);
    };

    const desc = `${creator.tagline} · ${fmtCount(creator.reach)} reach · ${creator.tier}`;
    setMeta('name',     'description',          desc);
    setMeta('property', 'og:title',             `${creator.name} on Alamut`);
    setMeta('property', 'og:description',       desc);
    setMeta('property', 'og:image',             creator.portrait);
    setMeta('property', 'og:type',              'profile');
    setMeta('property', 'og:url',               window.location.href);
    setMeta('name',     'twitter:card',         'summary_large_image');
    setMeta('name',     'twitter:title',        `${creator.name} on Alamut`);
    setMeta('name',     'twitter:description',  desc);
    setMeta('name',     'twitter:image',        creator.portrait);

    return () => {
      document.title = prevTitle;
      toRestore.forEach(({ el, prev, created }) => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute('content', prev);
        else el.removeAttribute('content');
      });
    };
  }, [creator]);

  // 404 — same v2 register, simpler shell.
  if (!creator) {
    return (
      <div data-surface="v2" className="v2-storefront-bg">
        <div className="v2-storefront-page" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="v2-block">
            <div className="v2-block-eyebrow">404 · Storefront</div>
            <h1 className="v2-storefront-display">No creator at @{target}.</h1>
            <p className="v2-muted" style={{ fontSize: 15, lineHeight: 1.55, margin: '12px 0 18px' }}>
              The handle is misspelled, or this creator hasn't activated their public storefront yet.
            </p>
            <button className="v2-btn v2-btn-outline" type="button" onClick={() => nav('/')}>
              ← Back to Alamut
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstName = creator.name.split(' ')[0];

  // Hero CTA row — wrapper-level handlers (router, clipboard, print).
  // The section is a pure render of the creator record; CTAs ride in
  // via the `actions` slot.
  const heroActions = (
    <>
      <button
        className="v2-btn v2-btn-primary"
        type="button"
        onClick={() => nav('/signup?role=brand')}
      >
        {Icon.send} Brief on Alamut
      </button>
      <button
        className="v2-btn v2-btn-outline"
        type="button"
        onClick={() => {
          document.getElementById('work')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        See work ↓
      </button>
      <button
        className="v2-btn v2-btn-outline"
        type="button"
        onClick={async () => {
          const url = window.location.href;
          try {
            await navigator.clipboard.writeText(url);
            pushToast('Link copied', 'good');
          } catch {
            pushToast(url, 'default');
          }
        }}
      >
        {Icon.external} Copy link
      </button>
      <button
        className="v2-btn v2-btn-outline"
        type="button"
        onClick={() => {
          // Print-as-PDF — print-CSS reformats as a clean media kit.
          document.body.classList.add('is-printing-mediakit');
          document.body.dataset.printUrl = window.location.href;
          const cleanup = () => {
            document.body.classList.remove('is-printing-mediakit');
            delete document.body.dataset.printUrl;
            window.removeEventListener('afterprint', cleanup);
          };
          window.addEventListener('afterprint', cleanup);
          setTimeout(cleanup, 60_000);
          requestAnimationFrame(() => window.print());
        }}
        title="Opens the print dialog — pick 'Save as PDF' as destination"
      >
        Media kit (PDF)
      </button>
    </>
  );

  return (
    <div data-surface="v2" className="v2-storefront-bg">
      {/* Sticky topnav — minimal, sits above the cover. */}
      <header className="v2-storefront-topnav">
        <div className="v2-storefront-topnav-inner">
          <Link to="/" aria-label="Alamut home" style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--v2-ink)',
            textDecoration: 'none',
            letterSpacing: '-0.014em',
          }}>
            Alamut
          </Link>
          <nav className="v2-row" style={{ gap: 14, marginLeft: 18, fontSize: 13 }} aria-label="Sections">
            <a href="#work" style={{ color: 'var(--v2-ink-2)', textDecoration: 'none' }}>Work</a>
            <a href="#audience" style={{ color: 'var(--v2-ink-2)', textDecoration: 'none' }}>Audience</a>
            <a href="#rates" style={{ color: 'var(--v2-ink-2)', textDecoration: 'none' }}>Rates</a>
            <a href="#reviews" style={{ color: 'var(--v2-ink-2)', textDecoration: 'none' }}>Reviews</a>
          </nav>
          <span style={{ flex: 1 }} />
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => nav('/signup?role=brand')}
          >
            Brief {firstName} on Alamut {Icon.arrow}
          </button>
        </div>
      </header>

      <div className="v2-storefront-page" style={{ paddingTop: 24 }}>
        {/* Section 1 — vacation banner */}
        <StorefrontVacationBanner creator={creator} mode="public" />

        {/* Section 2 — hero (cover + portrait + identity block) */}
        <StorefrontHero creator={creator} db={db} mode="public" actions={heroActions} />

        {/* KPI strip — wrapper chrome (not one of the 8 sections). */}
        <div className="v2-block">
          <div className="v2-storefront-kpi-strip">
            <div className="v2-storefront-kpi">
              <div className="v2-storefront-kpi-k">Total reach</div>
              <div className="v2-storefront-kpi-v">{fmtCount(creator.reach)}</div>
            </div>
            <div className="v2-storefront-kpi">
              <div className="v2-storefront-kpi-k">Engagement</div>
              <div className="v2-storefront-kpi-v">{creator.engagement}<span style={{ fontSize: 14 }}>%</span></div>
            </div>
            <div className="v2-storefront-kpi">
              <div className="v2-storefront-kpi-k">Reply</div>
              <div className="v2-storefront-kpi-v">{creator.responseHrs}<span style={{ fontSize: 14 }}>h</span></div>
            </div>
            <div className="v2-storefront-kpi">
              <div className="v2-storefront-kpi-k">Avg rating</div>
              <div className="v2-storefront-kpi-v">{creator.rating || '—'}</div>
              <div className="v2-storefront-kpi-d">{total} review{total === 1 ? '' : 's'}</div>
            </div>
          </div>
        </div>

        {/* Sections 3–8 */}
        <StorefrontWork creator={creator} mode="public" />
        <StorefrontAudience creator={creator} mode="public" />
        <StorefrontChannels creator={creator} mode="public" />
        <StorefrontPackages creator={creator} mode="public" />
        <StorefrontReviews creator={creator} db={db} mode="public" />
        <StorefrontPress creator={creator} mode="public" />

        {/* Bottom CTA — wrapper chrome (the design's dark gradient card). */}
        <div className="v2-storefront-cta">
          <h3>Ready to collaborate?</h3>
          <p>{firstName} replies within {creator.responseHrs}h on average. Tell {firstName} about your brand and goals.</p>
          <button
            className="v2-btn v2-btn-accent"
            type="button"
            onClick={() => nav('/signup?role=brand')}
          >
            Send a brief
          </button>
        </div>

        {/* Footer */}
        <div
          className="v2-row"
          style={{
            justifyContent: 'center',
            paddingTop: 28,
            paddingBottom: 12,
            fontSize: 11.5,
            color: 'var(--v2-ink-3)',
            gap: 14,
          }}
        >
          <span>Powered by Alamut</span>
          <span aria-hidden="true">·</span>
          <span>{creator.handle} · alamut.co/c/{creator.handle.replace('@', '')}</span>
        </div>
      </div>
    </div>
  );
}
