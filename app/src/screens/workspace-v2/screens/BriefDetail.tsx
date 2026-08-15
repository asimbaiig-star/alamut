// BriefDetail.tsx · v2 creator-side brief detail / apply flow · refined
//
// Aligned with the design's brief-v2.jsx pattern:
//   1. Slimmer match hero — moss gradient, smaller score circle, single
//      sentence headline, 5 labeled progress-bar facets (Audience /
//      Niche / ER / Geo / Brand history), payout column flush right.
//      No decorative glow.
//   2. Competition strip is an inline meta line below the hero (not a
//      card) — viewing count, applicants, deadline, the creator's rank.
//   3. Brief blocks split into Do / Don't side-by-side with clean
//      circle/cross markers (no emoji clip icon on references).
//   4. Spark-flagged clauses collapsed into one expandable summary row
//      (review on demand) instead of a permanent section.
//   5. Sidebar rows lose the emoji icons in favor of clean key/value.

import { useEffect, useMemo, useState } from 'react';
import { fmtUSD, Icon, Topbar } from '../lib';
import { useV2CampaignById, useV2CurrentCreator } from '../v2Hooks';
import { creatorToV2 } from '../v2Adapters';
import { matchCreatorToCampaign } from '../matching';
import { getAcceptedCreators } from '@/lib/api/relations';
import { v2ApplyToCampaign } from '../v2CampaignActions';
import { useStore } from '@/lib/api/store';
import { pushToast } from '@/lib/utils/toast';
import { parseNumberInput } from '@/lib/utils/format';
import type { V2Campaign } from '../data';

interface Props {
  campaignId: string;
  onRoute: (r: string) => void;
}

