// TeamAccess.tsx — brand team roster, invites, and invite links
//
// Lifted verbatim out of CampaignDetail, where it was defined inline and
// therefore reachable ONLY from a campaign's Settings tab: a brand with
// no campaigns yet had no way to add a teammate, and a brand with five
// campaigns saw the same brand-wide roster in five places, each looking
// like it belonged to that campaign. It is brand-scoped, not
// campaign-scoped — so it now lives on BrandProfile as well, and both
// callers render the same component instead of two copies drifting.

import { useState } from 'react';
import { Icon } from '../lib';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';

export function TeamAccessAside({ brandId }: { brandId: string }) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  const me = session ? db.users.find((u) => u.id === session.userId) : null;
  const isOwner = !!me && me.brandId === brandId && (!me.teamRole || me.teamRole === 'admin');

  // Current team — every user with this brandId, sorted: owner first.
  const team = db.users
    .filter((u) => u.brandId === brandId)
    .sort((a, b) => (a.teamRole ? 1 : 0) - (b.teamRole ? 1 : 0));
  const pendingInvites = (db.teamInvites ?? []).filter(
    (i) => i.brandId === brandId && !i.acceptedAt && !i.revokedAt,
  );

  return (
    <aside className="v2-card v2-card-pad" style={{ flex: '1 1 280px' }}>
      <div className="v2-eyebrow" style={{ marginBottom: 10 }}>Team access</div>
      {team.map((u) => (
        <div
          key={u.id}
          className="v2-row"
          style={{ padding: '8px 0', borderBottom: '1px solid var(--v2-line)', gap: 10 }}
        >
          <div className="v2-avatar v2-avatar-sm" style={{ background: 'var(--v2-accent-soft)' }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.id === me?.id ? 'You' : u.email}
            </div>
            <div className="v2-muted" style={{ fontSize: 11 }}>
              {u.teamRole ?? 'Owner'}
            </div>
          </div>
        </div>
      ))}
      {pendingInvites.length > 0 && (
        <>
          <div className="v2-eyebrow" style={{ marginTop: 14, marginBottom: 8 }}>Pending invites</div>
          {pendingInvites.map((inv) => (
            <PendingInviteRow key={inv.id} invite={inv} isOwner={isOwner} />
          ))}
        </>
      )}
      {isOwner && (
        <button
          className="v2-btn v2-btn-sm v2-btn-outline"
          type="button"
          style={{ width: '100%', marginTop: 14 }}
          onClick={() => setShowInviteModal(true)}
        >
          {Icon.plus} Invite teammate
        </button>
      )}
      {showInviteModal && (
        <InviteTeammateModal
          brandId={brandId}
          onClose={() => setShowInviteModal(false)}
          onSent={(url) => { setLatestInviteUrl(url); setShowInviteModal(false); }}
        />
      )}
      {latestInviteUrl && (
        <InviteLinkModal
          url={latestInviteUrl}
          onClose={() => setLatestInviteUrl(null)}
        />
      )}
    </aside>
  );
}

function PendingInviteRow({ invite, isOwner }: {
  invite: import('@/lib/api/types').TeamInvite;
  isOwner: boolean;
}) {
  return (
    <div
      className="v2-row"
      style={{ padding: '8px 0', borderBottom: '1px solid var(--v2-line)', gap: 10 }}
    >
      <div className="v2-avatar v2-avatar-sm" style={{ background: 'var(--v2-bg-1)' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {invite.invitedEmail}
        </div>
        <div className="v2-muted" style={{ fontSize: 11 }}>
          {invite.role} · pending
        </div>
      </div>
      {isOwner && (
        <>
          <button
            type="button"
            className="v2-icon-btn"
            title="Copy invite link"
            onClick={() => {
              const url = `${window.location.origin}/accept-invite?token=${invite.token}`;
              void navigator.clipboard.writeText(url).then(
                () => pushToast('Invite link copied'),
                () => pushToast('Copy failed — select the URL manually'),
              );
            }}
          >📋</button>
          <button
            type="button"
            className="v2-icon-btn"
            title="Revoke invite"
            onClick={async () => {
              if (!confirm(`Revoke invite to ${invite.invitedEmail}?`)) return;
              const { v2RevokeTeamInvite } = await import('../v2Hooks');
              v2RevokeTeamInvite(invite.id);
              pushToast('Invite revoked');
            }}
          >×</button>
        </>
      )}
    </div>
  );
}

function InviteTeammateModal({ brandId, onClose, onSent }: {
  brandId: string;
  onClose: () => void;
  onSent: (acceptUrl: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<import('@/lib/api/types').TeamRole>('ops');
  const valid = email.trim().length > 4 && email.includes('@');

  async function submit() {
    const { v2SendTeamInvite } = await import('../v2Hooks');
    const invite = v2SendTeamInvite({ brandId, email, role });
    if (!invite) {
      pushToast('Could not send invite');
      return;
    }
    const url = `${window.location.origin}/accept-invite?token=${invite.token}`;
    onSent(url);
  }

  return (
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="v2-card v2-card-pad-lg v2-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Invite teammate</h2>
        <p className="v2-muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
          They'll get an invite link they can open to join your brand workspace.
        </p>
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Email</label>
        <input
          className="v2-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@brand.com"
          style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
        />
        <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Role</label>
        <select
          className="v2-input"
          value={role}
          onChange={(e) => setRole(e.target.value as import('@/lib/api/types').TeamRole)}
          style={{ width: '100%', marginBottom: 16, fontFamily: 'inherit' }}
        >
          <option value="admin">Admin — full access</option>
          <option value="ops">Ops — campaign mgmt, no payouts</option>
          <option value="finance">Finance — payments + wallet</option>
          <option value="viewer">Viewer — read only</option>
        </select>
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="v2-btn v2-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="v2-btn v2-btn-primary"
            type="button"
            disabled={!valid}
            onClick={() => { void submit(); }}
          >
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteLinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="v2-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="v2-card v2-card-pad-lg v2-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2 style={{
          fontFamily: 'var(--v2-font-display)', fontSize: 22, fontWeight: 500,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>Invite sent · share the link</h2>
        <p className="v2-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Send this link to your teammate. They'll be prompted to sign in (or sign up)
          with the invited email, then attached to your team.
        </p>
        <div style={{
          padding: '10px 12px',
          background: 'var(--v2-bg-1)',
          border: '1px solid var(--v2-line)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          wordBreak: 'break-all',
          marginBottom: 14,
        }}>{url}</div>
        <div className="v2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="v2-btn v2-btn-outline"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(
                () => pushToast('Invite link copied'),
                () => pushToast('Copy failed — select the URL manually'),
              );
            }}
          >Copy link</button>
          <button className="v2-btn v2-btn-primary" type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
