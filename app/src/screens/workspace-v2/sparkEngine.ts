// sparkEngine.ts — scripted conversation engine for Spark AI
//
// Phase E of the v2 migration. The user explicitly asked for a
// "scripted full working prototype, not routed to a real LLM, but
// fully integrated with the workspace." That's what this is.
//
// Architecture:
//   processInput(text, context) → { reply, newContext }
//
// The engine parses keyword hints from the user message, picks an
// intent (plan / find / compare / project / send / save / reset / default),
// and returns a Spark message containing one or more "blocks" the UI
// renders as styled cards (creator-cards, comparison, projection,
// brief-draft, text).
//
// Blocks make Spark feel like a tool, not just a chatbot. They are
// what makes "Send brief" / "Save to shortlist" / "Compare these two"
// real workflow primitives, not just suggestions.

import { type V2Creator, type V2Campaign } from './data';

// =====================================================================
// Pool injection — the engine doesn't import store data directly so it
// stays pure / testable. The hosting component (Spark.tsx) calls
// `setSparkPool({ creators, campaigns })` once it has them resolved
// from the store; engine handlers read via `pool()`.
// =====================================================================

let _pool: { creators: V2Creator[]; campaigns: V2Campaign[] } = { creators: [], campaigns: [] };
export function setSparkPool(p: { creators: V2Creator[]; campaigns: V2Campaign[] }) {
  _pool = p;
}
function pool() { return _pool; }

// =====================================================================
// Public types
// =====================================================================

export type SparkBlock =
  | { kind: 'text'; body: string }
  | { kind: 'creator-cards'; creatorIds: string[]; rationale: string }
  | { kind: 'comparison'; creatorIds: string[] }
  | { kind: 'projection'; budget: number; reach: number; engagement: number; creatorIds: string[]; placements: number }
  | { kind: 'brief-draft'; campaignName: string; brand: string; creatorId: string; rate: number; copy: string }
  | { kind: 'shortlist-snapshot'; creatorIds: string[] };

export interface SparkMessage {
  id: string;
  from: 'user' | 'spark';
  blocks: SparkBlock[];
  ts: number;
  suggestions?: string[];
}

export interface SparkContext {
  shortlist: string[];          // creator ids saved
  category: string | null;
  region: string | null;
  budget: number | null;
  campaignName: string | null;
  brand: string;                // current brand acting (default Sapphire)
}

export function emptyContext(): SparkContext {
  return {
    shortlist: [],
    category: null,
    region: null,
    budget: null,
    campaignName: null,
    brand: 'Sapphire',
  };
}

// =====================================================================
// Intent detection (regex-based, intentionally simple)
// =====================================================================

type Intent = 'plan' | 'find' | 'compare' | 'project' | 'send' | 'save' | 'clear' | 'help' | 'default';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (/^(reset|clear|start over|new conversation|forget)/.test(t)) return 'clear';
  if (/save|add (them|all|to shortlist|to list)|shortlist (them|all|these)/.test(t)) return 'save';
  if (/^(send|draft|brief|outreach)/.test(t) || /send (a |the )?brief/.test(t)) return 'send';
  if (/compare|versus|\svs\.?\s/.test(t)) return 'compare';
  if (/project|reach|how much|how many|impressions|estimate|forecast/.test(t)) return 'project';
  if (/plan|launch|campaign|push|drop|run a |kick off/.test(t)) return 'plan';
  if (/find|who|show me|list|search|creators? (in|for|under|over)|show creators/.test(t)) return 'find';
  if (/help|what can you|how do i|examples/.test(t)) return 'help';
  return 'default';
}

// =====================================================================
// Keyword extraction
// =====================================================================

const CATEGORY_MAP: Record<string, string[]> = {
  Fashion:    ['fashion', 'lawn', 'eid', 'apparel', 'styling', 'outfit'],
  Beauty:     ['beauty', 'skincare', 'makeup', 'grwm'],
  Food:       ['food', 'restaurant', 'iftar', 'dhaba', 'eatery', 'foodie'],
  Tech:       ['tech', 'gadget', 'phone', 'review', 'unboxing', 'laptop'],
  Travel:     ['travel', 'hunza', 'skardu', 'northern', 'tourism'],
  Fitness:    ['fitness', 'gym', 'workout', 'nutrition', 'health'],
  Parenting:  ['parenting', 'kids', 'family', 'mom'],
  Finance:    ['finance', 'money', 'investing', 'fintech'],
  B2B:        ['b2b', 'saas', 'linkedin', 'thought leadership', 'hr'],
  Lifestyle:  ['lifestyle', 'daily', 'vlog'],
};

