// Platform-wide navigation hotkeys (Phase 20).
//
// Mounts once in the workspace shell and registers role-aware "g + key"
// sequences for jumping between top-level pages. Each role gets its own
// set — admins jump to Queue/Disputes/Audit, creators jump to Discover/
// Earnings, brands jump to Campaigns/Approvals/Wallet.
//
// `?` (handled by HotkeysHelp) shows the full registered list.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { useHotkeys, registerHotkeyDocs, type HotkeyMap, type HotkeyDoc } from '@/lib/utils/useHotkeys';

export function GlobalHotkeys() {
  const navigate = useNavigate();
  const { isCreator, isBrand, isAdmin } = useAuth();

  // Build the binding + doc tables in one place per role.
  const { map, docs } = (() => {
    const map: HotkeyMap = {};
    const docs: HotkeyDoc[] = [];

    if (isCreator) {
      map['g t'] = () => navigate('/creator/today');       docs.push({ keys: 'g t', label: 'Go to Today',     group: 'Navigation' });
      map['g d'] = () => navigate('/creator/discover');    docs.push({ keys: 'g d', label: 'Go to Discover',  group: 'Navigation' });
      map['g c'] = () => navigate('/creator/campaigns');   docs.push({ keys: 'g c', label: 'Go to Campaigns', group: 'Navigation' });
      map['g w'] = () => navigate('/creator/content');     docs.push({ keys: 'g w', label: 'Go to Content',   group: 'Navigation' });
      map['g i'] = () => navigate('/creator/inbox');       docs.push({ keys: 'g i', label: 'Go to Inbox',     group: 'Navigation' });
      map['g e'] = () => navigate('/creator/earnings');    docs.push({ keys: 'g e', label: 'Go to Earnings',  group: 'Navigation' });
      map['g a'] = () => navigate('/creator/analytics');   docs.push({ keys: 'g a', label: 'Go to Analytics', group: 'Navigation' });
      map['g p'] = () => navigate('/creator/profile');     docs.push({ keys: 'g p', label: 'Go to Profile',   group: 'Navigation' });
    } else if (isBrand) {
      map['g t'] = () => navigate('/brand/today');         docs.push({ keys: 'g t', label: 'Go to Today',     group: 'Navigation' });
      map['g d'] = () => navigate('/brand/discover');      docs.push({ keys: 'g d', label: 'Go to Discover',  group: 'Navigation' });
      map['g c'] = () => navigate('/brand/campaigns');     docs.push({ keys: 'g c', label: 'Go to Campaigns', group: 'Navigation' });
      // Phase 29: 'g a' was Approvals — Today's "Needs your decision"
      // band covers that, so we repurpose 'g a' for Analytics (was 'g n').
      map['g a'] = () => navigate('/brand/analytics');     docs.push({ keys: 'g a', label: 'Go to Analytics', group: 'Navigation' });
      map['g i'] = () => navigate('/brand/inbox');         docs.push({ keys: 'g i', label: 'Go to Inbox',     group: 'Navigation' });
      map['g w'] = () => navigate('/brand/wallet');        docs.push({ keys: 'g w', label: 'Go to Wallet',    group: 'Navigation' });
      // Phase 29: keep 'g n' bound as a backwards-compat alias for
      // Analytics. Not added to docs (would clutter help dialog with
      // duplicates) — discoverable via 'g a' which is the canonical key.
      map['g n'] = () => navigate('/brand/analytics');
      map['g p'] = () => navigate('/brand/profile');       docs.push({ keys: 'g p', label: 'Go to Profile',   group: 'Navigation' });
    } else if (isAdmin) {
      map['g h'] = () => navigate('/admin/home');          docs.push({ keys: 'g h', label: 'Go to Home',      group: 'Navigation' });
      map['g q'] = () => navigate('/admin/queue');                          docs.push({ keys: 'g q', label: 'Go to Queue · creators',  group: 'Navigation' });
      map['g v'] = () => navigate('/admin/queue?type=brands');              docs.push({ keys: 'g v', label: 'Go to Queue · brands',    group: 'Navigation' });
      map['g d'] = () => navigate('/admin/queue?type=disputes');            docs.push({ keys: 'g d', label: 'Go to Queue · disputes',  group: 'Navigation' });
      map['g p'] = () => navigate('/admin/payouts');       docs.push({ keys: 'g p', label: 'Go to Payouts',   group: 'Navigation' });
      map['g a'] = () => navigate('/admin/audit');         docs.push({ keys: 'g a', label: 'Go to Audit',     group: 'Navigation' });
    }

    return { map, docs };
  })();

  // Register the bindings.
  useHotkeys(map);

  // Publish them to the help registry. Re-runs when role flips.
  useEffect(() => {
    if (docs.length === 0) return;
    return registerHotkeyDocs(...docs);
    // map identity is rebuilt every render; depend on the role flags so we
    // only re-register when the actual binding set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, isBrand, isAdmin]);

  return null;
}
