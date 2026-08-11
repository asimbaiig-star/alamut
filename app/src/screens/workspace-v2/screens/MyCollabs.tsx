// MyCollabs.tsx — v2 creator-side collaboration tracker
//
// Two-section split:
//   1. Open offers   — pre-acceptance items (invited / pitched / negotiating).
//                      Cards route to CollabDetail so the creator can act on
//                      the offer (accept / counter / decline).
//   2. Collaborations — post-acceptance items (confirmed / submitted /
//                      approved / live / paid). Same kanban / list views as
//                      before. Cards route to CollabDetail for content
//                      submission and tracking.
//
// Splitting matches the DB model: a `collaborations` row only exists once
// an offer is accepted. Pre-acceptance items are projected V2Collabs
// derived from offers/applications — surfacing them under a separate
// header keeps the mental model clean.

import { useState } from 'react';
import { fmtUSD, Icon, StagePill, Topbar, EmptyState } from '../lib';
import { useV2AllCampaigns, useV2MyCollabs } from '../v2Hooks';
import { V2_PIPELINE_STAGES, V2_STAGE_META } from '../v2Adapters';
import type { V2Collab, V2CollabStage } from '../data';

interface Props {
  onRoute: (r: string) => void;
}

type View = 'kanban' | 'list';

// Derived from V2_STAGE_META rather than re-listed here. Pre-fix these were
// two hardcoded arrays covering 8 stages, and the state machine's 9th
// (`cancelled`) matched NEITHER — so a creator whose pitch was declined
// watched the collab vanish from this page with no record, unable to tell
// whether the brand passed or the app lost their application.
const stagesInGroup = (group: 'pre-acceptance' | 'post-acceptance' | 'closed'): V2CollabStage[] =>
  (Object.keys(V2_STAGE_META) as V2CollabStage[])
    .filter((s) => V2_STAGE_META[s].activeGroup === group)
    .sort((a, b) => V2_STAGE_META[a].order - V2_STAGE_META[b].order);

const PRE_ACCEPTANCE_STAGES = stagesInGroup('pre-acceptance');
const POST_ACCEPTANCE_STAGES = stagesInGroup('post-acceptance');
const CLOSED_STAGES = stagesInGroup('closed');

