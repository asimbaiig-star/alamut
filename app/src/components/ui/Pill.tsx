import type { ReactNode } from 'react';
// Phase 20: import the canonical Tone union from the labels module so
// the Pill and `txTone()`/`stageTone()` etc. stay in lockstep.
import type { Tone } from '@/lib/utils/labels';

interface PillProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  // Adds a small pulsing dot before the label — for "live" / "in review" states
  // where the value is "this is happening right now."
  pulse?: boolean;
}

export function Pill({ tone = 'neutral', children, className, pulse }: PillProps) {
  const cls = ['pill'];
  if (tone !== 'neutral') cls.push(`pill-${tone}`);
  if (pulse) cls.push('pill-pulse');
  if (className) cls.push(className);
  return (
    <span className={cls.join(' ')}>
      {pulse && <span className="pill-pulse-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
