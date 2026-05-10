// Compose a message to a specific user. Creates a new thread if none exists,
// otherwise appends to the existing thread for that user/campaign.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { api, select } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { initials } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';

interface MessageComposeModalProps {
  open: boolean;
  onClose: () => void;
  toUserId: string;
  toName: string;       // for display
  toPortrait?: string;
  campaignId?: string;
  campaignTitle?: string;
  goToInboxOnSend?: boolean;
}

export function MessageComposeModal({
  open, onClose, toUserId, toName, toPortrait, campaignId, campaignTitle, goToInboxOnSend,
}: MessageComposeModalProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const db = useStore((s) => s.db);
  const navigate = useNavigate();

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.messages.send({
        toUserId, campaignId,
        subject: campaignTitle ? campaignTitle : 'New conversation',
        text: text.trim(),
      });
      pushToast(`Message sent to ${toName}`, 'good');
      setText('');
      onClose();
      if (goToInboxOnSend) {
        // Route to whichever inbox the current user has access to
        const me = api.auth.currentUser();
        if (me?.creatorId) navigate('/creator/inbox');
        else if (me?.brandId) navigate('/brand/inbox');
      }
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Send failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  // Show a hint if a thread already exists with this user (to avoid duplicates)
  const me = api.auth.currentUser();
  const existing = me ? select.threadsForUser(db, me.id).find((t) =>
    t.participants.includes(toUserId) && (campaignId ? t.campaignId === campaignId : true)
  ) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Message ${toName}`}
      width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={send} loading={busy} disabled={!text.trim()} icon={<Icon.arrow s={14} />}>Send</Button>
      </>}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--rule)' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'var(--serif)' }}>
          {toPortrait ? <img src={toPortrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{initials(toName)}</span>}
        </div>
        <div>
          <div style={{ fontWeight: 500 }}>{toName}</div>
          {campaignTitle && <div className="mono-meta" style={{ marginTop: 2 }}>about · {campaignTitle}</div>}
        </div>
      </div>

      {existing && (
        <div style={{ background: 'var(--paper-2)', padding: 10, borderRadius: 4, fontSize: 12, color: 'var(--ink-80)', marginBottom: 12 }}>
          You already have a thread with {toName}{campaignTitle ? ` for this campaign` : ''}. This message will append to it.
        </div>
      )}

      <textarea
        autoFocus
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Write to ${toName}…`}
      />
      <div className="text-ink-60" style={{ fontSize: 12, marginTop: 8 }}>
        Both sides will see this in their inbox immediately.
      </div>
    </Modal>
  );
}
