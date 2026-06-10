'use client';

import { useEffect, useState } from 'react';

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  suffix?: string;
  gradient?: string;
}

export function StatCard({ icon, label, value, suffix = '', gradient = 'from-violet-500 to-fuchsia-500' }: StatCardProps) {
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
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      {/* Gradient glow on hover */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20`} />

      <div className="relative">
        <div className="mb-3 flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-lg shadow-lg shadow-violet-500/10`}>
            {icon}
          </div>
          <span className="text-sm text-zinc-500">{label}</span>
        </div>
        <div className="text-2xl font-bold text-white tabular-nums">
          {displayValue.toLocaleString('vi-VN')}{suffix}
        </div>
      </div>
    </div>
  );
}
