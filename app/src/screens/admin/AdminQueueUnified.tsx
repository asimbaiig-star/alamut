// Admin unified queue (Phase 28).
//
// Merges three previously separate triage screens into one tabbed
// surface:
//
//   /admin/queue                      → tab=creators (default)
//   /admin/queue?type=brands          → was /admin/verify
//   /admin/queue?type=disputes        → was /admin/disputes
//
// Old paths still work (router redirects). The sidebar collapses 3
// entries into 1 with a combined badge count.
//
// The dispute resolution surface (full deal page chrome + admin-only
// resolve modal) already exists at /deal/:dealId via the Phase 25
// admin-flavoured DealActionBanner. This file leaves the existing
// inline resolve flow in AdminDisputes intact for now — Phase 30
// polish can route admin from the disputes table to the deal page.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { select } from '@/lib/api/client';
import { PageHead } from '@/components/layout/PageHead';
import { AdminQueue } from './Queue';
import { AdminVerify } from './Verify';
import { AdminDisputes } from './Disputes';
import { AdminReports } from './Reports';
// P7 §4.3 — filter admin tabs by the signed-in admin's role(s).
// `super` sees everything (default). `verification` sees creators +
// brands tabs. `disputes` sees the disputes tab. Other roles fall back
// to `super` semantics until specialized.
import type { AdminRole } from '@/lib/api/types';

type Tab = 'creators' | 'brands' | 'disputes' | 'reports';

/** Which admin roles can view each queue tab. The matrix is permissive —
 *  super sees all, role-specific admins see their slice, and we never
 *  hide a tab from a user who genuinely needs it. */
const TAB_VISIBLE_TO: Record<Tab, AdminRole[]> = {
  creators: ['super', 'verification'],
  brands: ['super', 'verification'],
  disputes: ['super', 'disputes'],
  // Reports are trust-and-safety; route through the disputes role
  // until a dedicated `moderation` role exists.
  reports: ['super', 'disputes'],
};

function tabsVisibleForRoles(adminRoles: AdminRole[] | undefined): Tab[] {
  // Legacy admins (no adminRoles) default to super semantics — see all.
  const roles = adminRoles && adminRoles.length > 0 ? adminRoles : (['super'] as AdminRole[]);
  const allTabs: Tab[] = ['creators', 'brands', 'disputes', 'reports'];
  return allTabs.filter((t) =>
    TAB_VISIBLE_TO[t].some((required) => roles.includes(required)),
  );
}

const TAB_TITLES: Record<Tab, string> = {
  creators: 'Pending creator applications',
  brands: 'Brand verification',
  disputes: 'Dispute queue',
  reports: 'Reported threads',
};

const TAB_LEDES: Record<Tab, string> = {
  creators: 'New creator applications waiting on admin review. Approve to activate, reject with a reason to suspend.',
  brands: 'Verify brands so they appear with a checkmark in creators\' inboxes and unlock higher application volume.',
  disputes: 'Cases filed by either party when a campaign goes off-track. Escrow is frozen until resolved.',
  reports: 'Threads flagged by participants via the inbox More menu. Dismiss benign reports or mark as actioned.',
};

const TAB_NUMS: Record<Tab, string> = {
  creators: 'A · 01',
  brands: 'A · 02',
  disputes: 'A · 05',
  reports: 'A · 06',
};

