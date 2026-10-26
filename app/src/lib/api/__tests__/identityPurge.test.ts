// identityPurge.test.ts — what of the last person stays in the browser.
//
// Verified live before this fix: after Hannah signed out, her $1,050 offer to
// Amir, three of her collaborations and her thread with him were still in
// localStorage when Sarah signed in. The first case below is that scene.

import { describe, it, expect } from 'vitest';
import { SEED } from '@/lib/api/seed';
import type { Database } from '@/lib/api/types';
import { purgeIdentityData, EMPTY_LEDGER, type RemoteLedger } from '@/lib/api/identityPurge';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const ledger = (over: Partial<RemoteLedger> = {}): RemoteLedger =>
  ({ identity: 'hannah@aesop.test', ids: {}, userIds: ['u_hannah'], ...over });
// cmp_1 and cmp_3 are real Postgres campaigns; cmp_g0 is generated in the
// browser and has never been in Postgres.
const REMOTE = ['cmp_1', 'cmp_3'];

/** The store as Hannah's session left it. */
function hannahsStore(): Database {
  const db = clone(SEED);
  db.offers.push({ ...clone(db.offers[0]), id: 'off_amir_1050', campaignId: 'cmp_1', creatorId: 'c_amir', rate: 1050 });
  db.collaborations.push({ ...clone(db.collaborations[0]), id: 'col_1m1pkvn', campaignId: 'cmp_1', creatorId: 'c_amir' });
  db.threads.push({ ...clone(db.threads[0]), id: 't_hannah_amir', campaignId: 'cmp_1', participants: ['u_hannah', 'u_amir'] });
  db.messages.push({ ...clone(db.messages[0]), id: 'msg_hannah_amir', threadId: 't_hannah_amir' });
  // Her real wallet, overlaid onto the seed brand row by her own hydration.
  db.brands = db.brands.map((b) => (b.id === 'b_aesop' ? { ...b, walletBalance: 1234 } : b));
  // Browser-only demo work on a generated campaign — must survive.
  db.offers.push({ ...clone(db.offers[0]), id: 'off_demo_g0', campaignId: 'cmp_g0', creatorId: 'c_sarah' });
  db.threads.push({ ...clone(db.threads[0]), id: 't_demo_g0', campaignId: 'cmp_g0', participants: ['u_hannah', 'u_sarah'] });
  db.messages.push({ ...clone(db.messages[0]), id: 'msg_demo_g0', threadId: 't_demo_g0' });
  return db;
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('purgeIdentityData', () => {
  it('removes what Hannah left behind — the scene found live', () => {
    const out = purgeIdentityData(hannahsStore(), ledger({
      ids: { offers: ['off_amir_1050'], collaborations: ['col_1m1pkvn'], threads: ['t_hannah_amir'],
             messages: ['msg_hannah_amir'], brands: ['b_aesop'] },
    }), SEED, REMOTE);
    expect(ids(out.offers)).not.toContain('off_amir_1050');
    expect(ids(out.collaborations)).not.toContain('col_1m1pkvn');
    expect(ids(out.threads)).not.toContain('t_hannah_amir');
    expect(ids(out.messages)).not.toContain('msg_hannah_amir');
  });

  it('keeps browser-only demo work, so switching demo accounts loses nothing', () => {
    const out = purgeIdentityData(hannahsStore(), ledger(), SEED, REMOTE);
    expect(ids(out.offers)).toContain('off_demo_g0');
    expect(ids(out.threads)).toContain('t_demo_g0');
    expect(ids(out.messages)).toContain('msg_demo_g0');
  });

  it('a seed row carrying their data goes back to its seed version, not away', () => {
    const out = purgeIdentityData(hannahsStore(), ledger({ ids: { brands: ['b_aesop'] } }), SEED, REMOTE);
    const aesop = out.brands.find((b) => b.id === 'b_aesop');
    expect(aesop, 'a seed brand must not disappear').toBeDefined();
    expect(aesop!.walletBalance).toBe(SEED.brands.find((b) => b.id === 'b_aesop')!.walletBalance);
  });

  it('catches a row created this session and never re-fetched', () => {
    // Not in the ledger: sent and mirrored after the last hydration. It is
    // on a Postgres campaign, so it is theirs.
    const out = purgeIdentityData(hannahsStore(), ledger({ ids: {} }), SEED, REMOTE);
    expect(ids(out.offers)).not.toContain('off_amir_1050');
  });

  it('works on a store persisted before the ledger existed', () => {
    // identity undefined, no ids: the registry's campaign set alone must do.
    const out = purgeIdentityData(hannahsStore(), EMPTY_LEDGER, SEED, REMOTE);
    expect(ids(out.offers)).not.toContain('off_amir_1050');
    expect(ids(out.offers)).toContain('off_demo_g0');
  });

  it('removes their wallet rows and notifications, keeps everyone else\'s', () => {
    const db = hannahsStore();
    db.transactions.push({ ...clone(db.transactions[0]), id: 'tx_her_topup', userId: 'u_hannah', campaignId: undefined, kind: 'topup' });
    db.transactions.push({ ...clone(db.transactions[0]), id: 'tx_other', userId: 'u_marcus', campaignId: undefined, kind: 'topup' });
    db.notifications.push({ ...clone(db.notifications[0]), id: 'n_her', userId: 'u_hannah', meta: undefined });
    db.notifications.push({ ...clone(db.notifications[0]), id: 'n_for_sarah_g0', userId: 'u_sarah', meta: { campaignId: 'cmp_g0' } });
    // Created by Hannah's action for Amir, on a real campaign, not yet re-fetched.
    db.notifications.push({ ...clone(db.notifications[0]), id: 'n_for_amir_cmp1', userId: 'u_amir', meta: { campaignId: 'cmp_1' } });
    const out = purgeIdentityData(db, ledger(), SEED, REMOTE);
    expect(ids(out.transactions)).not.toContain('tx_her_topup');
    expect(ids(out.transactions)).toContain('tx_other');
    expect(ids(out.notifications)).not.toContain('n_her');
    expect(ids(out.notifications), 'a demo notification for the next persona').toContain('n_for_sarah_g0');
    // Its campaign lives in `meta` — the first version read the top-level
    // field and exempted every notification from the campaign rule.
    expect(ids(out.notifications), 'another user\'s notification about a real campaign').not.toContain('n_for_amir_cmp1');
  });

  it('a seed thread reset to seed keeps its seed messages and loses added ones', () => {
    const db = hannahsStore();
    db.messages.push({ ...clone(db.messages[0]), id: 'msg_added_to_t1', threadId: 't_1' });
    const out = purgeIdentityData(db, ledger({ ids: { threads: ['t_1'] } }), SEED, REMOTE);
    const t1 = out.messages.filter((m) => m.threadId === 't_1').map((m) => m.id);
    expect(t1).not.toContain('msg_added_to_t1');
    expect(t1.length).toBe(SEED.messages.filter((m) => m.threadId === 't_1').length);
  });

  it('never touches tables that are not mirrored', () => {
    const db = hannahsStore();
    const out = purgeIdentityData(db, ledger(), SEED, REMOTE);
    expect(out.users).toBe(db.users);
    expect(out.advances).toBe(db.advances);
    expect(out.testimonials).toBe(db.testimonials);
  });

  it('is idempotent', () => {
    const once = purgeIdentityData(hannahsStore(), ledger(), SEED, REMOTE);
    const twice = purgeIdentityData(once, ledger(), SEED, REMOTE);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
