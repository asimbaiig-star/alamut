// AI Match concierge — describe a campaign in natural language, get matched creators with reasoning.
// Mock: keyword overlap with creator categories/tagline/bio + tier weighting.
import { useState } from 'react';
import { useStore } from '@/lib/api/store';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { fmtCount, fmtMoneyFull, initials } from '@/lib/utils/format';
import type { Creator } from '@/lib/api/types';

interface AIMatchModalProps {
  open: boolean;
  onClose: () => void;
  onPick?: (creatorId: string) => void;
}

interface Match {
  creator: Creator;
  score: number;
  reasoning: string[];
}

const KEYWORD_TO_CATEGORY: Record<string, string[]> = {
  food: ['Food'], cooking: ['Food'], chef: ['Food'], recipe: ['Food'],
  fashion: ['Fashion'], style: ['Fashion'], clothing: ['Fashion'],
  beauty: ['Beauty'], skincare: ['Beauty'], makeup: ['Beauty'],
  travel: ['Travel'], hotel: ['Travel'],
  design: ['Design'], product: ['Design'], object: ['Design'],
  wellness: ['Wellness'], yoga: ['Wellness'], meditation: ['Wellness'], fitness: ['Wellness'],
  tech: ['Tech'], software: ['Tech'], gear: ['Tech'],
  sustainable: ['Sustainability'], eco: ['Sustainability'],
  interior: ['Interiors'], home: ['Interiors'],
  lifestyle: ['Lifestyle'],
};

const REGION_KEYWORDS: Record<string, string[]> = {
  pakistan: ['Pakistan'], lahore: ['Pakistan'], karachi: ['Pakistan'], islamabad: ['Pakistan'],
  india: ['India'], delhi: ['India'], mumbai: ['India'],
  japan: ['Japan'], tokyo: ['Japan'], kyoto: ['Japan'],
  uk: ['UK'], london: ['UK'],
  us: ['USA'], usa: ['USA'], 'new york': ['USA'], la: ['USA'],
  europe: ['Germany', 'France', 'Italy', 'Netherlands', 'Sweden', 'Denmark', 'Portugal'],
  apac: ['Japan', 'South Korea', 'Singapore', 'Indonesia', 'Thailand'],
  global: [],
};

function scoreCreator(c: Creator, prompt: string): Match {
  const p = prompt.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Category keywords
  const matchingCats: string[] = [];
  Object.entries(KEYWORD_TO_CATEGORY).forEach(([kw, cats]) => {
    if (p.includes(kw)) {
      cats.forEach((cat) => {
        if (c.categories.includes(cat) && !matchingCats.includes(cat)) {
          matchingCats.push(cat);
          score += 30;
        }
      });
    }
  });
  if (matchingCats.length) reasons.push(`Strong category match: ${matchingCats.join(', ')}`);

  // Region
  const matchingRegions: string[] = [];
  Object.entries(REGION_KEYWORDS).forEach(([kw, countries]) => {
    if (p.includes(kw) && countries.includes(c.country)) {
      matchingRegions.push(c.country);
      score += 20;
    }
  });
  if (matchingRegions.length) reasons.push(`Based in target region: ${matchingRegions.join(', ')}`);

  // Tagline overlap
  const tagWords = c.tagline.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const overlap = tagWords.filter((w) => p.includes(w));
  if (overlap.length >= 2) {
    score += 10;
    reasons.push(`Tagline overlap: "${overlap.slice(0, 3).join(', ')}"`);
  }

  // Tier/reach signals
  if (p.match(/large|wide|reach|broad|massive/) && c.tier === 'Flagship') {
    score += 15;
    reasons.push('Flagship tier — wide reach for broad campaigns');
  }
  if (p.match(/niche|specific|community|specialist/) && c.tier === 'Specialist') {
    score += 15;
    reasons.push('Specialist tier — high-engagement niche audience');
  }
  if (p.match(/budget|affordable|emerging|fresh/) && c.tier === 'Rising') {
    score += 12;
    reasons.push('Rising tier — strong fit for budget-friendly briefs');
  }

  // Engagement bonus
  if (c.engagement > 5) {
    score += Math.round(c.engagement);
    reasons.push(`Above-average engagement: ${c.engagement}%`);
  }

  // Verified bonus
  if (c.verified) {
    score += 5;
    reasons.push('Verified by Alamut');
  }

  return { creator: c, score, reasoning: reasons };
}

