// Optimistic-lock helpers shared across repos.
//
// Migration 020 adds an integer `version` column to the highest-risk
// UPDATE-able tables (campaigns, offers, applications, submissions,
// collaborations, disputes). The repo pattern for an optimistic write:
//
//   sb.from('campaigns')
//     .update({ ...patch, version: expected + 1 })
//     .eq('id', id)
//     .eq('version', expected)        // ← the lock check
//     .select(COLUMNS)
//     .single();                       // throws if 0 rows matched
//
// When two tabs race, the second tab's UPDATE matches 0 rows (because
// the first tab already bumped the version). PostgREST returns
// "JSON object requested, multiple (or no) rows returned" — we detect
// that, throw a typed `StaleVersionError`, and the caller surfaces a
// toast. The next read pulls the current row from Postgres and the
// local Zustand store catches up via the existing storage-event sync.

export class StaleVersionError extends Error {
  readonly kind = 'stale-version' as const;
  constructor(readonly entity: string, readonly id: string) {
    super(`Stale version on ${entity}:${id} — another writer updated this row.`);
    this.name = 'StaleVersionError';
  }
}

/**
 * Inspect a PostgREST error message to detect "no rows matched" — the
 * shape returned when a `.single()` query finds 0 rows. We use this
 * to translate the generic error into a typed StaleVersionError so
 * the caller can branch (toast + auto-refresh) without parsing strings.
 *
 * Patterns observed across supabase-js versions:
 *   - "JSON object requested, multiple (or no) rows returned"
 *   - "no rows updated"
 *   - "0 rows"
 *   - PGRST116 / PGRST204 result codes
 */
export function isNoRowsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /no rows|0 rows|multiple \(or no\) rows|PGRST(116|204)/i.test(msg);
}
