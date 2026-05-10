import type { ReactNode } from 'react';
import { Label } from '../ui/Label';

interface PageHeadProps {
  num?: string;
  label?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHead({ num, label, title, lede, actions, children }: PageHeadProps) {
  return (
    <div className="page-head">
      <div>
        {label && <Label num={num}>{label}</Label>}
        <h1 className="page-h1">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
        {children}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}