export function AIMatchModal({ open, onClose, onPick }: AIMatchModalProps) {
  const db = useStore((s) => s.db);
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'input' | 'thinking' | 'results'>('input');
  const [matches, setMatches] = useState<Match[]>([]);

  const reset = () => { setPhase('input'); setPrompt(''); setMatches([]); };

  const run = () => {
    if (!prompt.trim()) return;
    setPhase('thinking');
    setTimeout(() => {
      const scored = db.creators
        .map((c) => scoreCreator(c, prompt))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setMatches(scored);
      setPhase('results');
    }, 1200);
  };

  const close = () => { reset(); onClose(); };

  return (
    <Modal
      open={open}
      onClose={close}
      title="AI Match concierge"
      width={720}
      footer={
        phase === 'results' ? (
          <>
            <Button variant="ghost" onClick={reset}>Try a different brief</Button>
            <Button variant="ghost" onClick={close}>Close</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            {phase === 'input' && <Button onClick={run} disabled={!prompt.trim()} icon={<Icon.spark s={14} />}>Find matches</Button>}
          </>
        )
      }
    >
      {phase === 'input' && (
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">Describe your campaign in plain English</label>
            <textarea
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. We're launching a new sustainable skincare line in Pakistan. Looking for 3 lifestyle creators with engaged audiences and a quiet, considered visual style. Budget around $5,000."
              autoFocus
            />
            <span className="field-help">Mention category, region, audience size, voice — anything you'd tell an agency briefer. The more specific the better the match.</span>
          </div>
          <div className="field full">
            <div className="mono-meta mb-8">Quick prompts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                'Sustainable skincare launch in Pakistan, 3 lifestyle creators, considered visual style, budget $5k',
                'Premium kitchenware feature for South Asian food creators, long-form YouTube content, global reach',
                'Niche design / interiors creators in Japan or Europe for a quiet object launch',
                'Emerging fashion creators on a tight budget for a capsule drop, US/UK',
              ].map((p) => (
                <button key={p} type="button" className="tab" onClick={() => setPrompt(p)} style={{ textAlign: 'left', maxWidth: 320, fontSize: 11, padding: '8px 12px', textTransform: 'none', letterSpacing: '0.02em' }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'thinking' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div className="mono-meta mb-16">Reasoning</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 18 }}>Reading the brief…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, margin: '0 auto' }}>
            {[
              'Parsing categories and target regions',
              'Scoring creators by category overlap',
              'Boosting verified, high-engagement profiles',
              'Ranking the top 5',
            ].map((step, i) => (
              <div key={i} style={{
                fontSize: 13, padding: '10px 14px',
                background: 'var(--paper-2)', borderRadius: 4,
                animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s`,
                opacity: 0.8,
              }}>{step}</div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
        </div>
      )}

      {phase === 'results' && (
        <div>
          {matches.length === 0 ? (
            <div className="empty">
              <div className="empty-h">No strong matches found</div>
              <div>Try mentioning a category (food, beauty, design…) or region.</div>
            </div>
          ) : (
            <div>
              <div className="mono-meta mb-16">Top {matches.length} matches</div>
              {matches.map((m, i) => (
                <div key={m.creator.id} className="applicant-row" style={{ marginBottom: 10 }}>
                  {m.creator.portrait ? <img src={m.creator.portrait} alt={m.creator.name} /> : <div style={{ width: 56, height: 64, background: 'var(--paper-2)', borderRadius: 4, display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)' }}>{initials(m.creator.name)}</div>}
                  <div>
                    <div className="row-between">
                      <div>
                        <div className="applicant-name">{i + 1}. {m.creator.name}</div>
                        <div className="applicant-meta">{m.creator.handle} · {m.creator.tier} · {m.creator.city}, {m.creator.country} · {fmtCount(m.creator.reach)} reach · from {m.creator.rateCard.post.split('–')[0]}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Pill tone="good">Score {m.score}</Pill>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-80)' }}>
                      <strong>Why:</strong> {m.reasoning.slice(0, 3).join(' · ')}
                    </div>
                  </div>
                  {onPick && (
                    <Button size="sm" onClick={() => { onPick(m.creator.id); close(); }} icon={<Icon.plus s={12} />}>Add</Button>
                  )}
                </div>
              ))}
              <div className="text-ink-60 mt-16" style={{ fontSize: 12 }}>
                Mock matching: keyword overlap + tier weighting + engagement bonus. Real flow would call a model with the full creator pool. Avg total budget for these {matches.length}: {fmtMoneyFull(matches.length * 1500)}.
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
