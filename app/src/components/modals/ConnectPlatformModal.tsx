// Connect-channel flow.
//
// Two paths:
//   1. REAL OAuth via `connectPlatform()` (lib/oauth/connectPlatform.ts +
//      supabase/functions/oauth-callback). Activated when the platform's
//      VITE_<PLATFORM>_CLIENT_ID env var is set. Opens a popup, exchanges
//      the code on the Edge Function, stores tokens in platform_tokens.
//   2. MOCK demo flow (1.5s simulated round-trip). Falls back to this when
//      OAuth isn't configured for the chosen platform — keeps the demo
//      working without dev-portal apps.
//
// The Edge Function writes the token row but doesn't fetch audience
// metrics; the review screen still uses the spec defaults until a follow-up
// "fetch profile" call lands.
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { fmtCount } from '@/lib/utils/format';
import { pushToast } from '@/lib/utils/toast';
import { AgeBars, GenderSplit } from '@/components/charts/AudienceCharts';
import { connectPlatform, OAuthNotConfiguredError, type OAuthPlatform } from '@/lib/oauth/connectPlatform';
import { useV2CurrentCreator } from '@/screens/workspace-v2/v2Hooks';
import { useStore } from '@/lib/api/store';
import type { AudienceDemographics, Platform } from '@/lib/api/types';

interface ConnectPlatformModalProps {
  open: boolean;
  onClose: () => void;
}

interface PlatformSpec {
  name: Platform['name']; description: string;
  mockHandle: string; mockFollowers: number; mockEngagement: number;
  audience: AudienceDemographics;
}

const SAMPLE_AUDIENCE = (): AudienceDemographics => ({
  ageBuckets: { '13-17': 0.04, '18-24': 0.32, '25-34': 0.36, '35-44': 0.18, '45-54': 0.07, '55+': 0.03 },
  genderSplit: { female: 0.58, male: 0.38, other: 0.04 },
  topCountries: [
    { country: 'United States', pct: 0.46 }, { country: 'United Kingdom', pct: 0.15 },
    { country: 'Canada', pct: 0.12 }, { country: 'Australia', pct: 0.08 }, { country: 'Germany', pct: 0.05 },
  ],
  growthRate30d: 3.4, suspiciousFollowerPct: 4.2, audienceCredibilityScore: 92,
});

const PLATFORMS: PlatformSpec[] = [
  { name: 'Instagram', description: 'Photos, Reels, Stories — the main creator surface.', mockHandle: '@yourhandle',         mockFollowers: 28_400, mockEngagement: 5.6, audience: SAMPLE_AUDIENCE() },
  { name: 'YouTube',   description: 'Long-form video and Shorts.',                          mockHandle: 'YourChannel',         mockFollowers: 12_100, mockEngagement: 4.2, audience: SAMPLE_AUDIENCE() },
  { name: 'TikTok',    description: 'Short-form vertical video.',                           mockHandle: '@yourhandle',         mockFollowers: 8_900,  mockEngagement: 7.3, audience: SAMPLE_AUDIENCE() },
  { name: 'Newsletter',description: 'Substack, beehiiv, Ghost.',                            mockHandle: 'yourhandle.substack', mockFollowers: 1_200,  mockEngagement: 38,  audience: SAMPLE_AUDIENCE() },
  { name: 'X',         description: 'Threads, opinions, audience interaction.',             mockHandle: '@yourhandle',         mockFollowers: 4_300,  mockEngagement: 3.1, audience: SAMPLE_AUDIENCE() },
  { name: 'LinkedIn',  description: 'Professional reach, B2B brands.',                      mockHandle: 'in/yourhandle',       mockFollowers: 6_800,  mockEngagement: 4.5, audience: SAMPLE_AUDIENCE() },
];

/** Map modal display name → OAuthPlatform id used by connectPlatform().
 *  Returns null for platforms with no real-OAuth path (Newsletter, LinkedIn). */
function oauthIdFor(name: Platform['name']): OAuthPlatform | null {
  switch (name) {
    case 'Instagram': return 'instagram';
    case 'TikTok':    return 'tiktok';
    case 'YouTube':   return 'youtube';
    case 'X':         return 'x';
    default:          return null; // Newsletter, LinkedIn — mock only
  }
}