export function MyCollabs({ onRoute }: Props) {
  const [view, setView] = useState<View>('kanban');
  const allCollabs = useV2MyCollabs();
  const campaigns = useV2AllCampaigns();

  const negotiating = allCollabs.filter((c) => PRE_ACCEPTANCE_STAGES.includes(c.stage));
  const collabs = allCollabs.filter((c) => POST_ACCEPTANCE_STAGES.includes(c.stage));
  const closed = allCollabs.filter((c) => CLOSED_STAGES.includes(c.stage));

  const pendingReview = collabs.filter((c) =>
    c.deliverables.some((d) => d.status === 'in_review'),
  ).length;

  const crumbParts: string[] = [];
  if (negotiating.length > 0) crumbParts.push(`${negotiating.length} open offer${negotiating.length === 1 ? '' : 's'}`);
  crumbParts.push(`${collabs.length} active`);
  if (pendingReview > 0) crumbParts.push(`${pendingReview} pending review`);
  // Reported separately on purpose — a closed collab is neither an open offer
  // nor active work, and folding it into either would overstate both.
  if (closed.length > 0) crumbParts.push(`${closed.length} closed`);

  return (
    <>
      <Topbar
        title="My collaborations"
        crumb={crumbParts.join(' · ')}
        actions={
          <div
            className="v2-segmented"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              className={`v2-segmented-btn ${view === 'kanban' ? 'is-on' : ''}`}
              onClick={() => setView('kanban')}
              aria-pressed={view === 'kanban'}
              aria-label="Kanban view"
            >
              {Icon.kanban}
              <span>Kanban</span>
            </button>
            <button
              type="button"
              className={`v2-segmented-btn ${view === 'list' ? 'is-on' : ''}`}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
            >
              {Icon.list}
              <span>List</span>
            </button>
          </div>
        }
      />
      <div className="v2-content">
        {/* Phase 58 — empty state for fresh creators with no collabs
            in any direction (no open offers, no active deals). Pre-fix
            this surface rendered just an empty stage strip with zero
            counts. Now nudges them toward Browse campaigns. */}
        {allCollabs.length === 0 && (
          <EmptyState
            icon={<>{Icon.campaign}</>}
            title="No collaborations yet"
            body="Browse open briefs to apply, or wait for brands to find your storefront. Anything you accept will show up here as it progresses through production."
            ctaLabel="Browse campaigns"
            onCta={() => onRoute('creator-campaigns')}
            secondary={
              <button
                type="button"
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => onRoute('storefront')}
              >
                Polish my storefront
              </button>
            }
          />
        )}

        {/* ─── Open offers (pre-acceptance) ──────────────────────────── */}
        {negotiating.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader
              eyebrow="Open offers"
              count={negotiating.length}
              hint="Brand offers and your pitches still in negotiation. Nothing here is locked in until you accept."
            />
            {view === 'kanban' ? (
              <CollabKanban
                stages={PRE_ACCEPTANCE_STAGES}
                items={negotiating}
                campaigns={campaigns}
                onRoute={onRoute}
              />
            ) : (
              <CollabsList collabs={negotiating} campaigns={campaigns} onRoute={onRoute} />
            )}
          </section>
        )}

        {/* ─── Collaborations (post-acceptance) ──────────────────────── */}
        {collabs.length > 0 && negotiating.length > 0 && (
          <SectionHeader
            eyebrow="Collaborations"
            count={collabs.length}
            hint="Locked-in deals — escrow held, deliverables on the way."
          />
        )}

        {collabs.length > 0 && view === 'kanban' && (
          <CollabKanban
            stages={POST_ACCEPTANCE_STAGES}
            items={collabs}
            campaigns={campaigns}
            onRoute={onRoute}
          />
        )}

        {collabs.length > 0 && view === 'list' && (
          <CollabsList collabs={collabs} campaigns={campaigns} onRoute={onRoute} />
        )}

        {/* ─── Closed (terminal) ─────────────────────────────────────
            Shown rather than dropped. A declined pitch used to disappear
            from this page entirely, which reads as data loss: the creator
            can't tell whether the brand passed on them or the app lost the
            application. Inert by design — nothing here is actionable. */}
        {closed.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <SectionHeader
              eyebrow="Closed"
              count={closed.length}
              hint="Didn't go ahead — the brand passed, or the offer was withdrawn. Kept here so you have the record; your storefront is unaffected."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closed.map((c) => {
                const camp = campaigns.find((x) => x.id === c.campaignId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onRoute(`collab:${c.id}`)}
                    className="v2-row"
                    style={{
                      gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10,
                      border: '1px solid var(--v2-border)', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', width: '100%', opacity: 0.75,
                    }}
                  >
                    <span
                      className="v2-kanban-dot"
                      style={{ background: V2_STAGE_META[c.stage].color, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 550 }}>
                        {camp?.name ?? 'Campaign'}
                      </span>
                      <span className="v2-muted" style={{ fontSize: 11.5, display: 'block' }}>
                        {camp?.brand ?? ''}
                      </span>
                    </span>
                    <span className="v2-muted" style={{ fontSize: 11.5 }}>
                      {V2_STAGE_META[c.stage].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* P-9b — a second, bespoke empty state used to render here on the
            same `allCollabs.length === 0` condition as the shared
            <EmptyState> above, so a creator with no collabs saw both
            "No collaborations yet" and "No active collaborations yet"
            stacked. Removed; the shared component (two CTAs) wins. */}
      </div>
    </>
  );
}

function SectionHeader({ eyebrow, count, hint }: { eyebrow: string; count: number; hint: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="v2-row" style={{ alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h2 style={{
          fontFamily: 'var(--v2-font-display)',
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          {eyebrow}
        </h2>
        <span className="v2-muted" style={{ fontSize: 13 }}>{count}</span>
      </div>
      <p className="v2-muted" style={{ fontSize: 13, margin: 0, maxWidth: 600 }}>{hint}</p>
    </div>
  );
}

function CollabKanban({ stages, items, campaigns, onRoute }: {
  stages: V2CollabStage[];
  items: V2Collab[];
  campaigns: ReturnType<typeof useV2AllCampaigns>;
  onRoute: (r: string) => void;
}) {
  const stageMetas = stages
    .map((id) => V2_PIPELINE_STAGES.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  return (
    <div className="v2-kanban">
      {stageMetas.map((stage) => {
        const stageItems = items.filter((c) => c.stage === stage.id);
        return (
          <div key={stage.id} className="v2-kanban-col">
            <div className="v2-kanban-col-head">
              <span className="v2-kanban-dot" style={{ background: stage.color }} />
              <span className="v2-kanban-col-label">{stage.label}</span>
              <span className="v2-kanban-col-count">{stageItems.length}</span>
            </div>
            <div className="v2-kanban-list">
              {stageItems.map((collab) => {
                const camp = campaigns.find((c) => c.id === collab.campaignId);
                if (!camp) return null;
                return (
                  <article
                    key={collab.id}
                    className="v2-kanban-card"
                    onClick={() => onRoute(`collab:${collab.id}`)}
                    // F26 — see CampaignDetail: click-only cards were
                    // unreachable by keyboard and invisible to assistive tech.
                    role="button"
                    tabIndex={0}
                    aria-label={`Open collaboration with ${camp.brand} — ${camp.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRoute(`collab:${collab.id}`);
                      }
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                      {camp.brand}
                    </div>
                    <div className="v2-muted" style={{
                      fontSize: 11.5,
                      marginBottom: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {camp.name}
                    </div>
                    {collab.price > 0 && (
                      <div className="v2-row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                        <span className="v2-muted">Due {collab.deadline}</span>
                        <span className="v2-tabular" style={{ fontWeight: 550 }}>
                          {fmtUSD(collab.price)}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
              {stageItems.length === 0 && <div className="v2-kanban-empty">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollabsList({ collabs, campaigns, onRoute }: {
  collabs: V2Collab[];
  campaigns: ReturnType<typeof useV2AllCampaigns>;
  onRoute: (r: string) => void;
}) {
  return (
    <div className="v2-card" style={{ overflow: 'hidden' }}>
      <table className="v2-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>Campaign</th>
            <th>Stage</th>
            <th>Deliverables</th>
            <th>Due</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {collabs.map((collab) => {
            const camp = campaigns.find((c) => c.id === collab.campaignId);
            if (!camp) return null;
            const stageMeta = V2_PIPELINE_STAGES.find((s) => s.id === collab.stage);
            return (
              <tr
                key={collab.id}
                className="v2-table-clickable"
                onClick={() => onRoute(`collab:${collab.id}`)}
              >
                <td style={{ fontWeight: 550 }}>{camp.brand}</td>
                <td>{camp.name}</td>
                <td><StagePill stage={stageMeta?.label ?? collab.stage} /></td>
                <td style={{ fontSize: 13, color: 'var(--v2-ink-2)' }}>
                  {camp.placement || `${collab.deliverables.length} item${collab.deliverables.length === 1 ? '' : 's'}`}
                </td>
                <td className="v2-muted" style={{ fontSize: 12 }}>{collab.deadline}</td>
                <td className="v2-tabular" style={{ textAlign: 'right', fontWeight: 550 }}>
                  {collab.price > 0 ? fmtUSD(collab.price) : '—'}
                </td>
                <td>{Icon.arrow}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
