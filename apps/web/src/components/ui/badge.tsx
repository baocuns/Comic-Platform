import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'warm' | 'success' | 'warning' | 'danger' | 'outline';
}

const variantMap: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-transparent',
  primary: 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border-transparent',
  warm: 'bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] border-transparent',
  success: 'bg-[var(--success-soft)] text-[var(--success)] border-transparent',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-transparent',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-transparent',
  outline: 'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]',
};

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-tight ${variantMap[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
