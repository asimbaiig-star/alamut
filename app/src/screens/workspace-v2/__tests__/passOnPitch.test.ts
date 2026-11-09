// passOnPitch.test.ts — Pass on a pitch works unless an offer is in play.
//
// The campaign page showed Pass on every pitch, and on shortlisted ones it
// raised "withdraw the offer first" even when no offer existed. Shortlisted
// is interest; an offer (sent, countered or accepted) is what blocks a pass.

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/api/store';
import { v2RejectApplication } from '../v2CampaignActions';
import {
  buildDb, buildCampaign, buildCreator, buildBrand, buildOffer, buildApplication,
} from '@/lib/utils/__tests__/fixtures';
import type { User, OfferStatus } from '@/lib/api/types';

const userBrand: User = {
  id: 'u_brand', email: 'b@b.com', passwordHash: 'demo', role: 'brand',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', brandId: 'br_1', teamRole: 'admin',
};

function seed(offerStatus?: OfferStatus) {
  useStore.getState().setDB(buildDb({
    users: [userBrand],
    creators: [buildCreator({ id: 'cr_1' })],
    brands: [buildBrand({ id: 'br_1', userId: 'u_brand' })],
    campaigns: [buildCampaign({ id: 'cmp_1', brandId: 'br_1', stage: 'live' })],
    applications: [buildApplication({ id: 'app_1', campaignId: 'cmp_1', creatorId: 'cr_1', status: 'shortlisted', proposedRate: 900 })],
    offers: offerStatus ? [buildOffer({ id: 'off_1', campaignId: 'cmp_1', creatorId: 'cr_1', rate: 900, status: offerStatus })] : [],
  }));
  useStore.getState().setSession({ userId: 'u_brand', issuedAt: new Date().toISOString() });
}

describe('v2RejectApplication on a shortlisted pitch', () => {
  beforeEach(() => seed());

  it('passes when no offer was ever sent', () => {
    expect(v2RejectApplication('app_1').status).toBe('rejected');
  });

  it('passes when the only offer was declined, withdrawn or expired', () => {
    for (const st of ['declined', 'withdrawn', 'expired'] as const) {
      seed(st);
      expect(v2RejectApplication('app_1').status).toBe('rejected');
    }
  });

  it('refuses while an offer is in play, and says what to do', () => {
    for (const st of ['pending', 'countered', 'accepted'] as const) {
      seed(st);
      expect(() => v2RejectApplication('app_1')).toThrow(/Withdraw it first/);
      expect(useStore.getState().db.applications[0].status).toBe('shortlisted');
    }
  });
});
