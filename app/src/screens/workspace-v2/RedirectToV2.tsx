// RedirectToV2.tsx — cutover redirect helper.
//
// Phase F of the migration. The old `/creator/*` and `/brand/*` URLs
// are redirected to `/v2`, which carries the workspace forward. Each
// old URL maps to a v2 internal route (e.g. `/brand/discover` → v2
// route="discover"). Setting `localStorage.alamut.v2.route` BEFORE
// navigating means WorkspaceV2 picks up the right tab on first paint
// instead of always landing on home.
//
// Used in router.tsx in place of the old screen imports for the
// cutover paths. The old screen modules stay in source for the
// 1-week soak per Phase G, so we can `git revert` if needed.

import { Navigate, useParams } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import type { Database } from '@/lib/api/types';

interface Props {
  /** v2 internal route id (e.g. "discover", "creator-inbox", "wallet") */
  to?: string;
  /** When true, resolve the URL `:dealId` param to a v2 `deal:<convId>` route */
  resolveDeal?: boolean;
}

const ROUTE_KEY = 'alamut.v2.route';

/**
 * Resolve an offer/deal id from the existing schema to a conversation
 * id. The legacy `/deal/:dealId` URL contract keys by the offer id;
 * the v2 `deal:<convId>` route keys by the thread/conversation id.
 * Post §2.5 collapse, that v2 route opens Inbox with the matching
 * thread pre-selected and the detailed side panel mode. We bridge by
 * finding the thread that links the same brand×creator pair on the
 * same campaign.
 */
function resolveDealConversationId(dealId: string, db: Database): string | null {
  const offer = db.offers.find((o) => o.id === dealId);
  if (!offer) return null;
  const thread = db.threads.find(
    (t) => t.campaignId === offer.campaignId &&
      t.participants.some((p) => {
        const u = db.users.find((u) => u.id === p);
        return u?.creatorId === offer.creatorId;
      }),
  );
  return thread?.id ?? null;
}

export function RedirectToV2({ to, resolveDeal = false }: Props) {
  const params = useParams<{ dealId?: string }>();
  const db = useStore((s) => s.db);

  // Set the v2 route synchronously during render. We can't put this in a
  // useEffect because <Navigate>'s internal effect fires before the
  // parent's effects, so the navigation would happen before localStorage
  // is updated and WorkspaceV2 would land on its previous tab.
  let target = to ?? 'home';
  if (resolveDeal && params.dealId) {
    const convId = resolveDealConversationId(params.dealId, db);
    target = convId ? `deal:${convId}` : 'inbox';
  }
  try {
    localStorage.setItem(ROUTE_KEY, target);
  } catch { /* storage disabled — graceful degrade to home */ }

  return <Navigate to="/v2" replace />;
}
