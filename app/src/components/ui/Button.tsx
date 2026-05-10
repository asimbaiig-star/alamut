import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

type Variant = 'solid' | 'ghost' | 'plain' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', icon, iconRight, loading, disabled, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('btn', `btn-${size}`, `btn-${variant}`, loading && 'is-loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon}
      {loading ? 'Working…' : children}
      {!loading && iconRight}
    </button>
  );
});
