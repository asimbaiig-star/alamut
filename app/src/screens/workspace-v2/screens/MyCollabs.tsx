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
import { fmtUSD, Icon, StagePill, Topbar } from '../lib';
import { useV2AllCampaigns, useV2MyCollabs } from '../v2Hooks';
import { V2_PIPELINE_STAGES } from '../v2Adapters';
import type { V2Collab, V2CollabStage } from '../data';

interface Props {
  onRoute: (r: string) => void;
}

type View = 'kanban' | 'list';

const PRE_ACCEPTANCE_STAGES: V2CollabStage[] = ['invited', 'pitched', 'negotiating'];
const POST_ACCEPTANCE_STAGES: V2CollabStage[] = ['confirmed', 'submitted', 'approved', 'live', 'paid'];

export function MyCollabs({ onRoute }: Props) {
  const [view, setView] = useState<View>('kanban');
  const allCollabs = useV2MyCollabs();
  const campaigns = useV2AllCampaigns();

  const negotiating = allCollabs.filter((c) => PRE_ACCEPTANCE_STAGES.includes(c.stage));
  const collabs = allCollabs.filter((c) => POST_ACCEPTANCE_STAGES.includes(c.stage));

  const pendingReview = collabs.filter((c) =>
    c.deliverables.some((d) => d.status === 'in_review'),
  ).length;

  const crumbParts: string[] = [];
  if (negotiating.length > 0) crumbParts.push(`${negotiating.length} open offer${negotiating.length === 1 ? '' : 's'}`);
  crumbParts.push(`${collabs.length} active`);
  if (pendingReview > 0) crumbParts.push(`${pendingReview} pending review`);

  return (
    <>
      <Topbar
        title="My collaborations"
        crumb={crumbParts.join(' · ')}
        actions={
          <div className="v2-segmented">
            <button
              type="button"
              className={`v2-segmented-btn ${view === 'kanban' ? 'is-on' : ''}`}
              onClick={() => setView('kanban')}
            >Kanban</button>
            <button
              type="button"
              className={`v2-segmented-btn ${view === 'list' ? 'is-on' : ''}`}
              onClick={() => setView('list')}
            >List</button>
          </div>
        }
      />
      <div className="v2-content">
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

        {/* ─── Empty state (no collabs of either kind) ───────────────── */}
        {allCollabs.length === 0 && (
          <div className="v2-card v2-card-pad-lg" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: 'var(--v2-accent-soft)',
              color: 'var(--v2-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}>{Icon.campaign}</div>
            <h3 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22,
              fontWeight: 500,
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}>
              No active collaborations yet
            </h3>
            <p className="v2-muted" style={{ margin: '0 0 18px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Browse open briefs from brands and apply with a pitch. Once you're confirmed,
              the campaign will show up here so you can track deliverables and payment.
            </p>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => onRoute('creator-campaigns')}
            >
              {Icon.search} Browse open briefs
            </button>
          </div>
        )}
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
