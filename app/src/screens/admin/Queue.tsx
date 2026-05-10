import { useMemo, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { api } from '@/lib/api/client';
import { PageHead } from '@/components/layout/PageHead';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative, fmtCount } from '@/lib/utils/format';
// P6 §5.6 — compute profile completion on read (was a stored field).
import { computeProfileCompletion } from '@/lib/utils/profile-completion';
import { pushToast } from '@/lib/utils/toast';
import { fireConfetti } from '@/lib/utils/confetti';
import { CreatorHoverCard } from '@/components/ui/CreatorHoverCard';
import { Lightbox } from '@/components/ui/Lightbox';
import { EmptyArt } from '@/components/ui/EmptyArt';
import { PresenceBanner } from '@/components/ui/PresenceBanner';
import { usePresence } from '@/lib/utils/usePresence';
import { useAuth } from '@/lib/auth/useAuth';
import { riskSignalsForCreator, type RiskSignal } from '@/lib/utils/risk-signals';
import { REF_DATE } from '@/lib/utils/campaign-metrics';

const DAY_MS = 24 * 60 * 60 * 1000;

interface AdminQueueProps {
  /** When true, omit the PageHead — the parent page (Phase 28
   *  AdminQueueUnified) renders one shared head. */
  hideHead?: boolean;
}

