// Public creator profile, viewed from the brand side.
// Slides in from the right, no path change. Shows everything a brand needs to vet a creator.
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { api, select } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { MessageComposeModal } from '@/components/modals/MessageComposeModal';
import { AgeBars, GenderSplit, GeoList, CredibilityBadge } from '@/components/charts/AudienceCharts';
import { TrustBadge, TrustMetricsCard } from '@/components/ui/TrustBadge';
import { trustForCreator } from '@/lib/utils/trust';
import { fmtCount, fmtRelative } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import type { Creator } from '@/lib/api/types';

interface ProfileDrawerProps {
  creator: Creator;
  onClose: () => void;
  onSendOffer?: (creatorId: string) => void;
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span style={{ letterSpacing: '0.04em', color: 'var(--accent)' }}>
      {Array.from({ length: 5 }).map((_, i) => (i < full ? '★' : '☆')).join('')}
    </span>
  );
}

export function CreatorProfileDrawer({ creator, onClose, onSendOffer }: ProfileDrawerProps) {
  const db = useStore((s) => s.db);
  const { brand } = useAuth();
  const [busy, setBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const reviews = select.reviewsForCreator(db, creator.id);
  const isSaved = brand?.savedCreators.includes(creator.id) ?? false;
  const creatorUser = db.users.find((u) => u.id === creator.userId);
  const trust = trustForCreator(db, creator);

  const toggleSave = async () => {
    setBusy(true);
    try {
      const nowSaved = await api.brand.toggleSavedCreator(creator.id);
      pushToast(nowSaved ? `Saved ${creator.name} to your shortlist` : `Removed ${creator.name}`, 'good');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Action failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  // Phase 17.5 QA — Escape closes the drawer + body scroll lock match Modal pattern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="drawer-back" onClick={onClose}>
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${creator.name} profile`}
      >
        <div className="drawer-h">
          <div>
            <div className="mono-meta">{creator.tier} · {creator.city}, {creator.country}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, marginTop: 4 }}>{creator.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn-ghost"><Icon.x /></button>
        </div>

        <div className="drawer-body">
          {/* Hero */}
          <div className="cmp-hero" style={{ gridTemplateColumns: '180px 1fr', alignItems: 'flex-start' }}>
            <img src={creator.portrait} alt={creator.name} style={{ width: 180, height: 220, objectFit: 'cover', borderRadius: 6 }} />
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                <TrustBadge snapshot={trust} />
                {creator.verified && <Pill tone="good">✓ Verified</Pill>}
                <Pill>{creator.tier}</Pill>
                {creator.availability && (
                  <Pill tone={creator.availability.status === 'open' ? 'good' : creator.availability.status === 'limited' ? 'warn' : 'bad'}>
                    {creator.availability.status === 'open' ? 'Open for work' : creator.availability.status === 'limited' ? 'Limited' : 'Booked'}
                  </Pill>
                )}
                {creator.categories.map((c) => <Pill key={c}>{c}</Pill>)}
              </div>
              {creator.availability?.note && (
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontStyle: 'italic', marginBottom: 8 }}>{creator.availability.note}</div>
              )}
              <div className="cmp-hero-h" style={{ fontSize: 24 }}>{creator.tagline}</div>
              <div className="text-ink-80" style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{creator.bio}</div>
              <div style={{ marginTop: 12 }}>
                <a
                  href={`/c/${creator.handle.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-meta"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: 'var(--accent)', textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  View public storefront <Icon.arrow s={12} />
                </a>
              </div>
              <div className="cmp-hero-meta">
                <div>{creator.handle}</div>
                <div>Languages · {creator.languages.join(', ') || '—'}</div>
                <div>Reply · {creator.responseHrs}h</div>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="kpi-strip mb-24" style={{ borderTop: '1px solid var(--rule)' }}>
            <div><div className="kpi-k">Total reach</div><div className="kpi-v">{fmtCount(creator.reach)}</div></div>
            <div><div className="kpi-k">Engagement</div><div className="kpi-v">{creator.engagement}<span className="u">%</span></div></div>
            <div><div className="kpi-k">Rating</div><div className="kpi-v">{creator.rating || '—'}</div><div className="kpi-d">{reviews.length} review{reviews.length === 1 ? '' : 's'}</div></div>
            <div><div className="kpi-k">Lifetime</div><div className="kpi-v">${(creator.lifetimeEarnings / 1000).toFixed(0)}<span className="u">k</span></div></div>
          </div>

          {/* Trust score metrics */}
          <div className="mb-24">
            <div className="mono-meta mb-8">Trust signals</div>
            <TrustMetricsCard snapshot={trust} role="creator" />
          </div>

          {/* Audience demographics — pulled from primary platform if available */}
          {(() => {
            const primary = creator.platforms.find((p) => p.audience) || creator.platforms[0];
            if (!primary || !primary.audience) return null;
            const a = primary.audience;
            return (
              <div style={{ marginBottom: 24, padding: '18px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
                <div className="row-between mb-16">
                  <div className="mono-meta">Audience · {primary.name} · {fmtCount(primary.followers)} followers</div>
                  <div className={['mono-meta', a.growthRate30d >= 0 ? 'text-good' : 'text-bad'].join(' ')}>
                    {a.growthRate30d >= 0 ? '↑' : '↓'} {Math.abs(a.growthRate30d)}% · 30d
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 18 }}>
                  <div>
                    <div className="mono-meta mb-8">Age</div>
                    <AgeBars data={a.ageBuckets} />
                  </div>
                  <div>
                    <CredibilityBadge score={a.audienceCredibilityScore} suspicious={a.suspiciousFollowerPct} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div className="mono-meta mb-8">Gender</div>
                    <GenderSplit data={a.genderSplit} />
                  </div>
                  <div>
                    <div className="mono-meta mb-8">Top countries</div>
                    <GeoList data={a.topCountries} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Platforms */}
          <div className="mono-meta mb-8">Platforms</div>
          <table className="tbl mb-24">
            <thead><tr><th>Platform</th><th>Handle</th><th style={{ textAlign: 'right' }}>Followers</th><th style={{ textAlign: 'right' }}>Engagement</th><th>Status</th></tr></thead>
            <tbody>
              {creator.platforms.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-60)' }}>No platforms connected.</td></tr>
              ) : creator.platforms.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="mono-meta">{p.handle}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtCount(p.followers)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{p.engagement}%</td>
                  <td><Pill tone={p.verified ? 'good' : 'warn'}>{p.verified ? 'Verified' : 'Self-reported'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Portfolio */}
          {creator.work.length > 0 && (
            <>
              <div className="mono-meta mb-8">Recent work</div>
              <div className="approval-files mb-24">
                {creator.work.map((w, i) => (
                  <div key={i} className="approval-file" style={{ backgroundImage: `url(${w})` }}>
                    <span className="approval-file-name">0{i + 1}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Rate card */}
          <div className="mono-meta mb-8">Rate card</div>
          {creator.rateCards && creator.rateCards.length > 0 ? (
            <table className="tbl mb-24">
              <thead><tr><th>Platform</th><th>Format</th><th>Rate (USD)</th><th>Notes</th></tr></thead>
              <tbody>
                {creator.rateCards.map((r) => (
                  <tr key={r.id}>
                    <td>{r.platform}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.format === 'longform' ? 'Long-form' : r.format}</td>
                    <td className="mono-meta">{r.rate || '—'}</td>
                    <td className="text-ink-60" style={{ fontSize: 12 }}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl mb-24">
              <thead><tr><th>Format</th><th>Range (USD)</th></tr></thead>
              <tbody>
                <tr><td>Post</td><td className="mono-meta">{creator.rateCard.post}</td></tr>
                <tr><td>Reel</td><td className="mono-meta">{creator.rateCard.reel}</td></tr>
                <tr><td>Story</td><td className="mono-meta">{creator.rateCard.story}</td></tr>
                <tr><td>Long-form / YouTube</td><td className="mono-meta">{creator.rateCard.longform}</td></tr>
              </tbody>
            </table>
          )}

          {/* Past clients */}
          {creator.pastClients.length > 0 && (
            <>
              <div className="mono-meta mb-8">Past clients</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {creator.pastClients.map((c) => <Pill key={c}>{c}</Pill>)}
              </div>
            </>
          )}

          {/* Press */}
          {creator.pressMentions.length > 0 && (
            <>
              <div className="mono-meta mb-8">Press</div>
              <div style={{ marginBottom: 24 }}>
                {creator.pressMentions.map((p, i) => (
                  <div key={i} className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--rule)' }}>
                    <div><strong>{p.source}</strong> · {p.title}</div>
                    <div className="mono-meta">{p.year}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Reviews */}
          <div className="mono-meta mb-8">Reviews from brands</div>
          {reviews.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-60)' }}>No reviews yet — this creator's first campaign on Alamut is in progress.</div>
          ) : (
            <div>
              {reviews.slice(0, 6).map((r) => {
                const rb = db.brands.find((b) => b.id === db.users.find((u) => u.id === r.fromUserId)?.brandId);
                const cmp = db.campaigns.find((c) => c.id === r.campaignId);
                return (
                  <div key={r.id} style={{ borderTop: '1px solid var(--rule)', padding: '14px 0' }}>
                    <div className="row-between mb-8">
                      <div>
                        <div style={{ fontWeight: 500 }}>{rb?.name || 'Brand'}</div>
                        <div className="mono-meta">{cmp?.title} · {fmtRelative(r.at)}</div>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-80)', lineHeight: 1.55 }}>{r.text}</div>
                    {r.response && (
                      <div style={{ marginTop: 10, marginLeft: 14, paddingLeft: 14, borderLeft: '2px solid var(--rule)' }}>
                        <div className="mono-meta mb-8">{creator.name}'s reply · {fmtRelative(r.response.at)}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-80)', lineHeight: 1.55 }}>{r.response.text}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <Button variant={isSaved ? 'plain' : 'ghost'} onClick={toggleSave} loading={busy}>
            {isSaved ? '✓ Saved to shortlist' : '+ Save to shortlist'}
          </Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="ghost" onClick={() => setMessageOpen(true)} icon={<Icon.inbox s={14} />}>
              Message
            </Button>
            {onSendOffer && (
              <Button onClick={() => { onSendOffer(creator.id); onClose(); }} icon={<Icon.arrow s={14} />}>
                Send offer
              </Button>
            )}
          </div>
        </div>
      </div>

      {creatorUser && (
        <MessageComposeModal
          open={messageOpen}
          onClose={() => setMessageOpen(false)}
          toUserId={creatorUser.id}
          toName={creator.name}
          toPortrait={creator.portrait}
          goToInboxOnSend
        />
      )}
    </div>
  );
}