const CITY_KEYWORDS = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi'];

function extractCategory(text: string): string | null {
  const t = text.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_MAP)) {
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return null;
}

function extractCity(text: string): string | null {
  return CITY_KEYWORDS.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? null;
}

function extractBudget(text: string): number | null {
  // $5K, $5,000, 5000 dollars, $5k budget
  const m1 = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmM])?/);
  if (m1) {
    const n = parseFloat(m1[1].replace(/,/g, ''));
    const unit = m1[2]?.toLowerCase();
    if (unit === 'k') return Math.round(n * 1000);
    if (unit === 'm') return Math.round(n * 1_000_000);
    return Math.round(n);
  }
  const m2 = text.match(/(\d+(?:,\d{3})*)\s*(?:dollars|usd|bucks)/i);
  if (m2) return parseInt(m2[1].replace(/,/g, ''), 10);
  return null;
}

function extractTierFilter(text: string): { min: number; max: number } | null {
  const t = text.toLowerCase();
  if (t.includes('nano')) return { min: 0, max: 300 };
  if (t.includes('micro')) return { min: 200, max: 800 };
  if (/\bmid(\b|-)/.test(t) && !t.includes('mid-east')) return { min: 800, max: 2500 };
  if (t.includes('macro')) return { min: 2500, max: Infinity };

  // "under $X" / "under $XK" — total budget is treated as per-creator rate cap
  // when phrased on creators specifically; otherwise it's a campaign budget
  // and we don't tier-filter.
  const tierUnder = text.match(/(?:creators?|under)\s+(?:under\s+)?\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmM])?(?!\w)/i);
  // Only treat as tier-filter when the word "creator" is nearby
  if (tierUnder && /creator|micro|nano|mid|macro|cheaper|priced|rate/i.test(text)) {
    const n = parseFloat(tierUnder[1].replace(/,/g, ''));
    const unit = tierUnder[2]?.toLowerCase();
    const max = unit === 'k' ? n * 1000 : unit === 'm' ? n * 1_000_000 : n;
    return { min: 0, max };
  }
  return null;
}

// =====================================================================
// Filtering
// =====================================================================

function filterCreators(text: string, context: SparkContext): { creators: V2Creator[]; criteria: string[] } {
  const cat = extractCategory(text) ?? context.category;
  const city = extractCity(text) ?? context.region;
  const tier = extractTierFilter(text);
  const criteria: string[] = [];

  let candidates = pool().creators.slice();

  if (cat) {
    candidates = candidates.filter((c) => c.categories.includes(cat));
    criteria.push(cat.toLowerCase());
  }
  if (city) {
    candidates = candidates.filter((c) => c.city === city);
    criteria.push(city);
  }
  if (tier) {
    candidates = candidates.filter((c) => c.rate >= tier.min && c.rate <= tier.max);
    criteria.push(
      tier.max === Infinity ? `over $${tier.min}` :
      tier.min === 0 ? `under $${tier.max}` :
      `$${tier.min}–$${tier.max}`,
    );
  }

  candidates.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return { creators: candidates.slice(0, 5), criteria };
}

// =====================================================================
// Intent handlers
// =====================================================================

