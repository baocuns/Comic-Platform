'use client';

interface TabOption<T extends string> {
  value: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string> {
  items: TabOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] ${
                  active
                    ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    : 'bg-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
