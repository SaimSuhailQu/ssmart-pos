import React from 'react';
import { intent, Intent, touch } from '../../design/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'touch';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  intent?: Intent;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-200 hover:bg-brand-100 text-canvas border border-brand-300/60 shadow-[0_4px_16px_rgba(237,237,234,0.28)] font-extrabold',
  secondary: 'bg-canvas-card hover:bg-canvas-hover text-content-primary border border-canvas-border',
  ghost: 'bg-transparent hover:bg-canvas-card text-content-secondary hover:text-content-primary border border-transparent',
  danger: 'bg-status-coral/15 hover:bg-status-coral/25 text-status-coral border border-status-coral/30',
  success: 'bg-status-emerald/15 hover:bg-status-emerald/25 text-status-emerald border border-status-emerald/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-sm',
  touch: 'h-14 px-6 text-base',
};

/**
 * Primary action button. Minimum 48×48 touch target on `touch` size;
 * `md`+ meet the minimum height via h-11 (44px) only for dense desktop
 * toolbars — POS tender actions must use `touch`.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, disabled, className = '', children, style, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{ minHeight: size === 'touch' ? touch.comfortable : size === 'lg' ? touch.min : undefined, ...style }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold',
        'transition-all duration-120 ease-out select-none cursor-pointer',
        'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { intent };
export type { Intent };
