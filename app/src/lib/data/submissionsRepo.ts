// Supabase repository for the Submission entity (Phase 5d).

import type { Submission, SubmissionStatus } from '@/lib/api/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type Row = {
  id: string;
  campaign_id: string;
  creator_id: string;
  round: number;
  files: Submission['files'];
  notes: string;
  status: SubmissionStatus;
  submitted_at: string;
  feedback: Submission['feedback'];
  permalink: string | null;
  collaboration_id: string | null;
  deliverable_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, campaign_id, creator_id, round, files, notes, status, ' +
  'submitted_at, feedback, permalink, collaboration_id, deliverable_id, ' +
  'created_at, updated_at';

function toSubmission(row: Row): Submission {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    round: row.round,
    files: row.files ?? [],
    notes: row.notes,
    status: row.status,
    submittedAt: row.submitted_at,
    feedback: row.feedback ?? [],
    permalink: row.permalink ?? undefined,
    collaborationId: row.collaboration_id ?? undefined,
    deliverableId: row.deliverable_id ?? undefined,
  };
}

function toInsertRow(s: Submission): Record<string, unknown> {
  return {
    id: s.id,
    campaign_id: s.campaignId,
    creator_id: s.creatorId,
    round: s.round,
    files: s.files,
    notes: s.notes,
    status: s.status,
    submitted_at: s.submittedAt,
    feedback: s.feedback,
    permalink: s.permalink ?? null,
    collaboration_id: s.collaborationId ?? null,
    deliverable_id: s.deliverableId ?? null,
  };
}

type UpdatablePatch = Partial<{
  status: SubmissionStatus;
  feedback: Submission['feedback'];
  permalink: string | null;
  files: Submission['files'];
  notes: string;
}>;

function toUpdateRowPatch(patch: UpdatablePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status !== undefined)    out.status = patch.status;
  if (patch.feedback !== undefined)  out.feedback = patch.feedback;
  if (patch.permalink !== undefined) out.permalink = patch.permalink;
  if (patch.files !== undefined)     out.files = patch.files;
  if (patch.notes !== undefined)     out.notes = patch.notes;
  return out;
}

export async function fetchAllSubmissionsFromSupabase(): Promise<Submission[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data, error } = await sb.from('submissions').select(COLUMNS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[submissionsRepo] fetchAll failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => toSubmission(r as unknown as Row));
}

export async function insertSubmissionInSupabase(s: Submission): Promise<Submission> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('submissions')
    .insert(toInsertRow(s))
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Insert returned no row');
  return toSubmission(data as unknown as Row);
}

export async function updateSubmissionInSupabase(
  submissionId: string,
  patch: UpdatablePatch,
): Promise<Submission> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const sb = getSupabase();
  const rowPatch = toUpdateRowPatch(patch);
  const { data, error } = await sb
    .from('submissions')
    .update(rowPatch)
    .eq('id', submissionId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Submission not found');
  return toSubmission(data as unknown as Row);
}
