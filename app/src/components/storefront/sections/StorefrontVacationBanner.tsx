// StorefrontVacationBanner · v2 design sync (§5.1)
//
// Renders the gold-tinted vacation notice when the creator is on vacation
// mode. Returns null otherwise so the wrapper can drop it in
// unconditionally. Single source of truth for vacation copy + tone — both
// the public surface and the workspace preview consume this.

import type { Creator } from '@/lib/api/types';

interface Props {
  creator: Creator;
  /** `mode` is currently visual-identical across modes; the prop stays
   *  for parity with the other 7 sections so the snapshot test composes
   *  them with one shape. */
  mode: 'preview' | 'public';
}

export function StorefrontVacationBanner({ creator }: Props) {
  if (!creator.availability?.vacationMode) return null;

  const firstName = creator.name.split(' ')[0];
  const back = creator.availability.untilDate
    ? ` — back ${new Date(creator.availability.untilDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })}.`
    : '.';

  return (
    <div className="v2-storefront-vacation" role="status">
      <strong>✈ {firstName} is on vacation</strong>
      {back} Briefs and DMs will receive a delayed reply.
      {creator.availability.note ? ` ${creator.availability.note}` : ''}
    </div>
  );
}
