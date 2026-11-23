'use client';

import { Sparkles, Coins, Flame, BookOpen } from 'lucide-react';
import { getCultivationInfo } from 'shared';
import { Card } from '@/components/ui/card';
import { RealmBadge } from '@/components/ui/realm-badge';

interface RealmProgressCardProps {
  displayName: string;
  level: number;
  experience: number;
  totalExperience: number;
  coins: number;
  loginStreak: number;
  chaptersReadCount: number;
}

export function RealmProgressCard({
  displayName,
  level,
  experience,
  totalExperience,
  coins,
  loginStreak,
  chaptersReadCount,
}: RealmProgressCardProps) {
  const info = getCultivationInfo(level, experience);

  return (
    <Card className="relative overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RealmBadge level={level} experience={experience} showSubStage size="md" />
            <span className="text-xs font-semibold text-[var(--text-muted)]">Cấp {info.level}</span>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            {displayName}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">{info.realm.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-center">
            <Coins className="mx-auto mb-1 h-4 w-4 text-[var(--accent-warm)]" />
            <p className="text-base font-bold text-[var(--text-primary)]">{coins.toLocaleString('vi-VN')}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Xu Linh Thạch</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-center">
            <Flame className="mx-auto mb-1 h-4 w-4 text-[var(--accent-warm)]" />
            <p className="text-base font-bold text-[var(--text-primary)]">{loginStreak} ngày</p>
            <p className="text-[11px] text-[var(--text-muted)]">Chuỗi liên tục</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-center">
            <BookOpen className="mx-auto mb-1 h-4 w-4 text-[var(--accent-primary)]" />
            <p className="text-base font-bold text-[var(--text-primary)]">{chaptersReadCount}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Chương đã đọc</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1 text-[var(--accent-primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            Linh lực cấp hiện tại: {info.currentXp.toLocaleString('vi-VN')} / {info.nextLevelXp.toLocaleString('vi-VN')} XP
          </span>
          <span className="text-[var(--text-muted)]">
            Tổng tu vi: {totalExperience.toLocaleString('vi-VN')} XP
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-warm)] transition-all duration-500"
            style={{ width: `${info.progressPercent}%` }}
          />
        </div>
        {info.nextRealm && (
          <p className="text-xs text-[var(--text-muted)]">
            Đột phá tiếp theo: <strong className="text-[var(--text-secondary)]">{info.nextRealm.name}</strong> (Cấp {info.nextRealm.minLevel})
          </p>
        )}
      </div>
    </Card>
  );
}