export function AdminQueue({ hideHead = false }: AdminQueueProps = {}) {
  const db = useStore((s) => s.db);
  const { user } = useAuth();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Phase 21: rejection requires a reason (compliance + creator clarity).
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Phase 21: portfolio lightbox state.
  const [lightboxIdx, setLightboxIdx] = useState(-1);
  // Phase 22: presence — warn if another admin/tab is reviewing this same applicant.
  const presenceKey = reviewId ? `applicant:${reviewId}` : null;
  const otherViewers = usePresence(presenceKey, user?.email || 'admin', 'reviewing');

  const pending = db.users.filter((u) => u.status === 'pending_admin_review' && u.creatorId);
  const reviewing = pending.find((u) => u.id === reviewId);
  const reviewingCreator = reviewing?.creatorId ? db.creators.find((c) => c.id === reviewing.creatorId) : undefined;

  // Phase 22 QA fix: memoize risk-signals per applicant. Without this the
  // 8-rule loop runs on every render for every row — for a busy queue
  // (50+ pending, 5 platforms each) the cost compounds quickly.
  const riskByUser = useMemo(() => {
    const out = new Map<string, RiskSignal[]>();
    pending.forEach((u) => {
      const c = u.creatorId ? db.creators.find((x) => x.id === u.creatorId) : undefined;
      if (c) out.set(u.id, riskSignalsForCreator(c, u, db, REF_DATE));
    });
    return out;
    // db.users / db.creators / db.applications all change together via tx() so
    // depending on `db` is the right granularity — runs once per store mutation.
  }, [db, pending]);
  const rejectingUser = rejectFor ? db.users.find((u) => u.id === rejectFor) : null;
  const rejectingCreator = rejectingUser?.creatorId ? db.creators.find((c) => c.id === rejectingUser.creatorId) : null;

  const approve = async (userId: string) => {
    setBusy(userId);
    try {
      await api.admin.decideCreatorApplication(userId, 'approve');
      fireConfetti();
      pushToast('Application approved', 'good');
      setReviewId(null);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Action failed', 'bad');
    } finally {
      setBusy(null);
    }
  };

  const submitRejection = async () => {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 10) {
      pushToast('Rejection reason must be at least 10 characters', 'bad');
      return;
    }
    setBusy(rejectFor);
    try {
      await api.admin.decideCreatorApplication(rejectFor, 'reject', rejectReason.trim());
      pushToast('Application rejected · creator notified with reason', 'good');
      setReviewId(null);
      setRejectFor(null);
      setRejectReason('');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Action failed', 'bad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={hideHead ? '' : 'page'}>
      {!hideHead && (
        <PageHead
          num="A · 01"
          label="Application queue"
          title={<>Pending <em>creators</em>.</>}
          lede="New creator applications awaiting review. Approve to move them to active status; reject to suspend with a reason."
        />
      )}

      {pending.length === 0 ? (
        <div className="empty">
          <EmptyArt kind="general" />
          <div className="empty-h">Queue is clear</div>
          <div>No creators waiting for review. New applications land here as they come in.</div>
        </div>
      ) : (
        <section className="admin-tbl-tile tile">
          <div className="admin-tbl-h">
            <div>
              <div className="mono-meta">Pending creators</div>
              <h2 className="home-tile-title">{pending.length} awaiting <em>review</em>.</h2>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Creator</th><th>Submitted</th><th>Risk</th><th>Categories</th><th style={{ textAlign: 'right' }}>Reach</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {pending.map((u) => {
                const c = db.creators.find((x) => x.id === u.creatorId);
                if (!c) return null;
                const daysOld = Math.max(0, Math.round((+REF_DATE - +new Date(u.createdAt)) / DAY_MS));
                const slaBreached = daysOld >= 2;
                // Phase 22: pull memoized signals (computed once per store mutation).
                const signals = riskByUser.get(u.id) || [];
                const high = signals.filter((s) => s.severity === 'high').length;
                const med = signals.filter((s) => s.severity === 'medium').length;
                return (
                  <tr key={u.id}>
                    <td>
                      <CreatorHoverCard creatorId={c.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'help' }}>
                          <img src={c.portrait} alt="" style={{ width: 36, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                          <div>
                            <div style={{ fontWeight: 500, borderBottom: '1px dashed var(--ink-40)' }}>{c.name}</div>
                            <div className="mono-meta">{c.handle} · {c.city}</div>
                          </div>
                        </div>
                      </CreatorHoverCard>
                    </td>
                    <td className="mono-meta">
                      {fmtRelative(u.createdAt)}
                      {slaBreached && <Pill tone="bad" className="ml-8">SLA · {daysOld}d</Pill>}
                    </td>
                    <td>
                      {signals.length === 0
                        ? <Pill tone="good">Clean</Pill>
                        : <RiskSummary signals={signals} />}
                    </td>
                    <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{c.categories.slice(0, 3).map((cat) => <Pill key={cat}>{cat}</Pill>)}</div></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtCount(c.reach)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="sm" onClick={() => setReviewId(u.id)}>Review</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => approve(u.id)}
                          loading={busy === u.id}
                          // Phase 22: block one-click approve when high-severity
                          // signals exist — force the operator into the Review
                          // modal where signals are surfaced fully.
                          disabled={high > 0}
                          title={high > 0 ? 'High-risk signals — review first' : undefined}
                          icon={<Icon.check s={12} />}
                        >Approve</Button>
                      </div>
                      {high > 0 && (
                        <div className="mono-meta" style={{ marginTop: 4, fontSize: 10, color: 'var(--bad)', textAlign: 'right' }}>
                          {high} high · review required
                        </div>
                      )}
                      {high === 0 && med > 0 && (
                        <div className="mono-meta" style={{ marginTop: 4, fontSize: 10, color: 'var(--warn)', textAlign: 'right' }}>
                          {med} caution
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        open={!!reviewId}
        onClose={() => setReviewId(null)}
        title={reviewingCreator ? `Review · ${reviewingCreator.name}` : ''}
        width={680}
        footer={<>
          <Button variant="ghost" onClick={() => setReviewId(null)}>Close</Button>
          {reviewing && <Button variant="danger" onClick={() => { setRejectFor(reviewing.id); setRejectReason(''); }}>Reject…</Button>}
          {reviewing && <Button onClick={() => approve(reviewing.id)} loading={busy === reviewing.id} icon={<Icon.check s={14} />}>Approve & activate</Button>}
        </>}
      >
        {reviewingCreator && reviewing && (
          <div>
            {/* Phase 22: presence — warn if another admin is reviewing the same applicant. */}
            <PresenceBanner viewers={otherViewers} />

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <img src={reviewingCreator.portrait} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 4 }} />
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{reviewingCreator.name}</div>
                <div className="mono-meta">{reviewingCreator.handle} · {reviewingCreator.city}, {reviewingCreator.country}</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>{reviewingCreator.tagline}</div>
                <div className="mono-meta" style={{ marginTop: 8 }}>{reviewing.email}</div>
              </div>
            </div>

            {/* Phase 22: full risk-signal panel — pulls from the same memoized
                map as the row chip, so we don't recompute on modal open. */}
            <RiskPanel signals={riskByUser.get(reviewing.id) || []} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
              <div><div className="mono-meta">Profile</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{computeProfileCompletion(reviewingCreator, db)}%</div></div>
              <div><div className="mono-meta">Reach</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{fmtCount(reviewingCreator.reach)}</div></div>
              <div><div className="mono-meta">Engagement</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{reviewingCreator.engagement}%</div></div>
              <div><div className="mono-meta">Tier</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{reviewingCreator.tier}</div></div>
            </div>

            <div className="mono-meta mt-16 mb-8">Categories</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{reviewingCreator.categories.map((c) => <Pill key={c}>{c}</Pill>)}</div>

            <div className="mono-meta mt-16 mb-8">Platforms</div>
            <table className="tbl">
              <thead><tr><th>Platform</th><th>Handle</th><th style={{ textAlign: 'right' }}>Followers</th><th>Status</th></tr></thead>
              <tbody>
                {reviewingCreator.platforms.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="mono-meta">{p.handle}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtCount(p.followers)}</td>
                    <td><Pill tone={p.verified ? 'good' : 'warn'}>{p.verified ? 'Verified' : 'Self-reported'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mono-meta mt-16 mb-8">Portfolio · click to expand</div>
            <div className="approval-files">
              {reviewingCreator.work.map((w, i) => (
                <button
                  key={i}
                  type="button"
                  className="approval-file"
                  style={{ backgroundImage: `url(${w})` }}
                  onClick={() => setLightboxIdx(i)}
                  aria-label={`Expand portfolio image ${i + 1}`}
                  title="Click to expand"
                >
                  <span className="approval-file-name">0{i + 1}</span>
                  <span className="approval-file-zoom" aria-hidden="true">
                    <Icon.search s={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Phase 21: portfolio lightbox */}
      {reviewingCreator && (
        <Lightbox
          files={reviewingCreator.work.map((url, i) => ({ url, name: `Portfolio · 0${i + 1}` }))}
          startIndex={lightboxIdx >= 0 ? lightboxIdx : 0}
          open={lightboxIdx >= 0}
          onClose={() => setLightboxIdx(-1)}
          caption={reviewingCreator.name}
        />
      )}

      {/* Phase 21: rejection reason modal */}
      <Modal
        open={!!rejectFor}
        onClose={() => { setRejectFor(null); setRejectReason(''); }}
        title={rejectingCreator ? `Reject · ${rejectingCreator.name}` : 'Reject application'}
        width={520}
        footer={<>
          <Button variant="ghost" onClick={() => { setRejectFor(null); setRejectReason(''); }}>Cancel</Button>
          <Button
            variant="danger"
            onClick={submitRejection}
            loading={!!rejectFor && busy === rejectFor}
            disabled={rejectReason.trim().length < 10}
          >
            Reject application
          </Button>
        </>}
      >
        <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-80)', lineHeight: 1.55 }}>
          The creator will see this reason in their notification. Be specific
          and respectful — they may reapply once they've addressed the issue.
        </p>
        <div className="field full">
          <label className="field-label">Reason (≥10 characters, visible to creator)</label>
          <textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Profile too sparse — add 3 more work samples and confirm at least one platform handle before reapplying."
          />
          <div className="mono-meta" style={{ marginTop: 6 }}>
            {rejectReason.trim().length} characters
            {rejectReason.trim().length >= 10 ? ' · ready' : ` · ${10 - rejectReason.trim().length} more needed`}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Phase 22 — Risk signal display helpers
// ============================================================

function RiskSummary({ signals }: { signals: RiskSignal[] }) {
  // Compact row chip — show 2 highest-severity, "+N" overflow on hover.
  const sorted = [...signals].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const visible = sorted.slice(0, 2);
  const extra = sorted.length - visible.length;
  return (
    <div className="risk-chips" title={signals.map((s) => `${s.label}: ${s.message}`).join('\n')}>
      {visible.map((s) => (
        <span key={s.kind} className={`risk-chip risk-chip-${s.severity}`}>
          {s.label}
        </span>
      ))}
      {extra > 0 && <span className="risk-chip risk-chip-extra">+{extra}</span>}
    </div>
  );
}

function RiskPanel({ signals }: { signals: RiskSignal[] }) {
  if (signals.length === 0) {
    return (
      <div className="risk-panel risk-panel-clean">
        <Icon.check s={14} />
        <span>No risk signals — clean application.</span>
      </div>
    );
  }
  return (
    <div className="risk-panel">
      <div className="risk-panel-h">
        <Icon.spark s={14} />
        <span>Risk signals · {signals.length}</span>
      </div>
      <ul className="risk-panel-list">
        {signals.map((s) => (
          <li key={s.kind} className={`risk-panel-row risk-panel-row-${s.severity}`}>
            <span className={`risk-chip risk-chip-${s.severity}`}>{s.label}</span>
            <span className="risk-panel-msg">{s.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function severityRank(s: RiskSignal['severity']): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
