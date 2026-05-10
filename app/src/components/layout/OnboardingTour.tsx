// First-sign-in tour — Phase 15 polish.
//
// Per-role 4-step carousel. Shown once per (user, role) pair. Each step
// gets a chromatic stage hue + an inline visual to anchor the copy.
// Step indicators are dots with a sliding active indicator instead of
// flat bars.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface Step {
  num: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  /** Per-step chromatic accent for the visual bar. */
  hue: string;
  /** Visual key — drives the inline figure variant. */
  visual: 'wave' | 'discover' | 'lifecycle' | 'wallet' | 'brief' | 'shortlist' | 'roas';
}

const TOUR_BY_ROLE: Record<'creator' | 'brand', Step[]> = {
  creator: [
    {
      num: 'C · 01',
      title: 'Welcome to Alamut.',
      body: "You're a creator on a marketplace where serious brands brief, book, and pay through escrow. No agency, no chasing invoices. The next 60 seconds shows you how it works.",
      ctaLabel: 'Continue', ctaHref: '#',
      hue: 'oklch(0.55 0.13 145)', visual: 'wave',
    },
    {
      num: 'C · 02',
      title: 'Apply to live campaigns.',
      body: 'Discover lists every active brief. Click Apply, write a 2-line pitch, propose your rate. Brands review and shortlist within hours, not weeks.',
      ctaLabel: 'Browse Discover', ctaHref: '/creator/discover',
      hue: 'oklch(0.60 0.13 60)', visual: 'discover',
    },
    {
      num: 'C · 03',
      title: 'Drafts, revisions, and approvals.',
      body: 'Once shortlisted, you negotiate via offer (Accept · Counter · Decline). When you accept, escrow holds the rate. Upload drafts, get feedback, ship.',
      ctaLabel: 'See My Campaigns', ctaHref: '/creator/campaigns',
      hue: 'oklch(0.60 0.16 30)', visual: 'lifecycle',
    },
    {
      num: 'C · 04',
      title: 'Get paid on schedule.',
      body: 'When the brand approves, escrow releases to your wallet. Withdraw to bank or Wise. Earnings tracks every payout, generates invoices, and shows your YTD for taxes.',
      ctaLabel: 'See Earnings', ctaHref: '/creator/earnings',
      hue: 'oklch(0.55 0.12 220)', visual: 'wallet',
    },
  ],
  brand: [
    {
      num: 'B · 01',
      title: 'Welcome to Alamut.',
      body: "You're running creator campaigns end-to-end without the agency markup. Brief, shortlist, pay — all in one workspace. The next 60 seconds shows you how.",
      ctaLabel: 'Continue', ctaHref: '#',
      hue: 'oklch(0.55 0.13 145)', visual: 'wave',
    },
    {
      num: 'B · 02',
      title: 'Brief in five minutes.',
      body: 'Click New campaign. The AI brief assistant turns plain English into a structured brief. Set budget, content rights, and publish — creators apply within the hour.',
      ctaLabel: 'Start a campaign', ctaHref: '/brand/campaigns?new=1',
      hue: 'oklch(0.60 0.16 60)', visual: 'brief',
    },
    {
      num: 'B · 03',
      title: 'Shortlist, offer, approve.',
      body: "Review applications, send offers from a creator's profile, approve drafts in two clicks. Escrow holds the moment an offer is accepted, releases when you approve the post.",
      ctaLabel: 'Find creators', ctaHref: '/brand/discover',
      hue: 'oklch(0.60 0.16 30)', visual: 'shortlist',
    },
    {
      num: 'B · 04',
      title: 'Track ROAS, not just reach.',
      body: 'Every accepted creator gets a UTM tracking link. The campaign drawer shows clicks, conversions, revenue, and ROAS per creator. Boost the best posts as paid ads.',
      ctaLabel: 'See your wallet', ctaHref: '/brand/wallet',
      hue: 'oklch(0.55 0.10 320)', visual: 'roas',
    },
  ],
};