export function BriefDetail({ campaignId, onRoute }: Props) {
  const campaign = useV2CampaignById(campaignId);
  const me = useV2CurrentCreator();
  const db = useStore((s) => s.db);
  const meV2 = me ? creatorToV2(me, db) : null;
  const [pitch, setPitch] = useState('');
  const [price, setPrice] = useState<number>(() => meV2?.rate ?? 350);
  const [applied, setApplied] = useState(false);
  const [showSparkClauses, setShowSparkClauses] = useState(false);

  // Existing-relationship detection — when the brand has already sent
  // this creator an offer (or the creator has applied), the apply
  // form is wrong: the creator needs accept/decline/counter instead.
  // Three states we look for:
  //
  //   1. Active Collaboration → route the creator to CollabDetail,
  //      where StageActionBanner already renders the right CTAs for
  //      every stage (pending offer, counter awaiting, upload draft,
  //      etc.). Avoids duplicating the offer UI here.
  //
  //   2. Application without a collab → mark the form "applied" so
  //      the success-state panel renders (the creator already pitched,
  //      brand hasn't responded yet).
  //
  //   3. None of the above → the apply form renders normally.
  //
  // Keyed by `db` (entire store) so the detection re-fires whenever
  // an offer arrives mid-session.
  const existingCollab = useMemo(() => {
    if (!me) return null;
    return db.collaborations.find(
      (c) => c.campaignId === campaignId && c.creatorId === me.id,
    ) ?? null;
  }, [db.collaborations, campaignId, me]);
  const existingApplication = useMemo(() => {
    if (!me) return null;
    return db.applications.find(
      (a) => a.campaignId === campaignId && a.creatorId === me.id,
    ) ?? null;
  }, [db.applications, campaignId, me]);

  // Route to CollabDetail when a collab already exists. Wrapped in an
  // effect so the router transition runs after render rather than during
  // it (would otherwise warn about updating an unmounted component).
  useEffect(() => {
    if (existingCollab) {
      onRoute(`collab:${existingCollab.id}`);
    }
  }, [existingCollab, onRoute]);

  // If the creator has applied but no collab yet, the apply form should
  // render the "Application sent" state straight away (instead of
  // showing a fresh blank pitch box).
  useEffect(() => {
    if (existingApplication && !existingCollab) {
      setApplied(true);
    }
  }, [existingApplication, existingCollab]);

  const myCats = me?.categories ?? [];
  // Per-facet match scores derived from real Creator + Campaign signals:
  //   audience  = creator audience match for campaign's preferred age band
  //   niche     = fraction of creator categories matching campaign category
  //   ER        = creator's avg ER scaled (12% = 100, 4% = 33)
  //   geo       = exact city in placement (100) / partial (70) / neither (40)
  //   history   = past collabs with this brand on platform (any record = 95)
  //   overall   = mean of the five facets
  // Fit comes from `matching.ts` — the one scorer.
  //
  // This screen used to carry its own, and it was the worst of the three
  // copies. Every facet had a floor (audience ≥ 40, niche ≥ 50, ER ≥ 20,
  // geo ≥ 40, history ≥ 50), so `overall` could never drop below 40: a
  // brand-new creator with no categories, no platforms and no rate card
  // read "40% · Stretch match" in a moss-green hero with five confident
  // progress bars — while the SAME creator saw an honest "fit unknown" for
  // the SAME brief one screen earlier on BrowseBriefs.
  //
  // It also still contained the bug `matching.ts` documents as fixed: the
  // geo facet compared the creator's city against `campaign.placement` —
  // the deliverables string, e.g. "1 IG post + 1 Reel" — instead of
  // `campaign.region`, so geo essentially never matched.
  const rawCampaign = useMemo(
    () => db.campaigns.find((c) => c.id === campaignId) ?? null,
    [db.campaigns, campaignId],
  );
  const match = useMemo(() => {
    // Per-creator budget feeds the matcher's rate-fit facet. Same split the
    // payout column shows, so the two can't disagree.
    const perCreator = rawCampaign
      ? Math.round(rawCampaign.budget / Math.max(4, getAcceptedCreators(rawCampaign.id, db).length || 4))
      : 0;
    return matchCreatorToCampaign(me, rawCampaign, db, perCreator);
  }, [me, rawCampaign, db]);

  if (!campaign) {
    return (
      <>
        <Topbar title="Campaign" crumb="Not found" />
        <div className="v2-content"><p className="v2-muted">No campaign with that id.</p></div>
      </>
    );
  }

  const matchScore = match.score;
  const suggested = Math.round(campaign.budget / Math.max(4, campaign.creators.length || 4));

  const avail = me?.availability;
  const onVacation = !!avail?.vacationMode;
  const minRate = avail?.minRate;
  const isBelowFloor = minRate !== undefined && price > 0 && price < minRate;
  const autoDeclined = !!avail?.autoDeclineCategories?.some(
    (cat) => campaign.category && cat.toLowerCase() === campaign.category.toLowerCase(),
  );
  const matchedAutoDecline = autoDeclined ? campaign.category : null;

  // Competition signal — applicant count from real db.applications so
  // the creator sees the same number the brand sees on the Pipeline
  // kanban. Pre-fix `applicants` was `3 + ((hash(campaign.id) * 3) % 9)`
  // — a deterministic random per campaign that had nothing to do with
  // actual demand on the brief. `viewing` is still synthesized (we
  // don't track storefront/brief views yet) but anchored to the real
  // applicant count so it scales sensibly.
  const applicants = db.applications.filter(
    (a) => a.campaignId === campaign.id && (a.status === 'submitted' || a.status === 'shortlisted'),
  ).length;
  // `viewing`, `spotsOpen` and `rank` are gone.
  //
  //   viewing   = applicants + 4 + (charCodeAt(0) + charCodeAt(last)) % 17
  //               — brief views aren't tracked at all, and the "signal" was
  //               the campaign id's ASCII codes. Same trick as the Top
  //               Performers leaderboard, on a scarcity cue.
  //   spotsOpen = 6 - applicants, where 6 was invented here; BrowseBriefs
  //               computed a DIFFERENT cap, so one campaign showed
  //               "3 of 8 filled" on the card and "2 of 6" on this page.
  //   rank      = a 3-bucket lookup on the match score, printed as
  //               "Your rank #N by match" beside the real applicant count,
  //               with equal visual confidence.
  //
  // All three were urgency cues manufactured to push a pitch. `applicants`
  // and `daysToClose` below are real, and they're enough.
  const daysToClose = (() => {
    if (!campaign.deadline) return 7;
    const ms = new Date(campaign.deadline).getTime() - Date.now();
    return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
  })();

  return (
    <>
      <Topbar
        title={campaign.name}
        crumb={
          <span>
            {/* `brief:` is a cross-persona route (a brand can reach this
                page from CampaignDetail's non-owner fallback, or by deep
                link), but 'creator-campaigns' is CREATOR_ONLY — so this
                crumb silently flipped a brand viewer into the creator
                persona. Send each side back to its own list. */}
            <button
              type="button"
              className="v2-link-btn"
              onClick={() => onRoute(me ? 'creator-campaigns' : 'campaigns')}
            >Campaigns</button>
            {' · '}{campaign.brand}
          </span>
        }
      />
      <div className="v2-content" style={{ maxWidth: 1080 }}>
        {/* Availability guardrails — sit above the hero so creators see
            them first. Same content as before, just scoped above. */}
        {(onVacation || matchedAutoDecline) && (
          <div
            className="v2-card v2-card-pad"
            style={{
              marginBottom: 16,
              background: 'rgba(184, 144, 47, 0.06)',
              borderColor: 'var(--v2-gold)',
            }}
          >
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--v2-gold)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}>
              Heads up
            </div>
            {onVacation && (
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--v2-ink-2)', marginBottom: matchedAutoDecline ? 6 : 0 }}>
                ✈ You're in <strong>vacation mode</strong>. Brands seeing your storefront know you're not actively monitoring — applying signals you're back. <button type="button" className="v2-link-btn" onClick={() => onRoute('storefront')}>Update availability</button>
              </div>
            )}
            {matchedAutoDecline && (
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--v2-ink-2)' }}>
                This brief is in <strong>{matchedAutoDecline}</strong> — a category in your auto-decline list. You can still apply, but you flagged this category as not-for-you in <button type="button" className="v2-link-btn" onClick={() => onRoute('storefront')}>availability settings</button>.
              </div>
            )}
          </div>
        )}

        {/* ─── Slimmer match hero ─────────────────────────────────── */}
        <MatchHero
          campaign={campaign}
          score={matchScore}
          reasons={match.reasons}
          insufficient={match.insufficient}
          payout={suggested}
          headline={
            me
              ? `Your ${(myCats[0] ?? 'lifestyle').toLowerCase()} content overlaps with ${campaign.brand}'s direction — ${campaign.placement.toLowerCase()}.`
              : `Match against ${campaign.brand}'s creative direction. Pitch with a clear angle to stand out.`
          }
        />

        {/* ─── Inline competition strip (not a card) ─────────────── */}
        <div
          className="v2-row"
          style={{
            padding: '10px 4px',
            marginBottom: 16,
            gap: 14,
            flexWrap: 'wrap',
            fontSize: 12.5,
            color: 'var(--v2-ink-2)',
            borderBottom: '1px solid var(--v2-line)',
          }}
        >
          <span>
            <strong className="v2-tabular">{applicants}</strong>{' '}
            {applicants === 1 ? 'creator has' : 'creators have'} applied
          </span>
          <span style={{ color: 'var(--v2-ink-3)' }}>·</span>
          <span style={{ color: 'var(--v2-accent)', fontWeight: 600 }}>
            {daysToClose === 0 ? 'Closes today' : `Closes in ${daysToClose}d`}
          </span>
          <span className="v2-spacer" />
          {/* Urgency only makes sense on a brief you can actually apply to.
              On a draft it sat directly above "Not open yet", telling the
              creator to hurry into a door the page had just closed. */}
          <span className="v2-muted" style={{ fontSize: 12 }}>
            {campaign.status === 'Live'
              ? 'Applying early puts you in front of the brand before the roster fills.'
              : campaign.status === 'Paused'
                ? 'Paused by the brand — saved briefs stay in your list if it reopens.'
                : 'Not accepting applications yet.'}
          </span>
        </div>

        <div className="v2-row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 480px', minWidth: 0 }}>
            {/* ─── Brief content (Do/Don't side by side) ─────────── */}
            <section className="v2-card v2-card-pad-lg" style={{ marginBottom: 16 }}>
              <div className="v2-row" style={{ gap: 14, marginBottom: 18 }}>
                <div className="v2-brand-mark-lg">{campaign.brand[0]?.toUpperCase()}</div>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--v2-font-display)',
                    fontSize: 26,
                    fontWeight: 500,
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}>{campaign.name}</h2>
                  <div className="v2-muted" style={{ fontSize: 13 }}>
                    {campaign.brand} · Posted recently
                  </div>
                </div>
              </div>

              <h3 style={{
                fontFamily: 'var(--v2-font-display)',
                fontSize: 18,
                fontWeight: 500,
                margin: '20px 0 8px',
              }}>The brief</h3>
              <p style={{ lineHeight: 1.6, color: 'var(--v2-ink-2)', margin: '0 0 20px' }}>
                {campaign.brief}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <BriefBlock
                  kind="do"
                  title="Must do"
                  items={[
                    `Show product clearly within first 3 seconds`,
                    `Use the campaign hashtag and tag the brand`,
                    `Daily-life tone — no flashy hard cuts`,
                    `Deliver: ${campaign.placement}`,
                  ]}
                />
                <BriefBlock
                  kind="dont"
                  title="Don't"
                  items={[
                    'Mention competing brands in the same category',
                    'Use AI-generated voiceover or stock footage',
                    'Promote outside the agreed exclusivity window',
                  ]}
                />
              </div>

              {/* Spark-flagged clauses — single expandable row. */}
              <div style={{ marginTop: 18, borderTop: '1px solid var(--v2-line)', paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowSparkClauses((v) => !v)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    color: 'var(--v2-ink-2)',
                  }}
                >
                  <div className="v2-row" style={{ gap: 8 }}>
                    <span style={{ display: 'flex', color: 'var(--v2-accent)' }}>{Icon.spark}</span>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                      Spark flagged 3 clauses to review
                    </span>
                    <span className="v2-spacer" />
                    <span className="v2-muted" style={{ fontSize: 12 }}>
                      {showSparkClauses ? '− Hide' : '+ Show'}
                    </span>
                  </div>
                </button>
                {showSparkClauses && (
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '12px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <SparkClause
                      kind="exclusivity"
                      detail="2-week exclusivity in the beauty category — you can't post for competing brands during this window."
                    />
                    <SparkClause
                      kind="usage"
                      detail="Brand may repurpose your content as a paid ad on their handle for 30 days. Outside your handle, ad spend is not whitelisted."
                    />
                    <SparkClause
                      kind="disclosure"
                      detail="FTC-style #ad disclosure required in the first line of the caption. Non-compliance voids escrow release."
                    />
                  </ul>
                )}
              </div>
            </section>

            {/* ─── Apply form ─────────────────────────────────────── */}
            {!applied && campaign.status !== 'Live' ? (
              // `v2ApplyToCampaign` refuses anything that isn't live, and
              // BrowseBriefs lists Planned and Paused briefs (12 seeded
              // campaigns are drafts). The refusal used to arrive as a
              // toast AFTER the creator had written a pitch and named a
              // price. Say it before they spend the effort.
              <section className="v2-card v2-card-pad-lg">
                <h3 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}>
                  {campaign.status === 'Paused' ? 'Applications paused' : 'Not open yet'}
                </h3>
                <p className="v2-muted" style={{ fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.55 }}>
                  {campaign.status === 'Paused'
                    ? `${campaign.brand} has paused this brief. Save it and you'll have it to hand if they reopen.`
                    : `${campaign.brand} hasn't opened this brief for applications yet. Save it now and check back — nothing is lost by waiting.`}
                </p>
                <button
                  className="v2-btn v2-btn-outline"
                  type="button"
                  onClick={() => onRoute('creator-campaigns?status=Live')}
                >
                  Browse open briefs
                </button>
              </section>
            ) : !applied ? (
              <section className="v2-card v2-card-pad-lg">
                <h3 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: '0 0 16px',
                  letterSpacing: '-0.02em',
                }}>
                  Apply with a pitch
                </h3>
                <div style={{ marginBottom: 18 }}>
                  <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                    Your pitch (why you're a fit)
                  </label>
                  <textarea
                    className="v2-input"
                    rows={4}
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    placeholder={`Tell ${campaign.brand} how you'd approach this — what angle, what makes you different.`}
                  />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label className="v2-eyebrow" htmlFor="v2-pitch-price" style={{ display: 'block', marginBottom: 6 }}>
                    Your price (USD)
                  </label>
                  <div className="v2-onboarding-rate">
                    <span className="v2-onboarding-rate-prefix">$</span>
                    <input
                      id="v2-pitch-price"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(parseNumberInput(e.target.value, { min: 0 }))}
                    />
                    <span className="v2-onboarding-rate-sub">total</span>
                  </div>
                  <div className="v2-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Brand range: {fmtUSD(Math.round(suggested * 0.7))}–{fmtUSD(Math.round(suggested * 1.4))}
                    {meV2 ? ` · Your usual rate: ${fmtUSD(meV2.rate)}` : ''}
                    {minRate !== undefined ? ` · Floor: ${fmtUSD(minRate)}` : ''}
                  </div>
                  {isBelowFloor && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: 'rgba(184, 144, 47, 0.08)',
                      borderRadius: 6,
                      border: '1px solid var(--v2-gold)',
                      fontSize: 12,
                      color: 'var(--v2-ink-2)',
                      lineHeight: 1.45,
                    }}>
                      <strong style={{ color: 'var(--v2-gold)' }}>Below your floor</strong> — your minimum rate is {fmtUSD(minRate!)}. You can still pitch at this number, but you set this floor for a reason.
                    </div>
                  )}
                </div>
                <button
                  className="v2-btn v2-btn-primary"
                  type="button"
                  style={{ width: '100%' }}
                  onClick={() => {
                    // Only flip to the success state if an application was
                    // actually created. Pre-fix `setApplied(true)` ran
                    // unconditionally: with no creator identity the write was
                    // skipped and the creator still got "Application sent —
                    // {brand} typically replies within 48 hours", for a
                    // record that did not exist.
                    if (!me) {
                      pushToast('Sign in as a creator to apply to this brief', 'bad');
                      return;
                    }
                    const application = v2ApplyToCampaign(campaignId, me.id, pitch, price);
                    if (!application) {
                      pushToast('This brief isn’t accepting applications right now', 'bad');
                      return;
                    }
                    setApplied(true);
                  }}
                  disabled={!pitch.trim() || price <= 0}
                >
                  Send application {Icon.arrow}
                </button>
              </section>
            ) : (
              <section
                className="v2-card v2-card-pad-lg"
                style={{
                  textAlign: 'center',
                  background: 'var(--v2-moss-soft)',
                  borderColor: 'var(--v2-moss-soft)',
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                <h3 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                }}>
                  Application sent
                </h3>
                <p style={{ margin: '0 0 16px', color: 'var(--v2-ink-2)' }}>
                  We'll notify you in Inbox as soon as {campaign.brand} responds.
                </p>
                <button
                  className="v2-btn v2-btn-primary"
                  type="button"
                  onClick={() => onRoute('creator-collabs')}
                >
                  Go to my collaborations
                </button>
              </section>
            )}
          </div>

          {/* ─── Sidebar (clean key/value, no emoji) ────────────── */}
          <aside style={{ flex: '1 1 280px' }}>
            <div className="v2-card v2-card-pad" style={{ marginBottom: 16 }}>
              <div className="v2-eyebrow" style={{ marginBottom: 8 }}>Compensation</div>
              <div
                className="v2-tabular"
                style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
              >{fmtUSD(suggested)}</div>
              <div className="v2-muted" style={{ fontSize: 12, marginBottom: 14 }}>
                per creator · paid via escrow
              </div>
              <KvRow k="Deadline" v={new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <KvRow k="Placement" v={campaign.placement} />
              <KvRow k="Total budget" v={fmtUSD(campaign.budget)} />
              {/* "Spots open — N of 6" removed: `Campaign` has no roster-size
                  field, so the 6 was invented here and BrowseBriefs invented
                  a different one. */}
              <KvRow k="Applicants" v={String(applicants)} />
            </div>

            <div className="v2-card v2-card-pad">
              <div className="v2-eyebrow" style={{ marginBottom: 12 }}>About {campaign.brand}</div>
              <div className="v2-row" style={{ gap: 12, marginBottom: 12 }}>
                <div className="v2-brand-mark-lg" style={{ width: 40, height: 40, fontSize: 18 }}>
                  {campaign.brand[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{campaign.brand}</div>
                  {/* "Verified brand" was hardcoded for every campaign,
                      including seeded demo brands — on the page where a
                      creator commits to a pitch. Read the real flag. */}
                  <div className="v2-muted" style={{ fontSize: 11 }}>
                    {campaign.brandIsDemo
                      ? 'Sample brief · no real brand behind it'
                      : campaign.brandVerified ? 'Verified brand' : 'Not yet verified'}
                  </div>
                </div>
              </div>
              {/* Four reputation stats used to sit here — "Avg payout time
                  < 48 hours", "Approval rate 92%", "Repeat hire rate 68%",
                  "Disputes 0 this quarter" — all literal strings, identical
                  for every brand. `Brand` carries none of those fields.
                  `db.disputes` and `db.transactions` do exist, so real
                  versions are buildable later; inventing them meanwhile put
                  fake reliability signals in front of a creator at the exact
                  moment they decide whether to pitch. */}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Match hero — slim moss-gradient panel with score circle, headline,
// 5 facet bars, and a payout column.
// ════════════════════════════════════════════════════════════════
function MatchHero({
  campaign, score, reasons, insufficient, payout, headline,
}: {
  campaign: V2Campaign;
  /** null = not enough signal to score honestly. */
  score: number | null;
  reasons: string[];
  insufficient?: string;
  payout: number;
  headline: string;
}) {
  void campaign; // headline carries the campaign reference; no other use
  // `score` can be null now, and the hero says so instead of drawing a
  // floored number. The five facet bars are gone with the private scorer
  // that produced them — `matching.ts` reports which facets qualified as
  // plain reasons, so a creator sees WHY rather than five bars whose
  // minimums guaranteed a flattering total.
  const tier = score === null ? 'Fit unknown'
    : score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 60 ? 'Decent' : 'Stretch';
  const tierColor = score === null ? 'var(--v2-ink-3)'
    : score >= 75 ? 'var(--v2-moss)' : score >= 60 ? 'var(--v2-gold)' : 'var(--v2-ink-3)';
  const dash = `${((score ?? 0) / 100) * 226} 226`;

  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 28px',
        borderRadius: 14,
        marginBottom: 12,
        background: 'linear-gradient(135deg, #1F3527 0%, #2D4A35 100%)',
        color: 'var(--v2-paper)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Score circle — 84px, no decorative glow. */}
        <div style={{ flexShrink: 0, position: 'relative', width: 84, height: 84 }}>
          <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
            <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
            <circle
              cx="42"
              cy="42"
              r="36"
              fill="none"
              stroke="var(--v2-accent-2)"
              strokeWidth="6"
              strokeDasharray={dash}
              strokeLinecap="round"
              transform="rotate(-90 42 42)"
            />
          </svg>
          <div
            className="v2-tabular"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--v2-font-display)',
              fontSize: 28,
              fontWeight: 500,
              color: 'white',
            }}
          >{score}</div>
        </div>

        {/* Story column — tier pill + single sentence + 5 facet bars. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v2-row" style={{ gap: 8, marginBottom: 6 }}>
            <span
              style={{
                padding: '2px 9px',
                borderRadius: 999,
                background: tierColor,
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {tier} match
            </span>
            <span style={{ fontSize: 11.5, opacity: 0.55 }}>· Why this fits you</span>
          </div>
          <h2
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22,
              fontWeight: 500,
              margin: '0 0 12px',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              textWrap: 'balance',
            }}
          >
            {headline}
          </h2>

          {score === null ? (
            <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>
              {insufficient ?? 'Add channels and categories to your storefront to see how well this brief fits.'}
            </div>
          ) : reasons.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, opacity: 0.9, lineHeight: 1.7 }}>
              {reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : null}
        </div>

        {/* Payout column — flush right, tighter than v1. */}
        <div
          style={{
            flexShrink: 0,
            textAlign: 'right',
            borderLeft: '1px solid rgba(255,255,255,0.15)',
            paddingLeft: 24,
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{
            fontSize: 10,
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}>Pays</div>
          <div
            className="v2-tabular"
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {fmtUSD(payout)}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4 }}>
            escrow · released &lt;48h
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefBlock({
  kind, title, items,
}: {
  kind: 'do' | 'dont';
  title: string;
  items: string[];
}) {
  const isDo = kind === 'do';
  const accent = isDo ? 'var(--v2-moss)' : 'var(--v2-negative)';
  const accentBg = isDo ? 'var(--v2-moss-soft)' : 'rgba(168, 65, 43, 0.10)';
  return (
    <div>
      <div className="v2-row" style={{ gap: 8, marginBottom: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: accentBg,
            color: accent,
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {isDo ? '✓' : '×'}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: accent }}>
          {title}
        </span>
      </div>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {items.map((item) => (
          <li key={item} style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: 'var(--v2-ink-2)',
            paddingLeft: 22,
            position: 'relative',
          }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 4,
                top: 6,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'transparent',
                border: `1.5px solid ${accent}`,
              }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Spark-flagged clause — single row inside the expandable section.
// ════════════════════════════════════════════════════════════════
function SparkClause({
  kind, detail,
}: {
  kind: 'exclusivity' | 'usage' | 'disclosure';
  detail: string;
}) {
  const label =
    kind === 'exclusivity' ? 'Exclusivity'
      : kind === 'usage' ? 'Usage rights'
        : 'Disclosure';
  return (
    <li
      className="v2-row"
      style={{
        gap: 12,
        padding: 12,
        background: 'var(--v2-bg)',
        border: '1px solid var(--v2-line)',
        borderRadius: 8,
        alignItems: 'flex-start',
      }}
    >
      <span
        className="v2-pill v2-pill-accent"
        style={{ fontSize: 10, marginTop: 2 }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--v2-ink-2)', lineHeight: 1.5, flex: 1 }}>
        {detail}
      </span>
    </li>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="v2-row" style={{ justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
      <span className="v2-muted">{k}</span>
      <span className="v2-tabular" style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}
