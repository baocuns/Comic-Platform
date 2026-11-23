'use client';

import { Sparkles } from 'lucide-react';
import { getCultivationInfo } from 'shared';
import { useTheme } from '@/components/providers/theme-provider';

interface RealmBadgeProps {
  level?: number | null;
  experience?: number | null;
  showSubStage?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function RealmBadge({
  level = 1,
  experience = 0,
  showSubStage = false,
  size = 'sm',
  className = '',
}: RealmBadgeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const info = getCultivationInfo(level || 1, experience || 0);
  const { realm } = info;

  return (
    <span
      style={{
        color: realm.color,
        backgroundColor: isDark ? realm.bgDark : realm.bgLight,
        borderColor: isDark ? realm.borderDark : realm.borderLight,
      }}
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
      title={`${info.fullTitle} (Cấp ${info.level})`}
    >
      <Sparkles className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      <span>{showSubStage ? info.fullTitle : realm.name}</span>
    </span>
  );
}
