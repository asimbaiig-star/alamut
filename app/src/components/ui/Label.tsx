import type { ReactNode } from 'react';

interface LabelProps {
  num?: string;
  children: ReactNode;
  className?: string;
}

export function Label({ num, children, className }: LabelProps) {
  return (
    <span className={['label', className].filter(Boolean).join(' ')}>
      {num && <span className="label-num">{num}</span>}
      {children}
    </span>
  );
}