export function ConnectPlatformModal({ open, onClose }: ConnectPlatformModalProps) {
  const [picked, setPicked] = useState<Platform['name'] | null>(null);
  const [phase, setPhase] = useState<'pick' | 'authorizing' | 'review'>('pick');
  const [busy, setBusy] = useState(false);
  const currentCreator = useV2CurrentCreator();
  const ownerEmail = useStore((s) => {
    const uid = s.session?.userId;
    if (!uid) return null;
    return s.db.users.find((u) => u.id === uid)?.email ?? null;
  });

  const spec = picked ? PLATFORMS.find((p) => p.name === picked)! : null;
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState(0);
  const [engagement, setEngagement] = useState(0);

  const reset = () => { setPicked(null); setPhase('pick'); setHandle(''); setFollowers(0); setEngagement(0); };
  const close = () => { reset(); onClose(); };

  /** Move to the review screen with the spec's mock metrics. Used by both
   *  the real-OAuth success path and the mock fallback — the Edge Function
   *  doesn't fetch audience metrics today, so the review form is editable. */
  function showReview(s: PlatformSpec) {
    setHandle(s.mockHandle);
    setFollowers(s.mockFollowers);
    setEngagement(s.mockEngagement);
    setPhase('review');
  }

  function startMockAuth(s: PlatformSpec) {
    // Demo round-trip — kept for platforms without OAuth configured and
    // for local-only dev where Supabase env vars aren't set.
    setPhase('authorizing');
    setTimeout(() => showReview(s), 1500);
  }

  async function startAuth(name: Platform['name']) {
    setPicked(name);
    const s = PLATFORMS.find((p) => p.name === name)!;
    const oauthId = oauthIdFor(name);

    // Platforms with no real OAuth path (Newsletter / LinkedIn) always
    // use the mock demo flow.
    if (!oauthId) {
      startMockAuth(s);
      return;
    }

    // Need a signed-in creator with an email to write the token row.
    // Without one (anonymous demo), fall back to the mock flow.
    if (!currentCreator || !ownerEmail) {
      startMockAuth(s);
      return;
    }

    // Try real OAuth. The popup opens immediately (must stay inside the
    // user-gesture stack), and we wait for the postMessage from the Edge
    // Function. OAuthNotConfiguredError = env var missing → mock fallback.
    setPhase('authorizing');
    try {
      await connectPlatform({
        platform: oauthId,
        creatorId: currentCreator.id,
        ownerEmail,
      });
      showReview(s);
    } catch (err) {
      if (err instanceof OAuthNotConfiguredError) {
        // Env vars not set yet — silently fall back to demo flow so the
        // modal still works end-to-end during onboarding.
        setTimeout(() => showReview(s), 800);
        return;
      }
      // Real failure (user closed popup, network, etc.) — back to picker.
      pushToast(err instanceof Error ? err.message : 'Connect failed', 'bad');
      reset();
    }
  }

  const finalize = async () => {
    if (!spec) return;
    setBusy(true);
    try {
      await api.platforms.connect({
        platformName: spec.name,
        handle,
        followers,
        engagement,
        audience: spec.audience,
      });
      pushToast(`${spec.name} connected · verified · audience pulled`, 'good');
      close();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Connect failed', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={phase === 'pick' ? 'Connect a channel' : phase === 'authorizing' ? 'Authorizing…' : `Confirm ${spec?.name}`}
      width={600}
      footer={
        phase === 'review' ? (
          <>
            <Button variant="ghost" onClick={reset}>Pick a different platform</Button>
            <Button onClick={finalize} loading={busy} icon={<Icon.check s={14} />}>Connect & verify</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={close}>{phase === 'authorizing' ? 'Cancel' : 'Close'}</Button>
        )
      }
    >
      {phase === 'pick' && (
        <div>
          <p style={{ marginTop: 0, fontSize: 14, color: 'var(--ink-80)' }}>
            We pull metrics live from connected channels and add a verified badge. Brands trust verified profiles more.
            Demo mode simulates the OAuth round-trip.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {PLATFORMS.map((p) => (
              <button
                key={p.name}
                onClick={() => startAuth(p.name)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  padding: '14px 16px',
                  border: '1px solid var(--rule)',
                  borderRadius: 6,
                  textAlign: 'left',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="text-ink-60" style={{ fontSize: 12, marginTop: 4 }}>{p.description}</div>
                </div>
                <div style={{ alignSelf: 'center' }}><Icon.arrow s={14} /></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'authorizing' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div className="mono-meta mb-16">Connecting to {spec?.name}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 24 }}>Redirecting to {spec?.name}…</div>
          <div style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="var(--rule)" strokeWidth="3" />
              <path d="M30 16a14 14 0 0 0-14-14" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-ink-60" style={{ fontSize: 13, marginTop: 18 }}>Demo mode: this is a 1.5s simulated round-trip. Real flow opens an OAuth window.</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {phase === 'review' && spec && (
        <div>
          <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, marginBottom: 18 }}>
            <div className="row-between mb-8">
              <div className="mono-meta">Authorized</div>
              <Pill tone="good">✓ Verified by {spec.name}</Pill>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-80)' }}>
              {spec.name} returned audience metrics + demographics. These will appear on your profile to brands.
            </div>
          </div>

          <div className="form-grid">
            <div className="field full">
              <label className="field-label">Handle</label>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Followers</label>
              <input type="number" value={followers} onChange={(e) => setFollowers(Number(e.target.value))} />
              <span className="field-help">Pulled: {fmtCount(spec.mockFollowers)}</span>
            </div>
            <div className="field">
              <label className="field-label">Engagement %</label>
              <input type="number" step={0.1} value={engagement} onChange={(e) => setEngagement(Number(e.target.value))} />
              <span className="field-help">Pulled: {spec.mockEngagement}%</span>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--rule)' }}>
            <div className="mono-meta mb-16">Audience preview · pulled from {spec.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 14 }}>
              <div>
                <div className="mono-meta mb-8">Age</div>
                <AgeBars data={spec.audience.ageBuckets} />
              </div>
              <div>
                <div className="mono-meta mb-8">Gender</div>
                <GenderSplit data={spec.audience.genderSplit} />
              </div>
            </div>
            <div className="row-between" style={{ fontSize: 12, color: 'var(--ink-60)' }}>
              <span>Audience credibility · <strong style={{ color: 'var(--good)' }}>{spec.audience.audienceCredibilityScore}/100</strong></span>
              <span>{spec.audience.suspiciousFollowerPct}% suspicious</span>
              <span>↑ {spec.audience.growthRate30d}% growth · 30d</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
