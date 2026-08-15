// PublicStorefront · workspace public-storefront preview
//
// What lives at /c/:handle, rendered inside the workspace shell so a
// creator can verify their public page without leaving the editor.
// §5.1 unification — every data-bearing section is the same component
// the public surface (`PublicCreator`) renders, so the two cannot
// drift on layout, ordering, or filtering. Post-design-sync both
// surfaces use `data-surface="v2"`; the only chrome difference is the
// "Editing" topnav banner. Snapshot test pins the equivalence.

import { useStore } from '@/lib/api/store';
import { useV2CurrentCreator } from '../v2Hooks';
import { pushToast } from '@/lib/utils/toast';
import { useFeaturedReviews } from '@/components/storefront/useFeaturedReviews';
import {
  StorefrontHero, StorefrontVacationBanner, StorefrontWork,
  StorefrontAudience, StorefrontChannels, StorefrontPackages,
  StorefrontReviews, StorefrontPress,
} from '@/components/storefront/sections';
import { Icon } from '../lib';
import { fmtCount } from '@/lib/utils/format';

interface Props {
  handle?: string;
  onRoute: (r: string) => void;
}

export function PublicStorefront({ handle, onRoute }: Props) {
  const db = useStore((s) => s.db);
  const me = useV2CurrentCreator();
  const target = handle?.toLowerCase().replace(/^@/, '');
  // No `|| db.creators[0]` fallback. An unresolvable handle — a stale link
  // after someone renamed themselves, a typo, a deleted account — used to
  // render the FIRST creator in the store: a stranger's real name, photo,
  // rates and work, under whatever handle was asked for. The public route
  // (`PublicCreator`) already got this right; this preview did not.
  const creator = target
    ? db.creators.find((c) => c.handle.toLowerCase().replace('@', '') === target)
    : undefined;
  // Hook before any conditional return — safe on null per its contract.
  const { reviews, total } = useFeaturedReviews(creator ?? null, db);
  void reviews; // total is what we render on the KPI strip; reviews list is consumed inside StorefrontReviews

  if (!creator) {
    return (
      <div className="v2-content" style={{ paddingTop: 48, maxWidth: 520 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>No creator at @{target ?? ''}</h2>
        <p className="v2-muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
          This storefront doesn’t exist, or the handle changed. Handles can be
          edited, which breaks older links.
        </p>
        <button className="v2-btn v2-btn-outline" type="button" onClick={() => onRoute('storefront')}>
          Back to my storefront
        </button>
      </div>
    );
  }

  // Is the viewer looking at their OWN page?
  //
  // This surface is dual-purpose: a creator previewing their public page,
  // and a brand viewing a creator. It never distinguished them, so it
  // always offered the brand CTA — which opens `CreatorProfile`, the
  // brand-side drilldown, whose every action routes to a BRAND_ONLY route.
  // A creator hitting "preview my storefront" and then the biggest button
  // on the page was silently converted into a brand user.
  const isOwnPage = !!me && me.id === creator.id;

  const firstName = creator.name.split(' ')[0];
  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${creator.handle.replace('@', '')}`;

  // Hero CTAs — preview-mode routes the "Brief" CTA to the creator's
  // workspace profile where the Invite + Send-offer affordances live.
  // Pre-fix it just routed to the plain inbox (no creator context),
  // so a brand previewing a storefront landed nowhere actionable.
  const heroActions = (
    <>
      {isOwnPage ? (
        <button
          className="v2-btn v2-btn-primary"
          type="button"
          onClick={() => onRoute('storefront')}
        >
          Back to editor
        </button>
      ) : (
        <button
          className="v2-btn v2-btn-primary"
          type="button"
          onClick={() => onRoute(`creator:${creator.id}`)}
        >
          {Icon.send} Brief on Alamut
        </button>
      )}
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
          try {
            await navigator.clipboard.writeText(publicUrl);
            pushToast('Storefront link copied', 'good');
          } catch {
            pushToast(publicUrl, 'default');
          }
        }}
      >
        {Icon.external} Copy link
      </button>
      <button
        className="v2-btn v2-btn-outline"
        type="button"
        onClick={() => {
          // Same print-as-PDF affordance as the public surface so the
          // creator can preview their media kit before sharing.
          document.body.classList.add('is-printing-mediakit');
          document.body.dataset.printUrl = publicUrl;
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
    <div data-surface="v2" className="v2-storefront-bg" data-storefront-mode="preview">
      {/* Preview-mode banner — the only chrome difference between this
          surface and the public `/c/:handle` page. */}
      <header className="v2-storefront-topnav">
        <div className="v2-storefront-topnav-inner">
          <button
            className="v2-icon-btn"
            type="button"
            aria-label="Back to storefront editor"
            onClick={() => onRoute('storefront')}
          >
            <span aria-hidden="true">←</span>
          </button>
          <span className="v2-storefront-preview-tag" aria-live="polite">Editing</span>
          <span className="v2-muted" style={{ fontSize: 12.5, fontFamily: 'var(--v2-font-mono)' }}>
            alamut.co/c/{creator.handle.replace('@', '')}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="v2-btn v2-btn-outline v2-btn-sm"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                pushToast('Storefront link copied', 'good');
              } catch {
                pushToast(publicUrl, 'default');
              }
            }}
          >
            {Icon.external} Share link
          </button>
          <button
            className="v2-btn v2-btn-primary v2-btn-sm"
            type="button"
            onClick={() => onRoute('inbox')}
          >
            {Icon.send} Send brief
          </button>
        </div>
      </header>

      <div className="v2-storefront-page" style={{ paddingTop: 24 }}>
        {/* Section 1 — vacation banner */}
        <StorefrontVacationBanner creator={creator} mode="preview" />

        {/* Section 2 — hero */}
        <StorefrontHero creator={creator} db={db} mode="preview" actions={heroActions} />

        {/* KPI strip — wrapper chrome (matches the public surface). */}
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
        <StorefrontWork creator={creator} mode="preview" />
        <StorefrontAudience creator={creator} mode="preview" />
        <StorefrontChannels creator={creator} mode="preview" />
        <StorefrontPackages creator={creator} mode="preview" />
        <StorefrontReviews creator={creator} db={db} mode="preview" />
        <StorefrontPress creator={creator} mode="preview" />

        {/* Bottom CTA — preview routes inside the workspace. */}
        <div className="v2-storefront-cta">
          <h3>Ready to collaborate?</h3>
          <p>{firstName} replies within {creator.responseHrs}h on average. Tell {firstName} about your brand and goals.</p>
          <button
            className="v2-btn v2-btn-accent"
            type="button"
            onClick={() => onRoute('inbox')}
          >
            Send a brief to {firstName}
          </button>
        </div>

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