function handlePlan(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  const { creators, criteria } = filterCreators(text, context);
  const cat = extractCategory(text) ?? context.category;
  const city = extractCity(text) ?? context.region;
  const budget = extractBudget(text) ?? context.budget;
  const newContext: SparkContext = {
    ...context,
    category: cat ?? context.category,
    region: city ?? context.region,
    budget: budget ?? context.budget,
  };

  const blocks: SparkBlock[] = [];
  if (creators.length === 0) {
    blocks.push({
      kind: 'text',
      body: `I couldn't find creators matching ${criteria.length ? criteria.join(' + ') : 'those criteria'}. Want me to widen the search? Try "show me Pakistani lifestyle creators" or "find creators under $500".`,
    });
  } else {
    const ctxLabel = criteria.length ? criteria.join(' + ') : 'top picks';
    const headline = `Here's a starting shortlist of ${creators.length} creators for ${ctxLabel}.`;
    const rationale =
      `I ranked by fit-score, then verified you have at least one ${cat?.toLowerCase() ?? 'category'} match in each. ` +
      (budget
        ? `For your ${budget >= 1000 ? `$${(budget / 1000).toFixed(1)}K` : `$${budget}`} budget you can afford the full set with room for boost spend.`
        : `I'd suggest a $${creators.reduce((s, c) => s + c.rate, 0).toLocaleString()} budget to book all five.`);
    blocks.push({ kind: 'text', body: headline });
    blocks.push({
      kind: 'creator-cards',
      creatorIds: creators.map((c) => c.id),
      rationale,
    });
  }

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks,
      ts: Date.now(),
      suggestions: creators.length > 0
        ? ['Compare top 2', 'Show cheaper options', 'Save all to shortlist', 'Project reach']
        : ['Lifestyle creators in Lahore', 'Karachi food micros', 'B2B LinkedIn voices'],
    },
    newContext,
  };
}

function handleFind(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  const { creators, criteria } = filterCreators(text, context);
  const newContext = {
    ...context,
    category: extractCategory(text) ?? context.category,
    region: extractCity(text) ?? context.region,
  };

  if (creators.length === 0) {
    return {
      reply: {
        id: msgId(),
        from: 'spark',
        blocks: [{
          kind: 'text',
          body: `Nothing matched. Try widening the criteria — drop the city, or ask for a different category.`,
        }],
        ts: Date.now(),
        suggestions: ['Show all fashion creators', 'Show Karachi creators', 'Show me everything'],
      },
      newContext,
    };
  }

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [
        { kind: 'text', body: `${creators.length} creator${creators.length > 1 ? 's' : ''} matching ${criteria.length ? criteria.join(' + ') : 'your search'}.` },
        { kind: 'creator-cards', creatorIds: creators.map((c) => c.id), rationale: 'Sorted by fit-score (highest first).' },
      ],
      ts: Date.now(),
      suggestions: ['Compare top 2', 'Save all', 'Show me their packages', 'Different category'],
    },
    newContext,
  };
}

function handleCompare(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  // Find creators by name mentions; otherwise pick top-2 from context shortlist or top-2 by score
  const mentioned = pool().creators.filter((c) => {
    const lower = text.toLowerCase();
    return lower.includes(c.handle.toLowerCase()) ||
           lower.includes(c.name.toLowerCase()) ||
           lower.includes(c.name.split(' ')[0].toLowerCase());
  });

  let chosen: V2Creator[] = [];
  if (mentioned.length >= 2) chosen = mentioned.slice(0, 3);
  else if (context.shortlist.length >= 2) {
    chosen = context.shortlist.slice(0, 3).map((id) => pool().creators.find((c) => c.id === id)!).filter(Boolean);
  } else {
    chosen = pool().creators.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 2);
  }

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [
        { kind: 'text', body: `Side-by-side on the dimensions brands actually compare.` },
        { kind: 'comparison', creatorIds: chosen.map((c) => c.id) },
      ],
      ts: Date.now(),
      suggestions: ['Save them all', 'Project combined reach', 'Send brief to top pick'],
    },
    newContext: context,
  };
}

function handleProject(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  const budget = extractBudget(text) ?? context.budget ?? 5000;
  const shortlistIds = context.shortlist.length > 0
    ? context.shortlist
    : filterCreators(text, context).creators.slice(0, 3).map((c) => c.id);

  const creators = shortlistIds.map((id) => pool().creators.find((c) => c.id === id)!).filter(Boolean);
  const totalReach = creators.reduce((s, c) => s + c.channels.reduce((a, ch) => a + ch.followers, 0), 0);
  const avgER = creators.length > 0
    ? creators.reduce((s, c) => s + c.channels.reduce((a, ch) => a + ch.engagement, 0) / c.channels.length, 0) / creators.length
    : 0;
  const placements = creators.length * 2; // 1 reel + 1 stories bundle per creator (rough)

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [
        { kind: 'text', body: `Projection based on ${creators.length} creator${creators.length === 1 ? '' : 's'}${context.shortlist.length > 0 ? ' in your shortlist' : ''} and a $${budget.toLocaleString()} budget.` },
        {
          kind: 'projection',
          budget,
          reach: Math.round(totalReach * 0.85),  // assume ~85% delivers
          engagement: Math.round(avgER * 10) / 10,
          creatorIds: shortlistIds,
          placements,
        },
      ],
      ts: Date.now(),
      suggestions: ['Increase budget to $10K', 'Add 2 more creators', 'Lock in this plan'],
    },
    newContext: { ...context, budget },
  };
}

