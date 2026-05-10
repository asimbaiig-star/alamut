// Presence banner — surfaces other tabs/admins viewing the same entity
// (Phase 22). Renders inline (typically inside a modal body) so the
// reviewer sees it RIGHT before they take destructive action.

import { Icon } from './Icon';
import type { Viewer } from '@/lib/utils/usePresence';

interface Props {
  viewers: Viewer[];
  /** Override label when there's exactly one other viewer ("Riley" → "Riley is reviewing this"). */
  singularSuffix?: string;
}

export function PresenceBanner({ viewers, singularSuffix = 'is here too' }: Props) {
  if (viewers.length === 0) return null;
  const names = viewers.map((v) => labelToName(v.label)).slice(0, 2);
  const extras = Math.max(0, viewers.length - names.length);
  const text = viewers.length === 1
    ? `${names[0]} ${viewers[0].intent ? `is ${viewers[0].intent}` : singularSuffix}`
    : `${names.join(' & ')}${extras > 0 ? ` + ${extras} other${extras > 1 ? 's' : ''}` : ''} are viewing this too`;
  return (
    <div className="presence-banner" role="status" aria-live="polite">
      <span className="presence-banner-pulse" aria-hidden="true" />
      <Icon.users s={14} />
      <span>{text}</span>
      <span className="presence-banner-meta">Coordinate before you decide</span>
    </div>
  );
}

function labelToName(label: string): string {
  // Email → friendly first chunk: "riley@alamut.co" → "Riley"
  const local = label.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
