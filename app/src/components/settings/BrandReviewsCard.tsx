// Reviews ABOUT this brand. Brand owner can respond once per review.
import { useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { useStore } from '@/lib/api/store';
import { api, select } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtRelative } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span style={{ letterSpacing: '0.04em', color: 'var(--accent)' }}>
      {Array.from({ length: 5 }).map((_, i) => (i < full ? '★' : '☆')).join('')}
    </span>
  );
}

export function BrandReviewsCard() {
  const { brand } = useAuth();
  const db = useStore((s) => s.db);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!brand) return null;
  const reviews = select.reviewsForBrand(db, brand.id);
  const avg = reviews.length > 0 ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2) : 0;
  const unanswered = reviews.filter((r) => !r.response).length;

  const submit = async (id: string) => {
    if (responseText.trim().length < 5) { pushToast('Add a few words', 'bad'); return; }
    setBusy(true);
    try {
      await api.reviews.respond(id, responseText.trim());
      pushToast('Response published', 'good');
      setRespondingTo(null);
      setResponseText('');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not respond', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={`Reviews from creators · ${reviews.length} total · ${avg || '—'} avg${unanswered ? ` · ${unanswered} awaiting response` : ''}`}>
      {reviews.length === 0 ? (
        <div className="text-ink-60" style={{ fontSize: 13 }}>No reviews yet. Once a closed campaign creator leaves you a review, it'll appear here.</div>
      ) : (
        reviews.slice(0, 8).map((r) => {
          const fromUser = db.users.find((u) => u.id === r.fromUserId);
          const fromCreator = fromUser?.creatorId ? db.creators.find((c) => c.id === fromUser.creatorId) : null;
          const cmp = db.campaigns.find((c) => c.id === r.campaignId);
          return (
            <div key={r.id} style={{ borderTop: '1px solid var(--rule)', padding: '14px 0' }}>
              <div className="row-between mb-8">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {fromCreator?.portrait && <img src={fromCreator.portrait} alt="" style={{ width: 32, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{fromCreator?.name || 'Creator'}</div>
                    <div className="mono-meta">{cmp?.title} · {fmtRelative(r.at)}</div>
                  </div>
                </div>
                <Stars value={r.rating} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-80)', lineHeight: 1.55 }}>{r.text}</div>

              {r.response ? (
                <div style={{ marginTop: 10, marginLeft: 14, paddingLeft: 14, borderLeft: '2px solid var(--rule)' }}>
                  <div className="mono-meta mb-8">Your response · {fmtRelative(r.response.at)}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-80)', lineHeight: 1.55 }}>{r.response.text}</div>
                </div>
              ) : respondingTo === r.id ? (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    rows={3}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Public response — visible on your brand profile."
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <Button variant="ghost" size="sm" onClick={() => { setRespondingTo(null); setResponseText(''); }}>Cancel</Button>
                    <Button size="sm" onClick={() => submit(r.id)} loading={busy} icon={<Icon.check s={12} />}>Publish response</Button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <Button variant="plain" size="sm" onClick={() => { setRespondingTo(r.id); setResponseText(''); }}>Respond</Button>
                  {r.rating <= 3 && <Pill tone="warn" className="ml-8">Below 4 stars — worth addressing</Pill>}
                </div>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
}
