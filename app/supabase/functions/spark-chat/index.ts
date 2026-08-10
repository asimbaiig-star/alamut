// supabase/functions/spark-chat/index.ts
//
// Spark conversational planner — server-side LLM proxy. Deno runtime.
//
// Why this exists as an Edge Function: shipping the Anthropic API key
// to the browser is a leak. The client posts {history, context, input}
// here, we call Anthropic's messages endpoint with the secret on the
// server, and stream a SparkBlock-shaped reply back.
//
// Setup:
//   1. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
//   2. `supabase functions deploy spark-chat`
//   3. The client (sparkEngine.ts → callSparkRemote) auto-detects the
//      function URL at <project>.supabase.co/functions/v1/spark-chat.
//      When the function isn't deployed (404) or the env var isn't
//      set (handled below), the client falls back to scripted replies.
//
// Output contract:
//   { reply: { id, from: 'spark', blocks: SparkBlock[], suggestions?: string[] } }
//
// SparkBlock variants the client renders (kept in lockstep with
// sparkEngine.ts):
//   { kind: 'text', body: string }
//   { kind: 'creator-cards', creatorIds: string[] }
//   { kind: 'projection', budget, reach, engagement }
//   { kind: 'brief-draft', title, brief }
//
// This first cut returns a plain `text` block so the integration is
// proven end-to-end. Tool-use (creator search, brief generation) is the
// natural follow-up — see TODO at the bottom.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore — Deno runtime, not Node.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// @ts-ignore
const env = (k: string) => Deno.env.get(k) ?? '';

// Current-generation Sonnet. Sonnet 4.6 (the previous pin) still works, but
// this tier is the right one for Spark: short conversational replies where
// latency and cost matter more than peak reasoning.
//
// Two Sonnet 5 behaviours are handled explicitly in the request below:
//   1. Adaptive thinking is ON by default when `thinking` is omitted, and
//      `max_tokens` caps thinking + reply TOGETHER. Left alone, a 600-token
//      budget could be spent thinking and return a truncated sentence. Spark
//      writes 2-4 sentences and needs no reasoning, so thinking is disabled.
//   2. `effort` defaults to `high`. For a short chat reply that's wasted
//      spend, so we ask for `low`.
const ANTHROPIC_MODEL = 'claude-sonnet-5';

interface SparkRequest {
  input: string;
  history?: Array<{ from: 'user' | 'spark'; text?: string }>;
  context?: { brand?: string; category?: string; region?: string; budget?: number };
}

interface SparkResponse {
  reply: {
    id: string;
    from: 'spark';
    blocks: Array<{ kind: 'text'; body: string }>;
    suggestions?: string[];
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    // Surface a 503 so the client can fall back to its scripted engine.
    return jsonResp({ error: 'spark-chat not configured', code: 'missing_key' }, 503);
  }

  let body: SparkRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.input || typeof body.input !== 'string') {
    return jsonResp({ error: 'input is required' }, 400);
  }

  // The API rejects a conversation whose first message is `assistant`, and
  // rejects empty text content outright. Spark's own opening greeting is a
  // 'spark' turn, and non-text blocks (creator cards, projections) carry no
  // `text` — so a naive 1:1 map produces a 400 on the very first real
  // exchange. Drop empty turns, then drop any leading assistant turns.
  const mapped: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of body.history ?? []) {
    const content = (m.text ?? '').trim();
    if (!content) continue;
    mapped.push({ role: m.from === 'user' ? 'user' : 'assistant', content });
  }
  while (mapped.length > 0 && mapped[0].role === 'assistant') mapped.shift();
  const messages = [...mapped, { role: 'user' as const, content: body.input }];

  const ctxLine = body.context && (body.context.brand || body.context.category || body.context.budget)
    ? `Brand: ${body.context.brand ?? '—'}, Category: ${body.context.category ?? '—'}, Budget: ${body.context.budget ?? '—'}, Region: ${body.context.region ?? '—'}`
    : '';

  const systemPrompt = [
    'You are Spark — a conversational creator-campaign planner inside the Alamut workspace.',
    'You help brands plan influencer campaigns: shortlist creators, project reach, draft briefs.',
    'Keep replies concise (2–4 sentences). End with a short follow-up question that moves planning forward.',
    'Do not invent specific creator names; the workspace will inject real shortlists separately.',
    ctxLine ? `Current planning context — ${ctxLine}.` : '',
  ].filter(Boolean).join(' ');

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system: systemPrompt,
        messages,
      }),
    });
  } catch (err) {
    return jsonResp({ error: `upstream fetch failed: ${err}` }, 502);
  }

  if (!upstream.ok) {
    const errBody = await upstream.text();
    return jsonResp({ error: `upstream ${upstream.status}: ${errBody}` }, 502);
  }

  const data = await upstream.json();

  // A refusal returns HTTP 200 with an empty/partial `content`, so reading
  // content blindly would surface a blank reply as if it were an answer.
  // Fall back to the scripted engine (503) rather than showing nothing.
  if (data?.stop_reason === 'refusal') {
    return jsonResp({ error: 'declined', code: 'refusal' }, 503);
  }

  const text: string = (data?.content ?? [])
    .filter((c: any) => c?.type === 'text')
    .map((c: any) => c?.text ?? '')
    .join('\n')
    .trim() || 'Got it — what part of the plan should we tackle next?';

  // Truncated mid-sentence: say so rather than presenting a cut-off reply as
  // a complete thought.
  const truncated = data?.stop_reason === 'max_tokens';

  const out: SparkResponse = {
    reply: {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: 'spark',
      blocks: [{ kind: 'text', body: truncated ? `${text}…` : text }],
    },
  };
  return jsonResp(out, 200);
});

function jsonResp(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

// =====================================================================
// TODO — tool use
// =====================================================================
// The next iteration should let Claude *call* tools (search_creators,
// project_campaign, draft_brief) so the response can include
// `creator-cards` / `projection` / `brief-draft` blocks. The client
// already renders these via sparkEngine.ts; only the proxy layer here
// needs to expand. Reference: anthropic.com/docs/build-with-claude/tool-use.
