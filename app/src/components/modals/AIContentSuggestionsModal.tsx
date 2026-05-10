// Creator-side AI assistant: generates 4 content hooks for a brief based on
// category + deliverable type + creator's past performance.
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { pushToast } from '@/lib/utils/toast';
import type { Campaign, Creator } from '@/lib/api/types';

interface Hook {
  format: string;        // "30s reel"
  angle: string;         // "POV: …"
  outline: string[];     // 3-5 beats
  why: string;           // why it would work for this creator
  est: { reach: string; engagement: string };
}

const HOOKS_BY_CAT: Record<string, ((brand: string) => Hook)[]> = {
  Beauty: [
    (brand) => ({
      format: '30s reel · morning POV',
      angle: `Open on a quiet bathroom counter. Hands only. ${brand} bottle gets opened, applied, set down. Voiceover: one line about what changed.`,
      outline: [
        'Cold open: empty counter, soft natural light',
        '0:04 — hand reaches for bottle, label visible',
        '0:10 — pump twice, apply with downward strokes',
        '0:18 — close-up on skin texture, before/after wipe',
        '0:25 — voiceover: "Three weeks. That\'s all it took."',
      ],
      why: 'Plays to your "quiet ritual" voice. Your last morning-routine reel hit 240k views.',
      est: { reach: '180k–280k', engagement: '5.5–7%' },
    }),
    (brand) => ({
      format: '90s carousel · 6 frames',
      angle: 'Routine breakdown — 6 products, 6 lines. Editorial-style typography over each.',
      outline: [
        'Frame 1: full ritual laid out, top-down',
        'Frames 2-5: per-product close-ups with one-line copy',
        `Frame 6: ${brand} hero shot, no copy — let the product breathe`,
      ],
      why: 'Carousels save 3x more often than reels in your audience. Your 31% save rate proves it.',
      est: { reach: '95k–140k', engagement: '8–11%' },
    }),
    (brand) => ({
      format: 'Story sequence · 7 stories',
      angle: 'Day-in-the-life thread. Subtle product placement.',
      outline: [
        'Stories 1-3: morning, getting ready, casual outfit',
        `Story 4: ${brand} on the dresser — no caption, just there`,
        'Stories 5-7: rest of day, wrap with "this is what good skin feels like"',
      ],
      why: 'Stories convert your warmest audience. Tap-forward rate is below 8% on yours — high retention.',
      est: { reach: '60k–90k', engagement: '12–18% tap-back' },
    }),
    (brand) => ({
      format: '60s reel · "what surprised me"',
      angle: 'Testimonial-as-narrative. Look directly at camera, conversational.',
      outline: [
        '0:00 — "I almost didn\'t try this. Here\'s what changed my mind."',
        '0:12 — story moment (skip-the-skincare day)',
        `0:25 — pull ${brand} out of bag, show texture`,
        '0:45 — the surprise (texture / smell / morning-after)',
        '0:55 — soft CTA: "Link in bio if you want to see"',
      ],
      why: 'Testimonial format beats demo for your beauty audience. CTR up 2.4x.',
      est: { reach: '210k–340k', engagement: '6–8%' },
    }),
  ],
  Food: [
    (brand) => ({
      format: '6-min YouTube · cooking cinematic',
      angle: `One-pot dinner using ${brand} cookware. Hands-only, ASMR-leaning, brand-mention in chapter title only.`,
      outline: [
        '0:00–0:30 — ingredients laid out, knife cuts, oil',
        '0:30–2:00 — sauté + build base layer',
        '2:00–4:30 — slow cook, voiceover storytelling',
        '4:30–5:30 — final plate, garnish, top-down hero',
        '5:30–6:00 — first bite, soft sigh, end card',
      ],
      why: 'Long-form is your highest-value format. 73% completion rate vs 46% on shorts.',
      est: { reach: '110k–160k watch', engagement: '12% saves' },
    }),
    (brand) => ({
      format: '45s reel · weekend ritual',
      angle: 'Slow Saturday morning, family meal prep. Brand visible in 2 frames.',
      outline: [
        'Open: pour coffee, look out the window',
        `0:08 — pull ${brand} pan from cabinet`,
        '0:15 — rapid montage of prep',
        '0:30 — table laid, family hands reaching in',
        '0:42 — pull-back shot, end on soft music',
      ],
      why: 'Your weekend cooking content over-indexes on shares (4.2x).',
      est: { reach: '140k–220k', engagement: '8–10%' },
    }),
    (brand) => ({
      format: 'IG carousel · 8 frames',
      angle: 'Recipe walkthrough as cookbook chapter. Editorial typography.',
      outline: [
        'Frame 1: ingredient list with weights',
        'Frames 2-7: numbered steps, one shot each',
        `Frame 8: full recipe with ${brand} credit, save-able`,
      ],
      why: 'Carousels in food = saves. Yours hit 4.8% save rate avg.',
      est: { reach: '70k–110k', engagement: '14% saves' },
    }),
    () => ({
      format: 'TikTok · trending audio + voiceover',
      angle: 'Use the current trending kitchen sound. Quick recipe, brand visible incidentally.',
      outline: [
        '0:00 — fast intro, trending audio',
        '0:05 — speed-ramp through prep',
        '0:18 — hero shot of finished dish',
        '0:25 — caption hits trending hashtag',
      ],
      why: 'TikTok is your fastest-growing channel. Trending audio doubles initial push.',
      est: { reach: '300k–600k', engagement: '11–15%' },
    }),
  ],
  Fashion: [
    () => ({ format: '30s reel · transition outfit', angle: 'Walking shot, transition cut, full outfit reveal.', outline: ['0:00 walking outdoor', '0:08 cut, indoor', '0:12 outfit detail', '0:20 close shot of fabric', '0:28 final pose'], why: 'Transitions hit 7x reach for fashion creators.', est: { reach: '180k–250k', engagement: '6%' } }),
    () => ({ format: 'Carousel · 5 frames', angle: 'Capsule wardrobe breakdown.', outline: ['Frame 1 outfit overview', 'Frames 2-4 piece-by-piece', 'Frame 5 styling tips'], why: 'Save-friendly, your audience saves carousels 3x.', est: { reach: '90k–130k', engagement: '11%' } }),
    () => ({ format: 'IG post · single editorial', angle: 'Editorial portrait, one strong line.', outline: ['Single shot, low-key lighting', 'Caption: 2-line story'], why: 'Cuts through noise. Your editorial posts have 22% higher comment rate.', est: { reach: '60k–90k', engagement: '8%' } }),
    () => ({ format: '60s reel · GRWM', angle: 'Get ready with me, narrative-driven.', outline: ['0:00 walk to closet', '0:15 piece selection', '0:30 putting together', '0:45 final look', '0:55 verbal sign-off'], why: 'GRWMs have 2x your average engagement.', est: { reach: '160k–240k', engagement: '7%' } }),
  ],
  Lifestyle: [
    () => ({ format: '60s reel · day in the life', angle: 'Morning to evening montage, brand integrated naturally.', outline: ['Morning: 2-3 shots', 'Midday: product moment', 'Evening: wind-down', 'End card'], why: 'Your most-saved format.', est: { reach: '120k–180k', engagement: '7%' } }),
    () => ({ format: 'Carousel · 6 frames', angle: 'Editorial essay, photo + text.', outline: ['Frame 1 hook', 'Frames 2-5 body', 'Frame 6 takeaway'], why: 'Higher save rate than reels for thoughtful content.', est: { reach: '70k–110k', engagement: '12%' } }),
    () => ({ format: '45s reel · POV', angle: 'First-person POV, hands and product.', outline: ['POV opens', 'Product moment', 'Reveal', 'Soft conclusion'], why: 'POV format hits 1.8x your norm.', est: { reach: '100k–160k', engagement: '6%' } }),
    () => ({ format: 'IG post · single-image essay', angle: 'One strong image, 200-word caption.', outline: ['Editorial photo', 'Caption: personal story'], why: 'Long captions land for your audience — 4-min average dwell.', est: { reach: '50k–80k', engagement: '10%' } }),
  ],
};

