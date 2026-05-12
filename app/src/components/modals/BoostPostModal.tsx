// Brand-side: launch a whitelisted ad boost on a creator's posted content.
import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { getAcceptedCreators } from '@/lib/api/relations';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtMoneyFull } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { useCapability } from '@/lib/permissions';
import type { Campaign } from '@/lib/api/types';

interface BoostPostModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
}

export function BoostPostModal({ open, onClose, campaign }: BoostPostModalProps) {
  const db = useStore((s) => s.db);
  const { brand } = useAuth();
  // P1a: acceptedCreators is no longer stored — derived from offers.
  const acceptedCreatorIds = getAcceptedCreators(campaign.id, db);
  const [creatorId, setCreatorId] = useState(acceptedCreatorIds[0] || '');
  const [durationDays, setDurationDays] = useState(7);
  const [dailyBudget, setDailyBudget] = useState(50);
  const [busy, setBusy] = useState(false);

  if (!brand) return null;

  // Platform-specific minimum daily budgets — matches what the ad
  // networks actually enforce. Whoever owns the boost spec has been
  // burned by hitting "boost" only to see a generic "Daily budget too
  // low" error from the network; surface it here instead.
  const PLATFORM_MIN_DAILY: Record<string, number> = {
    instagram: 5,
    facebook: 5,
    snapchat: 5,
    youtube: 10,
    linkedin: 10,
    x: 10,
    tiktok: 20,
    pinterest: 2,
  };
  // Resolve the platform for THIS boost from the selected creator's
  // primary channel. The boost runs on whatever they posted on.
  const selectedCreator = db.creators.find((c) => c.id === creatorId);
  const primaryPlatform = selectedCreator?.platforms?.[0]?.name?.toLowerCase() ?? 'instagram';
  const minDailyForPlatform = PLATFORM_MIN_DAILY[primaryPlatform] ?? 5;
  const belowMin = dailyBudget < minDailyForPlatform;

  const total = durationDays * dailyBudget;
  const insufficient = brand.walletBalance < total;
  // Boost spends from the brand wallet, so it gates on the same
  // money-moving capability as topup/withdraw. Finance + admin can
  // launch boosts; ops + viewer cannot. (No dedicated `boost.create`
  // capability exists today — `wallet.topup` is the closest fit since
  // both roles that hold it can move money for the brand.)
  const canBoost = useCapability('wallet.topup');
  const acceptedCreators = acceptedCreatorIds
    .map((cid: string) => db.creators.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const submit = async () => {
    if (!creatorId) { pushToast('Pick a creator', 'bad'); return; }
    if (insufficient) { pushToast('Top up your wallet first', 'bad'); return; }
    if (belowMin) {
      pushToast(
        `${primaryPlatform[0].toUpperCase() + primaryPlatform.slice(1)} requires a minimum daily budget of $${minDailyForPlatform}`,
        'bad',
      );
      return;
    }
    setBusy(true);
    try {
      await api.ads.startBoost({ campaignId: campaign.id, creatorId, durationDays, dailyBudget });
      pushToast(`Boost running · ${fmtMoneyFull(total)} over ${durationDays}d`, 'good');
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Boost failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Boost post · whitelisted ad"
      width={580}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={insufficient || !creatorId || !canBoost || belowMin}
          title={!canBoost ? 'Boosts require admin or finance role' : undefined}
          icon={<Icon.spark s={14} />}
        >
          {canBoost ? `Launch boost · ${fmtMoneyFull(total)}` : 'Admin/finance only'}
        </Button>
      </>}
    >
      <div style={{ background: 'var(--paper-2)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--ink-80)', marginBottom: 18 }}>
        Whitelisted ads run on the creator's handle, audience trust preserved. Boosted clicks are added to the campaign's tracking.
        Estimated lift: 6–10× clicks per dollar, 0.5–2× revenue per dollar (typical ranges).
      </div>

      <div className="form-grid">
        <div className="field full">
          <label className="field-label">Creator</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {acceptedCreators.map((c) => (
              <button key={c.id} type="button" onClick={() => setCreatorId(c.id)} className={['tab', creatorId === c.id ? 'is-on' : ''].join(' ')}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label">Duration (days)</label>
          <input type="number" min={1} max={60} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
        </div>
        <div className="field">
          <label className="field-label">Daily budget (USD)</label>
          <input
            type="number"
            min={minDailyForPlatform}
            step={5}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(Number(e.target.value))}
          />
          <span
            className="field-help"
            style={{ color: belowMin ? 'var(--bad)' : undefined }}
          >
            {belowMin
              ? `${primaryPlatform[0].toUpperCase() + primaryPlatform.slice(1)} requires a minimum of $${minDailyForPlatform}/day`
              : `${primaryPlatform[0].toUpperCase() + primaryPlatform.slice(1)} minimum: $${minDailyForPlatform}/day`}
          </span>
        </div>
        <div className="field full">
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
            <span className="mono-meta">Total spend</span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{fmtMoneyFull(total)}</span>
          </div>
        </div>
        <div className="field full">
          <div className="row-between">
            <span className="mono-meta">Wallet balance</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: insufficient ? 'var(--bad)' : 'var(--ink-80)' }}>{fmtMoneyFull(brand.walletBalance)}</span>
          </div>
          {insufficient && (
            <div className="text-bad mt-8" style={{ fontSize: 12 }}>Not enough balance — top up first.</div>
          )}
        </div>
        {!campaign.rights?.whitelistAds && (
          <div className="field full">
            <Pill tone="bad">Whitelisting wasn't granted on this campaign</Pill>
            <span className="field-help">Brands need to specify whitelisted-ads rights at brief time. This boost won't go through.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
