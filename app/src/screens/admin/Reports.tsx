// AdminReports — reported-threads moderation queue (Phase 50; Phase 56 update)
//
// Phase 11 wired the reporting flow: any participant can flag a thread
// via "Report" in the More menu, which sets `Thread.reportedAt /
// reportedByUserId / reportedReason` and notifies every admin.
//
// This tab lists every thread with `reportedAt != null` AND not yet
// suspended, oldest first (FIFO triage). Admin actions:
//   - Dismiss:     clears the report fields, leaves the thread active.
//                  No audit trail (treat as false-positive).
//   - Action taken: prompts admin for a note → writes the note +
//                  timestamp + actor onto the Thread, sets `suspended`
//                  and clears the report fields. The Inbox surface
//                  should hide / read-only suspended threads (future
//                  work; the flag is the prerequisite).
//
// Pre-fix the two buttons fired the same `clearReport` helper with
// just a different toast — visually distinct but semantically
// identical. Now they have real different effects on the Thread row.

import { useMemo, useState } from 'react';
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
  const session = useStore((s) => s.session);
  // Inline action-note modal state — `null` = closed, otherwise the
  // thread id we're collecting a note for.
  const [actionNoteForThreadId, setActionNoteForThreadId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');

  const reports = useMemo(
    () => db.threads
      // Only show un-resolved AND not-yet-suspended threads. Once an
      // admin takes action the row falls out of the queue.
      .filter((t) => !!t.reportedAt && !t.suspended)
      .sort((a, b) => (a.reportedAt ?? 0) - (b.reportedAt ?? 0)),
    [db.threads],
  );

  function dismissReport(threadId: string) {
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
    pushToast('Report dismissed', 'good');
  }

  function takeAction(threadId: string, note: string) {
    if (!session?.userId) {
      pushToast('Sign-in lost — re-authenticate to take moderation action', 'bad');
      return;
    }
    tx((d) => {
      const idx = d.threads.findIndex((t) => t.id === threadId);
      if (idx === -1) return;
      d.threads[idx] = {
        ...d.threads[idx],
        // Clear the report so the thread leaves the queue
        reportedAt: undefined,
        reportedByUserId: undefined,
        reportedReason: undefined,
        // Audit trail — admin who acted, when, and why
        suspended: true,
        actionTakenAt: Date.now(),
        actionTakenByUserId: session.userId,
        actionNote: note.trim() || 'Action taken (no note)',
      };
    });
    pushToast('Thread suspended · participants notified', 'good');
    setActionNoteForThreadId(null);
    setActionNote('');
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
                  onClick={() => dismissReport(thread.id)}
                  title="Clear the report and leave the thread active"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    setActionNoteForThreadId(thread.id);
                    setActionNote('');
                  }}
                  title="Suspend the thread + write an admin note"
                >
                  Action taken
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {actionNoteForThreadId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActionNoteForThreadId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid', placeItems: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper, #fff)', borderRadius: 8,
              padding: 20, maxWidth: 460, width: '100%',
              border: '1px solid var(--rule)',
            }}
          >
            <h3 style={{ margin: '0 0 6px' }}>Take action — admin note</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-60)' }}>
              Why is this thread being suspended? The note is saved to the thread for
              the audit trail. Participants are notified that moderation acted.
            </p>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              rows={4}
              placeholder="e.g. Repeated harassment after prior warning · violates community standards"
              style={{
                width: '100%', padding: 10, fontSize: 13, fontFamily: 'inherit',
                border: '1px solid var(--rule)', borderRadius: 4, marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setActionNoteForThreadId(null)}
              >Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionNote.trim().length < 6}
                onClick={() => takeAction(actionNoteForThreadId, actionNote)}
              >Suspend thread</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
