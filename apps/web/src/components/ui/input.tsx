'use client';

import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, leftIcon, rightSlot, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id || autoId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-[var(--text-muted)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`h-10 w-full rounded-xl border bg-[var(--bg-surface)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 ${
              error
                ? 'border-[var(--danger)] focus:border-[var(--danger)]'
                : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]'
            } ${leftIcon ? 'pl-10' : ''} ${rightSlot ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightSlot && <div className="absolute right-2.5 flex items-center">{rightSlot}</div>}
        </div>
        {error && <p className="text-xs font-medium text-[var(--danger)]">{error}</p>}
        {!error && hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id || autoId;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`w-full rounded-xl border bg-[var(--bg-surface)] p-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 ${
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--border-subtle)] focus:border-[var(--accent-primary)]'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
