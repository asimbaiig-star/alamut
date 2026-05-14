// AdminReports — reported-threads moderation queue (Phase 50)
//
// Phase 11 wired the reporting flow: any participant can flag a thread
// via "Report" in the More menu, which sets `Thread.reportedAt /
// reportedByUserId / reportedReason` and notifies every admin. Until
// now there was no admin-side surface to *resolve* those reports.
//
// This tab lists every thread with `reportedAt != null`, oldest first
// (FIFO triage). Admin actions:
//   - Dismiss: clear the report fields, leave the thread alone
//   - Action taken: same as dismiss, but the admin notes will surface
//                   in the audit log (TODO: audit log infra)
// Suspending the thread itself is intentionally not wired yet — we
// don't have a tombstone state on Thread. That's a separate schema
// change worth doing once a real moderation case appears.

import { useMemo } from 'react';
import { tx, useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import type { Database, User } from '@/lib/api/types';

interface Props { hideHead?: boolean }

/** Resolve a display name for a User — User itself doesn't carry a
 *  `name` field; it's on the linked Creator or Brand profile. */
function userDisplayName(u: User | null | undefined, db: Database): string {
  if (!u) return 'Unknown';
  if (u.creatorId) {
    return db.creators.find((c) => c.id === u.creatorId)?.name ?? u.email;
  }
  if (u.brandId) {
    return db.brands.find((b) => b.id === u.brandId)?.name ?? u.email;
  }
  return u.email;
}

export function AdminReports({ hideHead = false }: Props) {
  const db = useStore((s) => s.db);

  const reports = useMemo(
    () => db.threads
      .filter((t) => !!t.reportedAt)
      .sort((a, b) => (a.reportedAt ?? 0) - (b.reportedAt ?? 0)),
    [db.threads],
  );

  function clearReport(threadId: string, message: string) {
    tx((d) => {
      const idx = d.threads.findIndex((t) => t.id === threadId);
      if (idx === -1) return;
      d.threads[idx] = {
        ...d.threads[idx],
        reportedAt: undefined,
        reportedByUserId: undefined,
        reportedReason: undefined,
      };
    });
    pushToast(message, 'good');
  }

  if (reports.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        {!hideHead && <h2 style={{ marginBottom: 8 }}>Reports</h2>}
        <p style={{ color: 'var(--ink-60)', fontSize: 14, margin: 0 }}>
          No open reports. When a creator or brand flags a thread, it shows up here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: hideHead ? '8px 0' : '24px' }}>
      {!hideHead && <h2 style={{ margin: '0 0 14px' }}>Reports</h2>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reports.map((thread) => {
          const reporter = thread.reportedByUserId
            ? db.users.find((u) => u.id === thread.reportedByUserId)
            : null;
          const participants = thread.participants
            .map((uid) => db.users.find((u) => u.id === uid))
            .filter((u): u is NonNullable<typeof u> => !!u);
          const campaign = thread.campaignId
            ? db.campaigns.find((c) => c.id === thread.campaignId)
            : null;
          const reportedAt = thread.reportedAt
            ? new Date(thread.reportedAt).toLocaleString()
            : '';
          return (
            <article
              key={thread.id}
              style={{
                border: '1px solid var(--rule)',
                borderRadius: 6,
                padding: '14px 16px',
                background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono-meta">Thread · {thread.id}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>
                    {thread.subject || campaign?.title || '(no subject)'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 4 }}>
                    Between {participants.map((p) => userDisplayName(p, db)).join(' ↔ ')}
                    {campaign && <> · {campaign.title}</>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>
                  {reportedAt}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--paper-2)',
                  borderLeft: '3px solid var(--bad)',
                  padding: '10px 12px',
                  borderRadius: 4,
                  margin: '8px 0 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--ink-60)', marginBottom: 4 }}>
                  Reported by <strong>{userDisplayName(reporter, db)}</strong>
                </div>
                {thread.reportedReason || '(no reason given)'}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 12 }}
                  onClick={() => clearReport(thread.id, 'Report dismissed')}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                  onClick={() => clearReport(thread.id, 'Marked as actioned')}
                >
                  Action taken
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
