// CreatorProfile.tsx — v2 brand-side creator drilldown
//
// Opened when a brand clicks a creator card from Discover, a creator
// avatar in Inbox, or any "View profile" link. Read-only — brands
// can't edit the creator's storefront, only act on it (Send brief,
// Save to shortlist, Compare).
//
// Visually it mirrors the public storefront but adds brand-only
// signals at the top (response time, fit-score, recent campaign
// outcomes) and primary CTAs in the topbar.

import { useMemo } from 'react';
import { fmtUSD, fmtFollowers, Icon, PLATFORM_META, ScoreBadge, Topbar } from '../lib';
import { useV2AllCampaigns, useV2Creators, useV2BrandShortlist, v2ToggleSavedCreator } from '../v2Hooks';
import { useStore } from '@/lib/api/store';

interface Props {
  creatorId: string;
  onRoute: (r: string) => void;
}

export function CreatorProfile({ creatorId, onRoute }: Props) {
  const allCreators = useV2Creators();
  const allCampaigns = useV2AllCampaigns();
  const savedIds = useV2BrandShortlist();
  const creator = allCreators.find((c) => c.id === creatorId) ?? allCreators[0];
  if (!creator) {
    return (
      <>
        <Topbar title="Creator" crumb="Not found" />
        <div className="v2-content"><p className="v2-muted">Creator not found.</p></div>
      </>
    );
  }
  const totalFollowers = creator.channels.reduce((s, ch) => s + ch.followers, 0);
  const avgEngagement = (
    creator.channels.reduce((s, ch) => s + ch.engagement, 0) / creator.channels.length
  ).toFixed(1);

  // Response time — average gap between the brand's last message and
  // this creator's reply, across every thread they share. Falls back
  // to the raw Creator.responseHrs from the seed when no replies exist.
  const db = useStore((s) => s.db);
  const responseTimeCopy = useMemo(() => {
    const rawCreator = db.creators.find((c) => c.id === creator.id);
    const userId = rawCreator?.userId;
    if (!userId) return `~${(creator as { responseHrs?: number }).responseHrs ?? 24} hrs`;
    // Walk all threads the creator participates in; for each thread, find
    // pairs where the other party messages first and the creator replies.
    const gaps: number[] = [];
    for (const t of db.threads) {
      if (!t.participants.includes(userId)) continue;
      const msgs = db.messages
        .filter((m) => m.threadId === t.id)
        .sort((a, b) => +new Date(a.at) - +new Date(b.at));
      for (let i = 1; i < msgs.length; i++) {
        const prev = msgs[i - 1];
        const curr = msgs[i];
        if (prev.fromUserId !== userId && curr.fromUserId === userId) {
          gaps.push(+new Date(curr.at) - +new Date(prev.at));
        }
      }
    }
    if (gaps.length === 0) return `~${(creator as { responseHrs?: number }).responseHrs ?? 24} hrs`;
    const avgMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const hours = avgMs / 3_600_000;
    if (hours < 1) return `~${Math.round(hours * 60)} min`;
    if (hours < 24) return `~${Math.round(hours)} hrs`;
    return `~${(hours / 24).toFixed(1)} days`;
  }, [db, creator]);

  // Past collabs from campaigns table
  const pastCollabs = allCampaigns.filter(
    (c) => c.creators.includes(creator.id) && c.status === 'Completed',
  );
  const activeCollabs = allCampaigns.filter(
    (c) => c.creators.includes(creator.id) && (c.status === 'Live'),
  );

  return (
    <>
      <Topbar
        title={creator.name}
        crumb={`Discover → ${creator.handle} · profile`}
        actions={
          <>
            <button className="v2-btn v2-btn-outline" type="button" onClick={() => onRoute('discover')}>
              {Icon.arrow}<span style={{ marginLeft: 4 }}>Back to Discover</span>
            </button>
            {(() => {
              const isSaved = savedIds.includes(creator.id);
              return (
                <button
                  className="v2-btn v2-btn-outline"
                  type="button"
                  onClick={() => v2ToggleSavedCreator(creator.id)}
                  aria-pressed={isSaved}
                >
                  {isSaved ? Icon.check : Icon.plus}
                  <span>{isSaved ? 'Saved to shortlist' : 'Save to shortlist'}</span>
                </button>
              );
            })()}
            <button className="v2-btn v2-btn-primary" type="button" onClick={() => onRoute('spark')}>
              {Icon.send}<span>Send brief</span>
            </button>
          </>
        }
      />
      <div className="v2-content">
        {/* Hero */}
        <section className="v2-card" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div
            className="v2-storefront-cover"
            style={{
              backgroundImage: `url(${creator.cover})`,
              height: 200,
              borderRadius: 0,
              marginBottom: 0,
            }}
          />
          <div className="v2-storefront-identity" style={{ padding: '0 28px 28px' }}>
            <div
              className="v2-avatar v2-avatar-xl v2-storefront-avatar"
              style={{ backgroundImage: `url(${creator.avatar})` }}
              aria-label={creator.name}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-row" style={{ gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <h2 style={{
                  fontFamily: 'var(--v2-font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  color: 'var(--v2-ink)',
                }}>
                  {creator.name}
                </h2>
                {creator.verified && (
                  <span className="v2-pill v2-pill-moss" style={{ fontSize: 11 }}>
                    {Icon.check} Verified
                  </span>
                )}
                <ScoreBadge score={creator.score} />
              </div>
              <div className="v2-muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
                @{creator.handle} · {creator.city} · {creator.priceTier} tier
              </div>
              <p style={{ margin: 0, color: 'var(--v2-ink-2)', fontSize: 14, lineHeight: 1.55, maxWidth: 640 }}>
                {creator.bio}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {creator.categories.map((cat) => (
                  <span key={cat} className="v2-pill v2-pill-accent">{cat}</span>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div
            className="v2-row"
            style={{
              borderTop: '1px solid var(--v2-line)',
              padding: '18px 28px',
              gap: 32,
              flexWrap: 'wrap',
              background: 'var(--v2-bg-1)',
            }}
          >
            <KpiInline label="Total reach" value={fmtFollowers(totalFollowers)} sub="across all channels" />
            <KpiInline label="Avg engagement" value={`${avgEngagement}%`} sub="last 30 days" />
            <KpiInline label="Response time" value={responseTimeCopy} sub="message threads" />
            <KpiInline label="Going rate" value={fmtUSD(creator.rate)} sub="per Reel + Stories" />
            <KpiInline label="Past brands" value={String(creator.pastBrands.length + pastCollabs.length)} sub={creator.pastBrands.slice(0, 2).join(', ')} />
          </div>
        </section>

        {/* 2-column: channels + audience */}
        <div className="v2-row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
          <section className="v2-card v2-card-pad" style={{ flex: '2 1 480px' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Channels</div>
            <div className="v2-storefront-channels">
              {creator.channels.map((ch) => {
                const meta = PLATFORM_META[ch.platform];
                return (
                  <div key={ch.platform} className="v2-storefront-channel">
                    <div
                      className="v2-channel-icon"
                      style={{ background: meta.color, width: 40, height: 40, borderRadius: 10 }}
                    >{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.name}</div>
                      <div className="v2-muted" style={{ fontSize: 12.5 }}>{ch.handle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.014em' }}>
                        {fmtFollowers(ch.followers)}
                      </div>
                      <div className="v2-muted" style={{ fontSize: 11.5 }}>
                        {ch.engagement}% ER
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="v2-card v2-card-pad" style={{ flex: '1 1 280px' }}>
            <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Audience snapshot</div>
            <div className="v2-storefront-audience">
              <AudienceBar label="Female" value={`${creator.audience.female}%`} bar={creator.audience.female} />
              <AudienceBar label="Male" value={`${creator.audience.male}%`} bar={creator.audience.male} />
              <AudienceBar label="25–34 age band" value={`${creator.audience.age2534}%`} bar={creator.audience.age2534} />
              {creator.audience.age1824 != null && (
                <AudienceBar label="18–24 age band" value={`${creator.audience.age1824}%`} bar={creator.audience.age1824} />
              )}
              <div className="v2-storefront-audience-stat">
                <div className="v2-row" style={{ justifyContent: 'space-between' }}>
                  <span className="v2-muted" style={{ fontSize: 12.5 }}>Top city</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{creator.audience.topCity}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Packages */}
        <section className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
          <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-end' }}>
            <div>
              <div className="v2-eyebrow">Packages & rates</div>
              <p className="v2-muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                Send a brief or message to negotiate. Rates are USD.
              </p>
            </div>
            <button className="v2-btn v2-btn-sm v2-btn-outline" type="button" onClick={() => onRoute('inbox')}>
              {Icon.send} Send brief
            </button>
          </div>
          <div className="v2-storefront-packages">
            <PackageCard title="Instagram Reel" sub="60–90s vertical · 1 round of revisions" price={creator.priceMin} turnaround="3–5 days" />
            <PackageCard title="Story bundle (×3)" sub="3 stories with link sticker" price={Math.round(creator.priceMin * 0.8)} turnaround="2 days" />
            <PackageCard title="Reel + Stories combo" sub="1 Reel + 3 Stories · most booked" price={creator.rate} turnaround="5 days" highlight />
            <PackageCard title="Long-form review" sub="3-min YouTube short · scripted" price={creator.priceMax} turnaround="7–10 days" />
          </div>
        </section>

        {/* Active + past collabs */}
        <section className="v2-card v2-card-pad" style={{ marginBottom: 24 }}>
          <div className="v2-eyebrow" style={{ marginBottom: 14 }}>Track record</div>
          {activeCollabs.length > 0 && (
            <>
              <div className="v2-muted" style={{ fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Working with right now
              </div>
              <div className="v2-storefront-projects" style={{ marginBottom: 18 }}>
                {activeCollabs.map((c) => (
                  <div key={c.id} className="v2-storefront-project">
                    <span className={`v2-pill ${c.status === 'Live' ? 'v2-pill-live' : 'v2-pill-moss'}`} style={{ marginBottom: 8 }}>
                      {c.status}
                    </span>
                    <div style={{ fontFamily: 'var(--v2-font-display)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.014em' }}>
                      {c.name}
                    </div>
                    <div className="v2-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {c.brand} · {c.placement}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="v2-muted" style={{ fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Past brands
          </div>
          <div className="v2-storefront-collabs" style={{ marginBottom: 16 }}>
            {creator.pastBrands.map((b) => (
              <div key={b} className="v2-storefront-brand-mark">{b}</div>
            ))}
          </div>

          {pastCollabs.length > 0 && (
            <>
              <div className="v2-muted" style={{ fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Recent completed projects
              </div>
              <div className="v2-storefront-projects">
                {pastCollabs.slice(0, 3).map((c) => (
                  <div key={c.id} className="v2-storefront-project">
                    <div className="v2-eyebrow" style={{ marginBottom: 4 }}>{c.brand}</div>
                    <div style={{ fontFamily: 'var(--v2-font-display)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.014em' }}>
                      {c.name}
                    </div>
                    <div className="v2-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {c.placement} · {fmtUSD(c.paid)} cleared
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Sticky bottom action band */}
        <section
          className="v2-card v2-card-pad"
          style={{
            background: 'linear-gradient(135deg, var(--v2-accent-soft), var(--v2-paper))',
            borderColor: 'var(--v2-accent-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.014em',
              color: 'var(--v2-ink)',
              marginBottom: 4,
            }}>
              Ready to work with {creator.name.split(' ')[0]}?
            </div>
            <div className="v2-muted" style={{ fontSize: 13 }}>
              Spark drafts the brief for you and routes it through Inbox. {creator.name.split(' ')[0]} typically replies within 3 hours.
            </div>
          </div>
          <div className="v2-row" style={{ gap: 10 }}>
            <button className="v2-btn v2-btn-outline" type="button" onClick={() => onRoute('inbox')}>
              {Icon.inbox} Open inbox
            </button>
            <button className="v2-btn v2-btn-primary" type="button" onClick={() => onRoute('spark')}>
              {Icon.spark} Draft a brief with Spark
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function KpiInline({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="v2-stat-label" style={{ fontSize: 11 }}>{label}</div>
      <div className="v2-stat-value v2-tabular" style={{ fontSize: 22 }}>{value}</div>
      {sub && <div className="v2-stat-sub" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  );
}

function AudienceBar({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div className="v2-storefront-audience-stat">
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="v2-muted" style={{ fontSize: 12.5 }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
      </div>
      <div className="v2-progress">
        <div className="v2-progress-fill" style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}

function PackageCard({
  title, sub, price, turnaround, highlight,
}: {
  title: string;
  sub: string;
  price: number;
  turnaround: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="v2-storefront-package"
      style={highlight ? { borderColor: 'var(--v2-accent)', background: 'var(--v2-accent-soft)' } : undefined}
    >
      <div className="v2-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {highlight && <span className="v2-pill v2-pill-accent" style={{ fontSize: 10 }}>Most booked</span>}
      </div>
      <div className="v2-muted" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.45 }}>{sub}</div>
      <div className="v2-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{
            fontFamily: 'var(--v2-font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.022em',
            color: 'var(--v2-accent)',
          }}>
            {fmtUSD(price)}
          </div>
          <div className="v2-muted" style={{ fontSize: 11 }}>per piece</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="v2-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Turnaround
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{turnaround}</div>
        </div>
      </div>
    </div>
  );
}
