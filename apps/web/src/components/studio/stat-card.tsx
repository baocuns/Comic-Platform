'use client';

import { useEffect, useState } from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  gradient?: string;
}

export function StatCard({ icon, label, value, suffix = '', gradient = 'from-amber-500 to-orange-500' }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), value);
      setDisplayValue(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3 sm:p-5 shadow-sm dark:shadow-none transition-all duration-300 hover:border-zinc-300 dark:hover:border-white/[0.12] hover:bg-zinc-50 dark:hover:bg-white/[0.04] cursor-pointer">
      {/* Gradient glow on hover */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20`} />

      <div className="relative">
        <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-2.5">
          <div className={`flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-sm sm:text-lg text-white shadow-lg shadow-amber-500/10`}>
            {icon}
          </div>
          <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate">{label}</span>
        </div>
        <div className="text-base sm:text-2xl font-bold text-zinc-900 dark:text-white tabular-nums tracking-tight">
          {displayValue.toLocaleString('vi-VN')}{suffix}
        </div>
      </div>
    </div>
  );
}