export function AdminQueueUnified() {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const [params, setParams] = useSearchParams();

  // P7 §4.3 — figure out which tabs the current admin can see based on
  // their `adminRoles`. Sidebar sends users here regardless of role; if
  // their role doesn't include a tab the URL ?type= asks for, we'll
  // bounce to the first allowed one in the effect below.
  const me = session?.userId
    ? db.users.find((u) => u.id === session.userId)
    : null;
  const allowedTabs = useMemo(
    () => tabsVisibleForRoles(me?.adminRoles),
    [me?.adminRoles],
  );

  const initialTab = (params.get('type') as Tab | null);
  const validInitial = initialTab && allowedTabs.includes(initialTab)
    ? initialTab
    : (allowedTabs[0] ?? 'creators');
  const [tab, setTab] = useState<Tab>(validInitial);

  // Keep tab in sync with URL ?type= so deep links / back-forward work.
  // If the URL-requested tab isn't allowed for this admin's roles,
  // silently reroute to the first allowed tab.
  useEffect(() => {
    const t = params.get('type') as Tab | null;
    const wanted = t === 'creators' || t === 'brands' || t === 'disputes' || t === 'reports' ? t : 'creators';
    const next = allowedTabs.includes(wanted) ? wanted : (allowedTabs[0] ?? 'creators');
    if (next !== tab) setTab(next);
  }, [params, tab, allowedTabs]);

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    const p = new URLSearchParams(params);
    if (next === 'creators') p.delete('type');
    else p.set('type', next);
    setParams(p, { replace: true });
  };

  // Counts per tab — used in the tab labels and the page-level header.
  const counts = useMemo(() => ({
    creators: db.users.filter((u) => u.status === 'pending_admin_review' && u.creatorId).length,
    brands: db.brands.filter((b) => !b.verified).length,
    disputes: select.allDisputes(db).filter((d) => d.status === 'open').length,
    reports: db.threads.filter((t) => !!t.reportedAt).length,
  }), [db]);

  const totalPending = counts.creators + counts.brands + counts.disputes + counts.reports;

  return (
    <div className="page admin-unified-queue">
      <PageHead
        num={TAB_NUMS[tab]}
        label="Admin queue"
        title={
          totalPending === 0
            ? <>Queue is <em>clear</em>.</>
            : <>{totalPending} item{totalPending === 1 ? '' : 's'} <em>need review</em>.</>
        }
        lede={TAB_LEDES[tab]}
      />

      <div className="toolbar admin-unified-tabs">
        <div className="tabs">
          {/* P7 §4.3 — only render tabs allowed by the admin's roles.
              Verification admin sees creators+brands, disputes admin sees
              disputes, super sees all. */}
          {allowedTabs.includes('creators') && (
            <button
              className={['tab', tab === 'creators' ? 'is-on' : ''].join(' ')}
              onClick={() => setTabAndUrl('creators')}
            >
              Creators
              {counts.creators > 0 && <span className="tab-count tab-count-warn">{counts.creators}</span>}
            </button>
          )}
          {allowedTabs.includes('brands') && (
            <button
              className={['tab', tab === 'brands' ? 'is-on' : ''].join(' ')}
              onClick={() => setTabAndUrl('brands')}
            >
              Brands
              {counts.brands > 0 && <span className="tab-count tab-count-info">{counts.brands}</span>}
            </button>
          )}
          {allowedTabs.includes('disputes') && (
            <button
              className={['tab', tab === 'disputes' ? 'is-on' : ''].join(' ')}
              onClick={() => setTabAndUrl('disputes')}
            >
              Disputes
              {counts.disputes > 0 && <span className="tab-count tab-count-bad">{counts.disputes}</span>}
            </button>
          )}
          {allowedTabs.includes('reports') && (
            <button
              className={['tab', tab === 'reports' ? 'is-on' : ''].join(' ')}
              onClick={() => setTabAndUrl('reports')}
            >
              Reports
              {counts.reports > 0 && <span className="tab-count tab-count-bad">{counts.reports}</span>}
            </button>
          )}
        </div>
        <div className="admin-unified-helper mono-meta">
          {tab === 'creators' && <span>{TAB_TITLES.creators}</span>}
          {tab === 'brands' && <span>{TAB_TITLES.brands}</span>}
          {tab === 'disputes' && <span>{TAB_TITLES.disputes}</span>}
          {tab === 'reports' && <span>{TAB_TITLES.reports}</span>}
        </div>
      </div>

      <div className="admin-unified-body">
        {tab === 'creators' && <AdminQueue hideHead />}
        {tab === 'brands' && <AdminVerify hideHead />}
        {tab === 'disputes' && <AdminDisputes hideHead />}
        {tab === 'reports' && <AdminReports hideHead />}
      </div>
    </div>
  );
}
