// Side-by-side comparison of 2-5 creators.
// Highlights the "best" cell per row with a green tint.
import { useStore } from '@/lib/api/store';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtCount } from '@/lib/utils/format';
import type { Creator } from '@/lib/api/types';

interface CompareCreatorsModalProps {
  open: boolean;
  onClose: () => void;
  creatorIds: string[];
  onSendOffer?: (creatorId: string) => void;
}

export function CompareCreatorsModal({ open, onClose, creatorIds, onSendOffer }: CompareCreatorsModalProps) {
  const db = useStore((s) => s.db);
  const creators = creatorIds.map((id) => db.creators.find((c) => c.id === id)).filter(Boolean) as Creator[];

  if (creators.length === 0) return null;

  // Identify "best" indices per row (highest reach / engagement / rating; lowest response hours)
  const idxOfMax = (vals: number[]) => {
    const max = Math.max(...vals);
    return vals.map((v) => v === max);
  };
  const idxOfMin = (vals: number[]) => {
    const min = Math.min(...vals);
    return vals.map((v) => v === min);
  };

  const reachWin = idxOfMax(creators.map((c) => c.reach));
  const engWin   = idxOfMax(creators.map((c) => c.engagement));
  const ratingWin = idxOfMax(creators.map((c) => c.rating));
  const replyWin = idxOfMin(creators.map((c) => c.responseHrs));
  const lifetimeWin = idxOfMax(creators.map((c) => c.lifetimeEarnings));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Compare ${creators.length} creators`}
      width={Math.min(960, 200 + creators.length * 220)}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="compare-tbl">
          <thead>
            <tr>
              <th>Creator</th>
              {creators.map((c) => (
                <th key={c.id} style={{ background: 'var(--surface)', textAlign: 'center' }}>
                  <img src={c.portrait} alt={c.name} className="compare-portrait" />
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)', textTransform: 'none', letterSpacing: 'normal' }}>{c.name}</div>
                  <div className="mono-meta" style={{ marginTop: 4 }}>{c.handle}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Tier</th>
              {creators.map((c) => <td key={c.id}><Pill>{c.tier}</Pill> {c.verified && <Pill tone="good">Verified</Pill>}</td>)}
            </tr>
            <tr>
              <th>Tagline</th>
              {creators.map((c) => <td key={c.id}>{c.tagline}</td>)}
            </tr>
            <tr>
              <th>Location</th>
              {creators.map((c) => <td key={c.id}>{c.city}, {c.country}</td>)}
            </tr>
            <tr>
              <th>Categories</th>
              {creators.map((c) => <td key={c.id}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{c.categories.map((cat) => <Pill key={cat}>{cat}</Pill>)}</div>
              </td>)}
            </tr>
            <tr>
              <th>Languages</th>
              {creators.map((c) => <td key={c.id}>{c.languages.join(', ') || '—'}</td>)}
            </tr>
            <tr>
              <th>Reach</th>
              {creators.map((c, i) => <td key={c.id} className={reachWin[i] ? 'compare-best' : ''} style={{ fontFamily: 'var(--mono)' }}>{fmtCount(c.reach)}</td>)}
            </tr>
            <tr>
              <th>Engagement %</th>
              {creators.map((c, i) => <td key={c.id} className={engWin[i] ? 'compare-best' : ''} style={{ fontFamily: 'var(--mono)' }}>{c.engagement}</td>)}
            </tr>
            <tr>
              <th>Rating</th>
              {creators.map((c, i) => <td key={c.id} className={ratingWin[i] && c.rating > 0 ? 'compare-best' : ''} style={{ fontFamily: 'var(--mono)' }}>{c.rating || '—'}</td>)}
            </tr>
            <tr>
              <th>Response time</th>
              {creators.map((c, i) => <td key={c.id} className={replyWin[i] ? 'compare-best' : ''} style={{ fontFamily: 'var(--mono)' }}>{c.responseHrs}h</td>)}
            </tr>
            <tr>
              <th>Lifetime earned</th>
              {creators.map((c, i) => <td key={c.id} className={lifetimeWin[i] ? 'compare-best' : ''} style={{ fontFamily: 'var(--mono)' }}>${c.lifetimeEarnings.toLocaleString()}</td>)}
            </tr>
            <tr>
              <th>Rate · post</th>
              {creators.map((c) => <td key={c.id} className="mono-meta">{c.rateCard.post}</td>)}
            </tr>
            <tr>
              <th>Rate · reel</th>
              {creators.map((c) => <td key={c.id} className="mono-meta">{c.rateCard.reel}</td>)}
            </tr>
            <tr>
              <th>Rate · story</th>
              {creators.map((c) => <td key={c.id} className="mono-meta">{c.rateCard.story}</td>)}
            </tr>
            <tr>
              <th>Past clients</th>
              {creators.map((c) => <td key={c.id}>{c.pastClients.length ? c.pastClients.join(', ') : <span className="text-ink-60">—</span>}</td>)}
            </tr>
            <tr>
              <th>Sample work</th>
              {creators.map((c) => <td key={c.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {c.work.slice(0, 4).map((w, i) => (
                    <div key={i} style={{ aspectRatio: '1/1', background: `url(${w}) center/cover` }} />
                  ))}
                </div>
              </td>)}
            </tr>
            {onSendOffer && (
              <tr>
                <th></th>
                {creators.map((c) => <td key={c.id}>
                  <Button size="sm" onClick={() => { onSendOffer(c.id); onClose(); }} icon={<Icon.arrow s={12} />}>Send offer</Button>
                </td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-ink-60 mt-16" style={{ fontSize: 12 }}>Best value in each row highlighted. Reach/engagement/rating: higher is better. Response time: lower is better.</div>
    </Modal>
  );
}
