import { useState } from 'react';
import { api } from '@/lib/api/client';
import type { TeamRole } from '@/lib/api/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';
// P5 §4.1 — gate the invite action by capability. The button stays
// visible (disabled) for ops/finance/viewer so they see the action
// exists; only `team.manage` (admin) can actually fire it.
import { useCapability } from '@/lib/permissions';

interface InviteTeamModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteTeamModal({ open, onClose }: InviteTeamModalProps) {
  const [email, setEmail] = useState('');
  // P5 §4.1 — `viewer` role exists but isn't user-facing in the team
  // invite UI yet; the chooser still cycles through admin/ops/finance.
  const [teamRole, setTeamRole] = useState<TeamRole>('ops');
  const [busy, setBusy] = useState(false);
  const canManageTeam = useCapability('team.manage');

  const submit = async () => {
    setBusy(true);
    try {
      await api.brand.inviteTeamMember({ email: email.trim().toLowerCase(), teamRole });
      pushToast(`Invited ${email}`, 'good');
      setEmail('');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Invite failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a team member"
      width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={!email.includes('@') || !canManageTeam}
          icon={<Icon.arrow s={14} />}
        >
          {canManageTeam ? 'Send invite' : 'Admins only'}
        </Button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@brand.com" autoFocus />
          <span className="field-help">In demo mode, password is set to "demo1234". They can sign in immediately.</span>
        </div>
        <div className="field full">
          <label className="field-label">Role</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['admin', 'ops', 'finance'] as const).map((r) => (
              <button key={r} type="button" className={['tab', teamRole === r ? 'is-on' : ''].join(' ')} onClick={() => setTeamRole(r)}>{r}</button>
            ))}
          </div>
          <span className="field-help">
            <strong>admin</strong> · full access · <strong>ops</strong> · campaigns + creators · <strong>finance</strong> · wallet + payouts
          </span>
        </div>
        {!canManageTeam && (
          <div className="field full" style={{ background: 'var(--warn-bg)', padding: 12, borderRadius: 6, fontSize: 12.5, color: 'var(--ink-80)' }}>
            Only brand-team admins can invite new members. Ask an admin on your team to do this.
          </div>
        )}
      </div>
    </Modal>
  );
}
