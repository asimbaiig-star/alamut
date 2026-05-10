import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  link?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  noBody?: boolean;
}

export function Card({ title, link, children, bodyClassName, noBody }: CardProps) {
  return (
    <div className="card">
      {(title || link) && (
        <div className="card-h">
          {title && <span className="card-title">{title}</span>}
          {link}
        </div>
      )}
      {noBody ? children : <div className={['card-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>}
    </div>
  );
}