function handleSend(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  // Pick the creator: name-mention > shortlist[0] > top-scoring
  const mentioned = pool().creators.find((c) =>
    text.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()) ||
    text.toLowerCase().includes(c.handle.toLowerCase()),
  );
  const creator = mentioned
    ?? (context.shortlist[0] ? pool().creators.find((c) => c.id === context.shortlist[0]) : null)
    ?? pool().creators[0];

  const campaignName = context.campaignName
    ?? (context.category ? `${context.category} push — ${context.brand}` : `${context.brand} campaign`);
  const copy = generateBriefCopy(creator!, campaignName, context);

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [
        { kind: 'text', body: `Drafted a brief for ${creator!.name}. Review and I'll send it through Inbox once you approve.` },
        {
          kind: 'brief-draft',
          campaignName,
          brand: context.brand,
          creatorId: creator!.id,
          rate: creator!.rate,
          copy,
        },
      ],
      ts: Date.now(),
      suggestions: ['Send as-is', 'Edit the rate', 'Send to all 5 in shortlist'],
    },
    newContext: context,
  };
}

function handleSave(_text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  // Save the most recent creator-cards block — but engine doesn't track history.
  // Instead, save top-3 from the current filter context.
  const { creators } = filterCreators('', context);
  const toSave = creators.slice(0, 3).map((c) => c.id);
  const newShortlist = Array.from(new Set([...context.shortlist, ...toSave]));

  if (toSave.length === 0) {
    return {
      reply: {
        id: msgId(),
        from: 'spark',
        blocks: [{ kind: 'text', body: `Nothing to save yet — show me some creators first.` }],
        ts: Date.now(),
        suggestions: ['Plan a fashion campaign', 'Find Karachi creators'],
      },
      newContext: context,
    };
  }

  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [
        { kind: 'text', body: `Added ${toSave.length} creator${toSave.length === 1 ? '' : 's'} to your shortlist. ${newShortlist.length} total saved this session.` },
        { kind: 'shortlist-snapshot', creatorIds: newShortlist },
      ],
      ts: Date.now(),
      suggestions: ['Project combined reach', 'Compare top 2', 'Send brief to all'],
    },
    newContext: { ...context, shortlist: newShortlist },
  };
}

function handleClear(_text: string, _context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [{
        kind: 'text',
        body: `Cleared your shortlist. Fresh start — what do you want to plan?`,
      }],
      ts: Date.now(),
      suggestions: ['Eid lawn campaign for Sapphire', 'Karachi food micros', 'B2B LinkedIn voices'],
    },
    newContext: emptyContext(),
  };
}

function handleHelp(_text: string, _context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [{
        kind: 'text',
        body: `I can plan a campaign end-to-end. Try one of these:\n\n• "Plan an Eid campaign for Sapphire under $20K"\n• "Find Karachi food creators under $500"\n• "Compare Hira and Mahnoor"\n• "Project reach for $5K"\n• "Send brief to Bilal"\n\nI'll draft creator lists, project metrics, and prepare briefs you can send through Inbox.`,
      }],
      ts: Date.now(),
      suggestions: ['Plan an Eid campaign', 'Find Karachi food creators', 'Show me LinkedIn B2B'],
    },
    newContext: _context,
  };
}

function handleDefault(_text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  return {
    reply: {
      id: msgId(),
      from: 'spark',
      blocks: [{
        kind: 'text',
        body: `Got it. Want me to plan a campaign, find creators, or project reach? Tell me the brand + audience + budget and I'll draft a shortlist.`,
      }],
      ts: Date.now(),
      suggestions: ['Plan a fashion push', 'Find food creators in Karachi', 'Compare two creators'],
    },
    newContext: context,
  };
}

// =====================================================================
// Brief copy generator
// =====================================================================