interface AIContentSuggestionsModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  brandName: string;
  creator?: Creator;
}

export function AIContentSuggestionsModal({ open, onClose, campaign, brandName, creator: _creator }: AIContentSuggestionsModalProps) {
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'results'>('idle');
  const [hooks, setHooks] = useState<Hook[]>([]);

  const close = () => { setPhase('idle'); setHooks([]); onClose(); };

  const generate = () => {
    setPhase('thinking');
    setTimeout(() => {
      const pool = HOOKS_BY_CAT[campaign.category] || HOOKS_BY_CAT.Lifestyle;
      setHooks(pool.map((fn) => fn(brandName)));
      setPhase('results');
    }, 1100);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Content concepts"
      width={760}
      footer={<Button variant="ghost" onClick={close}>Close</Button>}
    >
      {phase === 'idle' && (
        <div>
          <div style={{ background: 'var(--paper-2)', padding: 14, borderRadius: 6, marginBottom: 18 }}>
            <div className="mono-meta mb-8">Campaign</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{campaign.title}</div>
            <div className="mono-meta mt-8">{brandName} · {campaign.category} · {campaign.deliverablesText}</div>
          </div>

          <p style={{ fontSize: 14, color: 'var(--ink-80)', marginBottom: 18 }}>
            Generate 4 content concepts based on this brief, your past performance, and your audience.
            Each concept includes format, narrative angle, beat-by-beat outline, why-it-works rationale, and reach/engagement estimates.
          </p>

          <Button onClick={generate} icon={<Icon.spark s={14} />}>Generate concepts</Button>

          <div className="text-ink-60 mt-16" style={{ fontSize: 12 }}>
            Demo mode uses pattern-based templates. Real flow would route through an LLM with your last 30 posts as context.
          </div>
        </div>
      )}

      {phase === 'thinking' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div className="mono-meta mb-16">Generating</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 18 }}>Reading your last 30 posts…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, margin: '0 auto' }}>
            {[
              'Analyzing your engagement patterns',
              'Cross-referencing brand voice',
              'Drafting 4 narrative angles',
              'Estimating reach + engagement',
            ].map((step, i) => (
              <div key={i} style={{ fontSize: 13, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 4, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s`, opacity: 0.8 }}>{step}</div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
        </div>
      )}

      {phase === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hooks.map((h, i) => (
            <div key={i} style={{ border: '1px solid var(--rule)', borderRadius: 6, padding: 16, background: 'var(--surface)' }}>
              <div className="row-between mb-8">
                <Pill>Concept {i + 1}</Pill>
                <span className="mono-meta">{h.est.reach} reach · {h.est.engagement}</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 8 }}>{h.format}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-80)', marginBottom: 12 }}>{h.angle}</div>
              <div className="mono-meta mb-8">Outline</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {h.outline.map((step, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'var(--ink-80)', display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8 }}>
                    <span className="mono-meta" style={{ color: 'var(--ink-40)' }}>{j + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div style={{ background: 'var(--paper-2)', padding: 10, borderRadius: 4, fontSize: 12, color: 'var(--ink-80)', marginBottom: 12 }}>
                <strong>Why this works for you:</strong> {h.why}
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                navigator.clipboard.writeText(`${h.format}\n${h.angle}\n\n${h.outline.map((s, j) => `${j + 1}. ${s}`).join('\n')}`);
                pushToast('Concept copied to clipboard', 'good');
              }} icon={<Icon.link s={12} />}>Copy concept</Button>
            </div>
          ))}
          <div className="text-ink-60" style={{ fontSize: 12, marginTop: 8 }}>Use these as starting points, not finished scripts. Adapt to your voice.</div>
        </div>
      )}
    </Modal>
  );
}
