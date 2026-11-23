import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

export function Card({ className = '', padded = true, interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${padded ? 'p-5' : ''} ${
        interactive ? 'transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-md' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
