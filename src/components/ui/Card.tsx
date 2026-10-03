import React from 'react';
import { elevation } from '../../design/tokens';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 'flat' | 'raised' | 'popover';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const shadows: Record<NonNullable<CardProps['level']>, string> = {
  flat: 'none',
  raised: elevation.md,
  popover: elevation.popover,
};

const paddings: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/** Surface card on the canvas scale. Default: subtle surface, 16px radius. */
export const Card: React.FC<CardProps> = ({
  level = 'flat',
  padding = 'md',
  className = '',
  style,
  children,
  ...rest
}) => (
  <div
    className={`bg-canvas-subtle border border-canvas-border rounded-2xl ${paddings[padding]} ${className}`}
    style={{ boxShadow: shadows[level], ...style }}
    {...rest}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

/** Consistent card header: overline-free, title + optional action slot. */
export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div>
      <h3 className="text-content-primary font-bold text-base leading-tight">{title}</h3>
      {subtitle ? <p className="text-content-muted text-xs mt-1">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);
