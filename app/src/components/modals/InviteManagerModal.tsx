// Invite a manager / agent — gives them a User with managesCreatorIds[] including this creator.
// Manager can sign in and act on the creator's behalf.
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';

interface InviteManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteManagerModal({ open, onClose }: InviteManagerModalProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.manager.invite({ email: email.trim().toLowerCase() });
      pushToast(`Invited ${email} as manager`, 'good');
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
      title="Invite a manager"
      width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!email.includes('@')} icon={<Icon.arrow s={14} />}>Send invite</Button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>
            <div className="mono-meta mb-8">What a manager can do</div>
            Managers act on your behalf — they can read messages, accept offers, submit drafts, and view earnings.
            They cannot withdraw funds or change payout details. Every action is logged with their identity for full audit.
          </div>
        </div>
        <div className="field full">
          <label className="field-label">Manager email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@youragency.com"
            autoFocus
          />
          <span className="field-help">In demo mode, password is "demo1234". They can sign in immediately and switch into your account.</span>
        </div>
      </div>
    </Modal>
  );
}
