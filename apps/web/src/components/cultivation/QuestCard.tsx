'use client';

import { CheckCircle2, Coins, Sparkles } from 'lucide-react';
import type { QuestItem } from 'shared';
import { Button } from '@/components/ui/button';

interface QuestCardProps {
  quest: QuestItem;
  onClaim?: (questId: string) => Promise<void>;
  claimingId?: string | null;
  isAuthenticated?: boolean;
}

export function QuestCard({ quest, onClaim, claimingId, isAuthenticated }: QuestCardProps) {
  const pct = Math.min(100, Math.round((quest.progress / Math.max(1, quest.targetCount)) * 100));
  const claimed = !!quest.claimedAt;

  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{quest.title}</h4>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-primary)]">
            <Sparkles className="h-3 w-3" />+{quest.rewardXp} XP
          </span>
          {quest.rewardCoins > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-warm-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-warm)]">
              <Coins className="h-3 w-3" />+{quest.rewardCoins} Xu
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{quest.description}</p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                quest.isCompleted ? 'bg-[var(--success)]' : 'bg-[var(--accent-primary)]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {quest.progress}/{quest.targetCount}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {claimed ? (
          <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--success-soft)] px-3 py-2 text-xs font-semibold text-[var(--success)]">
            <CheckCircle2 className="h-4 w-4" />
            Đã nhận thưởng
          </span>
        ) : quest.isCompleted && isAuthenticated && onClaim ? (
          <Button
            size="sm"
            variant="warm"
            isLoading={claimingId === quest.id}
            onClick={() => onClaim(quest.id)}
          >
            Nhận thưởng
          </Button>
        ) : (
          <span className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            Đang tiến hành
          </span>
        )}
      </div>
    </div>
  );
}
