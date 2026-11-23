'use client';

import { CalendarCheck2, Check, Coins, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DailyCheckInCardProps {
  loginStreak: number;
  checkedInToday: boolean;
  onCheckIn: () => Promise<void>;
  isLoading?: boolean;
}

const DAYS = [
  { day: 1, label: 'Ngày 1', bonus: '+5 Xu' },
  { day: 2, label: 'Ngày 2', bonus: '+5 Xu' },
  { day: 3, label: 'Ngày 3', bonus: '+5 Xu' },
  { day: 4, label: 'Ngày 4', bonus: '+5 Xu' },
  { day: 5, label: 'Ngày 5', bonus: '+5 Xu' },
  { day: 6, label: 'Ngày 6', bonus: '+5 Xu' },
  { day: 7, label: 'Ngày 7', bonus: '+30 Xu' },
];

export function DailyCheckInCard({
  loginStreak,
  checkedInToday,
  onCheckIn,
  isLoading,
}: DailyCheckInCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-[var(--accent-warm)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Điểm danh Tụ Linh 7 Ngày</h3>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Điểm danh đều đặn mỗi ngày để tích lũy EXP và nhận rương Xu ngày thứ 7.
          </p>
        </div>

        <Button
          variant={checkedInToday ? 'secondary' : 'warm'}
          size="sm"
          disabled={checkedInToday}
          isLoading={isLoading}
          onClick={onCheckIn}
        >
          {checkedInToday ? (
            <>
              <Check className="h-4 w-4 text-[var(--success)]" />
              <span>Đã điểm danh hôm nay</span>
            </>
          ) : (
            <>
              <Flame className="h-4 w-4" />
              <span>Điểm danh ngay</span>
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAYS.map((d) => {
          const completed = d.day <= loginStreak;
          const isNext = !checkedInToday && d.day === (loginStreak % 7) + 1;
          return (
            <div
              key={d.day}
              className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                completed
                  ? 'border-[var(--success)]/35 bg-[var(--success-soft)]'
                  : isNext
                    ? 'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] ring-1 ring-[var(--accent-warm)]/30'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]'
              }`}
            >
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{d.label}</span>
              <div className="my-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)] shadow-2xs">
                {completed ? (
                  <Check className="h-4 w-4 text-[var(--success)]" />
                ) : (
                  <Coins className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                )}
              </div>
              <span className="text-[11px] font-bold text-[var(--text-primary)]">{d.bonus}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