export function OnboardingTour() {
  const { user, isCreator, isBrand } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const role = isCreator ? 'creator' : isBrand ? 'brand' : null;
    if (!role) return;
    const key = `alamut.tour.${user.id}.${role}.done`;
    if (localStorage.getItem(key)) return;
    setStep(0);
    setOpen(true);
  }, [user, isCreator, isBrand]);

  if (!user) return null;
  const role = isCreator ? 'creator' : isBrand ? 'brand' : null;
  if (!role) return null;
  const steps = TOUR_BY_ROLE[role];
  const s = steps[step];
  const isLast = step === steps.length - 1;

  const dismiss = () => {
    localStorage.setItem(`alamut.tour.${user.id}.${role}.done`, '1');
    setOpen(false);
  };

  const next = () => {
    if (isLast) dismiss();
    else setStep((i) => i + 1);
  };

  const goCta = () => {
    if (s.ctaHref !== '#') {
      navigate(s.ctaHref);
      dismiss();
    } else {
      next();
    }
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      blockBackdropDismiss
      title={`Quick tour · ${role === 'creator' ? 'Creator' : 'Brand'} workspace`}
      width={560}
      footer={<>
        <Button variant="ghost" onClick={dismiss}>Skip tour</Button>
        {step > 0 && <Button variant="ghost" onClick={() => setStep((i) => i - 1)}>Back</Button>}
        {s.ctaHref !== '#' && (
          <Button variant="ghost" onClick={goCta} icon={<Icon.arrow s={12} />}>{s.ctaLabel}</Button>
        )}
        <Button onClick={next} icon={isLast ? <Icon.check s={14} /> : <Icon.arrow s={14} />}>
          {isLast ? 'Got it' : 'Next'}
        </Button>
      </>}
    >
      <div className="onb-tour" style={{ ['--step-hue' as string]: s.hue }}>
        <div className="onb-tour-visual">
          <TourVisual kind={s.visual} />
        </div>
        <div className="onb-tour-eyebrow mono-meta">
          <span className="onb-tour-eyebrow-dot" aria-hidden="true" />
          {s.num} · Step {step + 1} of {steps.length}
        </div>
        <h2 className="onb-tour-title">{s.title}</h2>
        <p className="onb-tour-body">{s.body}</p>

        {/* Step indicator — dots with sliding active marker */}
        <ol className="onb-tour-dots" role="list">
          {steps.map((_, i) => (
            <li
              key={i}
              className={['onb-tour-dot', i < step ? 'is-done' : i === step ? 'is-current' : ''].join(' ')}
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </ol>
      </div>
    </Modal>
  );
}

// ---- Per-step inline SVG visuals ----
// Lightweight, OKLCH-driven figures — no external SVG assets.

function TourVisual({ kind }: { kind: Step['visual'] }) {
  switch (kind) {
    case 'wave':       return <WaveVisual />;
    case 'discover':   return <DiscoverVisual />;
    case 'lifecycle':  return <LifecycleVisual />;
    case 'wallet':     return <WalletVisual />;
    case 'brief':      return <BriefVisual />;
    case 'shortlist':  return <ShortlistVisual />;
    case 'roas':       return <RoasVisual />;
  }
}

function WaveVisual() {
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      <defs>
        <linearGradient id="onb-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--step-hue)" stopOpacity={0.14} />
          <stop offset="50%" stopColor="var(--step-hue)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--step-hue)" stopOpacity={0.14} />
        </linearGradient>
      </defs>
      <path
        d="M0 50 C 60 20, 120 80, 180 40 C 240 0, 280 60, 320 40"
        fill="none"
        stroke="url(#onb-wave)"
        strokeWidth={2}
      />
      <circle cx={28} cy={42} r={4} fill="var(--step-hue)" />
      <circle cx={160} cy={50} r={5} fill="var(--step-hue)" opacity={0.7} />
      <circle cx={290} cy={42} r={4} fill="var(--step-hue)" />
    </svg>
  );
}

function DiscoverVisual() {
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${10 + i * 78}, 14)`} opacity={i === 1 ? 1 : 0.55}>
          <rect width={64} height={52} rx={4} fill="var(--surface)" stroke="var(--rule)" />
          <rect x={6} y={6} width={36} height={4} rx={2} fill="var(--ink-40)" />
          <rect x={6} y={14} width={52} height={3} rx={1.5} fill="var(--ink-40)" opacity={0.5} />
          <rect x={6} y={36} width={20} height={10} rx={2} fill={i === 1 ? 'var(--step-hue)' : 'var(--rule)'} />
        </g>
      ))}
    </svg>
  );
}

function LifecycleVisual() {
  const stages = ['draft', 'live', 'shortlist', 'offer', 'production', 'posted', 'reporting', 'closed'];
  return (
    <svg viewBox="0 0 320 60" className="onb-tour-svg" aria-hidden="true">
      <line x1={20} y1={30} x2={300} y2={30} stroke="var(--rule)" strokeWidth={1} strokeDasharray="2 4" />
      {stages.map((_, i) => {
        const x = 20 + (i * (280 / (stages.length - 1)));
        const isCurrent = i === 4; // production
        const isDone = i < 4;
        return (
          <circle
            key={i}
            cx={x} cy={30}
            r={isCurrent ? 8 : 5}
            fill={isDone || isCurrent ? 'var(--step-hue)' : 'var(--surface)'}
            stroke={isDone || isCurrent ? 'var(--step-hue)' : 'var(--rule)'}
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

function WalletVisual() {
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      <rect x={40} y={16} width={240} height={48} rx={6} fill="var(--surface)" stroke="var(--rule)" />
      <rect x={56} y={32} width={80} height={6} rx={3} fill="var(--ink-40)" />
      <rect x={56} y={44} width={140} height={4} rx={2} fill="var(--ink-40)" opacity={0.5} />
      <rect x={210} y={28} width={56} height={24} rx={4} fill="var(--step-hue)" opacity={0.85} />
      <text x={238} y={43} textAnchor="middle" fill="var(--paper)" fontSize={9} fontFamily="var(--mono)">$2,400</text>
    </svg>
  );
}

function BriefVisual() {
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      <rect x={50} y={10} width={220} height={60} rx={6} fill="var(--surface)" stroke="var(--rule)" />
      <rect x={62} y={22} width={120} height={5} rx={2.5} fill="var(--ink)" />
      <rect x={62} y={34} width={196} height={3} rx={1.5} fill="var(--ink-40)" opacity={0.5} />
      <rect x={62} y={42} width={170} height={3} rx={1.5} fill="var(--ink-40)" opacity={0.5} />
      <rect x={62} y={54} width={48} height={10} rx={2} fill="var(--step-hue)" opacity={0.85} />
      <rect x={114} y={54} width={36} height={10} rx={2} fill="var(--rule)" />
    </svg>
  );
}

function ShortlistVisual() {
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${20 + i * 100}, 14)`}>
          <rect width={80} height={52} rx={4} fill="var(--surface)" stroke={i === 1 ? 'var(--step-hue)' : 'var(--rule)'} strokeWidth={i === 1 ? 1.5 : 1} />
          <circle cx={14} cy={20} r={8} fill="var(--ink-40)" />
          <rect x={28} y={14} width={42} height={4} rx={2} fill="var(--ink-40)" />
          <rect x={28} y={22} width={32} height={3} rx={1.5} fill="var(--ink-40)" opacity={0.5} />
          <rect x={6} y={36} width={68} height={10} rx={2} fill={i === 1 ? 'var(--step-hue)' : 'var(--rule)'} />
        </g>
      ))}
    </svg>
  );
}

function RoasVisual() {
  const heights = [42, 58, 30, 72, 50, 88, 64];
  return (
    <svg viewBox="0 0 320 80" className="onb-tour-svg" aria-hidden="true">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={30 + i * 38}
          y={80 - h * 0.7}
          width={26}
          height={h * 0.7}
          rx={2}
          fill="var(--step-hue)"
          opacity={i === heights.length - 2 ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}