function generateBriefCopy(creator: V2Creator, campaignName: string, context: SparkContext): string {
  const cat = context.category?.toLowerCase() ?? creator.categories[0]?.toLowerCase() ?? 'lifestyle';
  return [
    `Hi ${creator.name.split(' ')[0]} —`,
    ``,
    `${context.brand} is launching ${campaignName}. We loved your last few ${cat} pieces and think your voice fits this push.`,
    ``,
    `What we're proposing:`,
    `• 1 Reel + 3 Stories featuring our ${cat} drop`,
    `• Brand-safe, candid styling — no flashy edits`,
    `• Going live by end of month`,
    ``,
    `Rate: $${creator.rate.toLocaleString()} (per your published combo package). Product gifting included.`,
    ``,
    `Reply if interested and we'll send the brief deck + samples within the day.`,
    ``,
    `— ${context.brand}`,
  ].join('\n');
}

// =====================================================================
// Main entry point
// =====================================================================

export function processInput(text: string, context: SparkContext): { reply: SparkMessage; newContext: SparkContext } {
  const intent = detectIntent(text);
  switch (intent) {
    case 'plan':    return handlePlan(text, context);
    case 'find':    return handleFind(text, context);
    case 'compare': return handleCompare(text, context);
    case 'project': return handleProject(text, context);
    case 'send':    return handleSend(text, context);
    case 'save':    return handleSave(text, context);
    case 'clear':   return handleClear(text, context);
    case 'help':    return handleHelp(text, context);
    default:        return handleDefault(text, context);
  }
}

// =====================================================================
// Remote LLM proxy (Phase 50) — Edge Function spark-chat
// =====================================================================
//
// When the spark-chat Edge Function is deployed AND ANTHROPIC_API_KEY
// is set in Supabase secrets, replace the scripted text reply with a
// real Claude completion. Keeps the rest of the scripted reply
// (suggestions, blocks like creator-cards/brief-draft) intact so the
// existing UI keeps working — only the prose becomes intelligent.
//
// Returns null on any failure (no key configured, network, parse) so
// the caller stays on the scripted path. Never throws.

export async function tryRemoteText(
  input: string,
  history: SparkMessage[],
  context: SparkContext,
): Promise<string | null> {
  const url = remoteSparkUrl();
  if (!url) return null;
  // Compress recent history to text-only entries — the function does
  // not need the full block structure for follow-up context.
  const compactHistory = history.slice(-10).map((m) => {
    const text = (m.blocks ?? [])
      .map((b) => (b.kind === 'text' ? b.body : ''))
      .filter(Boolean)
      .join(' ');
    return { from: m.from, text };
  });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input,
        history: compactHistory,
        context: {
          brand: context.brand,
          category: context.category,
          region: context.region,
          budget: context.budget,
        },
      }),
    });
    if (!res.ok) return null; // 503 = not configured, 502 = upstream
    const data = await res.json();
    const block = (data?.reply?.blocks ?? []).find((b: { kind?: string; body?: string }) => b.kind === 'text');
    return typeof block?.body === 'string' ? block.body : null;
  } catch {
    return null;
  }
}

function remoteSparkUrl(): string | null {
  // Vite injects import.meta.env.* at build time. The Supabase URL we
  // already use for the JS client also hosts the Edge Function.
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const base = env?.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/functions/v1/spark-chat`;
}

// =====================================================================
// Welcome / starter
// =====================================================================

export function welcomeMessage(): SparkMessage {
  return {
    id: msgId(),
    from: 'spark',
    blocks: [{
      kind: 'text',
      body: `Hi — I'm Spark. Tell me what you want to ship and I'll draft the creator list, project the numbers, and prep briefs you can send.`,
    }],
    ts: Date.now(),
    suggestions: [
      'Plan an Eid campaign for Sapphire',
      'Find Karachi food creators under $500',
      'B2B LinkedIn voices in Pakistan',
      'How does Spark work?',
    ],
  };
}

// =====================================================================
// Utilities
// =====================================================================

function msgId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** For UI: estimate "thinking" delay based on response complexity. */
export function thinkingDelay(): number {
  return 600 + Math.floor(Math.random() * 500);
}

/** Quick lookup helpers exposed to the UI. */
export function getCreator(id: string): V2Creator | undefined {
  return pool().creators.find((c) => c.id === id);
}

export function getCampaign(id: string) {
  return pool().campaigns.find((c) => c.id === id);
}
