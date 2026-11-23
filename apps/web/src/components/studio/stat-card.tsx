import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
        <p className="mt-1 font-serif text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</p>}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
        {icon}
      </div>
    </Card>
  );
}
