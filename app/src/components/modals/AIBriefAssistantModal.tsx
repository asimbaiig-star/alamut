// AI brief assistant. Brand types a plain-English description of their campaign,
// gets a structured brief generated. Mock implementation — pattern-matches the
// prompt and generates plausible output via templates.
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface GeneratedBrief {
  title: string;
  pitch: string;
  brief: string;
  category: string;
  region: string;
  budget: number;
  deliverables: string;
}

interface AIBriefAssistantModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (brief: GeneratedBrief) => void;
}

const CATEGORY_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ['skin', 'beauty', 'makeup', 'serum', 'fragrance'], category: 'Beauty' },
  { keywords: ['food', 'cooking', 'chef', 'recipe', 'kitchen'], category: 'Food' },
  { keywords: ['fashion', 'style', 'clothing', 'apparel', 'wear'], category: 'Fashion' },
  { keywords: ['travel', 'hotel', 'resort', 'destination'], category: 'Travel' },
  { keywords: ['design', 'object', 'product', 'craft'], category: 'Design' },
  { keywords: ['interior', 'home', 'furniture', 'decor'], category: 'Interiors' },
  { keywords: ['wellness', 'yoga', 'mindful', 'fitness'], category: 'Wellness' },
  { keywords: ['tech', 'app', 'software', 'gadget'], category: 'Tech' },
  { keywords: ['sustain', 'eco', 'climate', 'circular'], category: 'Sustainability' },
];

const REGION_KEYWORDS: { keywords: string[]; region: string }[] = [
  { keywords: ['pakistan', 'lahore', 'karachi', 'islamabad'], region: 'MENA' },
  { keywords: ['india', 'mumbai', 'delhi', 'south asia'], region: 'APAC' },
  { keywords: ['japan', 'korea', 'asia', 'apac'], region: 'APAC' },
  { keywords: ['us', 'america', 'usa'], region: 'US' },
  { keywords: ['uk', 'britain', 'london'], region: 'UK' },
  { keywords: ['europe', 'eu'], region: 'EU' },
];

function extract(prompt: string, candidates: { keywords: string[]; [k: string]: any }[], fallback: string): string {
  const p = prompt.toLowerCase();
  for (const c of candidates) {
    if (c.keywords.some((k) => p.includes(k))) return c[Object.keys(c)[1]] as string;
  }
  return fallback;
}

function extractBudget(prompt: string): number {
  // Match $5,000 or 5k or 5000 USD
  const m = prompt.match(/\$?(\d+[\d,]*)(?:\s*(k|K))?/);
  if (m) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    return m[2] ? n * 1000 : n;
  }
  return 5000;
}

function extractCreatorCount(prompt: string): number {
  const m = prompt.match(/(\d+)\s*(?:creators|influencers|people)/i);
  return m ? parseInt(m[1], 10) : 3;
}

function generate(prompt: string): GeneratedBrief {
  const p = prompt.toLowerCase();
  const category = extract(prompt, CATEGORY_KEYWORDS.map((c) => ({ keywords: c.keywords, value: c.category })), 'Lifestyle');
  const region = extract(prompt, REGION_KEYWORDS.map((c) => ({ keywords: c.keywords, value: c.region })), 'Global');
  const budget = extractBudget(prompt);
  const numCreators = extractCreatorCount(prompt);

  const wantsLongForm = p.match(/long.?form|youtube|6.min|video/);
  const wantsReel = p.match(/reel|short.?form|tiktok|ig|instagram/);
  const deliverables = wantsLongForm ? '1 YouTube long-form + 1 IG post + 3 stories'
    : wantsReel ? `${numCreators === 1 ? '1' : numCreators} Reel${numCreators === 1 ? '' : 's'} + ${numCreators * 2} stories`
    : '1 Reel + 1 IG post + 2 stories';

  // Pull a brand-y title and pitch from category
  const titlesByCat: Record<string, string[]> = {
    Beauty:    ['Spring Renewal', 'Daily Ritual', 'Glow Notes', 'Quiet Mornings'],
    Food:      ['Slow Sundays', 'Heritage Recipes', 'Sunday Suppers', 'Pantry Pulls'],
    Fashion:   ['Spring Capsule', 'Slow Style', 'Editorial Drop', 'Made to Last'],
    Travel:    ['Hidden Cities', 'Long Weekend', 'Off-Map'],
    Design:    ['Studio Notes', 'Quiet Objects', 'Considered Spaces'],
    Lifestyle: ['Morning Pages', 'The Slow Edit', 'Small Joys'],
    Wellness:  ['Reset Week', 'Daily Practice', 'Restore Routine'],
    Sustainability: ['Long Use Diaries', 'Repair Stories'],
    Interiors: ['Small Flats', 'Light & Air'],
    Tech:      ['Workflow Notes', 'Built in Public'],
  };
  const title = (titlesByCat[category] || titlesByCat.Lifestyle)[0];
  const pitch = `A ${category.toLowerCase()} campaign with ${numCreators} creator${numCreators === 1 ? '' : 's'} — ${region.toLowerCase() === 'global' ? 'global reach' : `${region}-focused`}, ${wantsLongForm ? 'long-form' : 'short-form'} forward.`;

  // Build the longer brief from the input + structured additions
  const brief = [
    `OVERVIEW: ${prompt.trim()}`,
    '',
    `OBJECTIVE: Generate authentic, on-brand ${category.toLowerCase()} content from ${numCreators} creator${numCreators === 1 ? '' : 's'} in ${region}. Target audience is engaged, considered, and matches the brand's existing voice.`,
    '',
    `DELIVERABLES: ${deliverables}.`,
    '',
    'VOICE: Authentic-first. No flashy unboxings. Soft, natural light. Brand mention organic — not over-stylized.',
    '',
    'EXCLUSIONS: No competitive brand mentions during the engagement window. No AI-generated content. No stock imagery.',
    '',
    'TIMELINE: Brief → live campaign within 7 days. Production window 14 days. Posts live by deadline.',
  ].join('\n');

  return { title, pitch, brief, category, region, budget, deliverables };
}

