// DealOwners.tsx — who on the brand team runs a given deal.
//
// WORKFLOW-GAPS D2.
//
// One row per deal: the creator, who currently owns it, and a picker to hand
// it over. Kept deliberately small — reassignment is a thirty-second
// housekeeping act, and burying it behind a modal would make it feel like a
// decision rather than a handover.

import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { brandTeam, dealOwnerUserId, v2ReassignCollab } from '../v2TeamActions';

export function DealOwnerRow({ collabId, creatorName }: { collabId: string; creatorName: string }) {
  const db = useStore((s) => s.db);
  const session = useStore((s) => s.session);

  const collab = db.collaborations.find((c) => c.id === collabId);
  if (!collab) return null;

  const ownerId = dealOwnerUserId(db, collab);
  const team = brandTeam(db, collab.brandId);
  const meId = session?.userId ?? '';

  return (
    <div className="v2-row" style={{ gap: 10, alignItems: 'center', fontSize: 12.5 }}>
      <span style={{ minWidth: 120 }}>{creatorName}</span>
      <label className="v2-sr-only" htmlFor={`v2-owner-${collabId}`}>
        Who runs the {creatorName} deal
      </label>
      <select
        id={`v2-owner-${collabId}`}
        className="v2-input"
        value={ownerId ?? ''}
        onChange={(e) => {
          try {
            v2ReassignCollab(collabId, e.target.value, meId);
            pushToast('Deal reassigned — they have been notified', 'good');
          } catch (err) {
            pushToast(err instanceof Error ? err.message : 'Could not reassign', 'bad');
          }
        }}
        style={{ flex: 1, maxWidth: 280 }}
      >
        {team.map((u) => (
          <option key={u.id} value={u.id}>
            {u.email}{u.teamRole ? ` · ${u.teamRole}` : ''}{u.id === meId ? ' (you)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