export function AIBriefAssistantModal({ open, onClose, onApply }: AIBriefAssistantModalProps) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'input' | 'thinking' | 'review'>('input');
  const [result, setResult] = useState<GeneratedBrief | null>(null);

  const reset = () => { setPhase('input'); setPrompt(''); setResult(null); };
  const close = () => { reset(); onClose(); };

  const run = () => {
    if (!prompt.trim()) return;
    setPhase('thinking');
    setTimeout(() => {
      setResult(generate(prompt));
      setPhase('review');
    }, 1200);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="AI brief assistant"
      width={680}
      footer={
        phase === 'review' && result ? (
          <>
            <Button variant="ghost" onClick={reset}>Tweak prompt</Button>
            <Button onClick={() => { onApply(result); close(); }} icon={<Icon.check s={14} />}>Apply to brief</Button>
          </>
        ) : phase === 'input' ? (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={run} disabled={!prompt.trim()} icon={<Icon.spark s={14} />}>Generate brief</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={close}>Cancel</Button>
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
              placeholder="e.g. Launching a sustainable skincare line in Pakistan. Want 3 lifestyle creators with engaged audiences for 1 reel + 2 stories each. Budget around $6,000. Soft visual style, no flashy unboxings."
              autoFocus
            />
            <span className="field-help">Mention the product, audience, deliverables, region, and budget if you have one. The more specific, the better the output.</span>
          </div>
          <div className="field full">
            <div className="mono-meta mb-8">Quick prompts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                'Sustainable skincare launch in Pakistan, 3 lifestyle creators, considered visual style, budget $5k, 1 reel + 2 stories each',
                'Premium kitchenware feature for South Asian food creators, long-form YouTube, 2 creators, $8k budget',
                'Fall fashion drop, 4 fashion creators in EU/UK, 1 reel + 1 IG post each, $10k total',
                'Mindful wellness app launch, 2 wellness creators, organic only, no whitelisting, $3k',
              ].map((p) => (
                <button key={p} type="button" className="tab" onClick={() => setPrompt(p)} style={{ textAlign: 'left', maxWidth: 340, fontSize: 11, padding: '8px 12px', textTransform: 'none', letterSpacing: '0.02em' }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'thinking' && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div className="mono-meta mb-16">Generating</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 18 }}>Reading the brief…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, margin: '0 auto' }}>
            {[
              'Parsing category and region',
              'Inferring deliverable formats',
              'Generating overview + objective',
              'Drafting exclusions + timeline',
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

      {phase === 'review' && result && (
        <div>
          <div style={{ background: 'var(--good-bg)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--good)', marginBottom: 18 }}>
            ✓ Generated. Edit any field after applying — this is a starting point, not a final.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', marginBottom: 18 }}>
            <div><div className="mono-meta">Category</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{result.category}</div></div>
            <div><div className="mono-meta">Region</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{result.region}</div></div>
            <div><div className="mono-meta">Budget</div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>${result.budget.toLocaleString()}</div></div>
            <div><div className="mono-meta">Deliv.</div><div style={{ fontSize: 13, marginTop: 4 }}>{result.deliverables}</div></div>
          </div>

          <div className="mono-meta mb-8">Title</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginBottom: 14 }}>{result.title}</div>

          <div className="mono-meta mb-8">Pitch</div>
          <div style={{ fontSize: 14, color: 'var(--ink-80)', marginBottom: 14 }}>{result.pitch}</div>

          <div className="mono-meta mb-8">Brief</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-80)', whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', padding: 12, background: 'var(--paper-2)', borderRadius: 6 }}>
            {result.brief}
          </div>
        </div>
      )}
    </Modal>
  );
}
