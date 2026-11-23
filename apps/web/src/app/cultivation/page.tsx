'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles, Trophy, ScrollText, Coins, History } from 'lucide-react';
import {
  CULTIVATION_REALMS,
  QuestType,
  type QuestItem,
  type RewardTransactionItem,
  type CultivationRealm,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { formatRelativeTime } from '@/lib/format';
import { RealmProgressCard } from '@/components/cultivation/RealmProgressCard';
import { DailyCheckInCard } from '@/components/cultivation/DailyCheckInCard';
import { QuestCard } from '@/components/cultivation/QuestCard';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { RealmBadge } from '@/components/ui/realm-badge';
import { Button } from '@/components/ui/button';

interface MyCultivationResponse {
  profile: {
    displayName: string;
    coins: number;
    experience: number;
    totalExperience: number;
    level: number;
    loginStreak: number;
    chaptersReadCount: number;
    checkedInToday: boolean;
  };
  quests: QuestItem[];
  recentTransactions: RewardTransactionItem[];
  realms: CultivationRealm[];
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  experience: number;
  totalExperience: number;
  loginStreak: number;
  chaptersReadCount: number;
}

export default function CultivationPage() {
  const { user, accessToken, fetchProfile } = useAuthStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { toast } = useToast();

  const [tab, setTab] = useState<'quests' | 'realms' | 'leaderboard' | 'ledger'>('quests');
  const [myData, setMyData] = useState<MyCultivationResponse | null>(null);
  const [publicQuests, setPublicQuests] = useState<QuestItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderMetric, setLeaderMetric] = useState<'xp' | 'streak' | 'chapters'>('xp');
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const loadCultivation = useCallback(async (signal?: AbortSignal) => {
    if (accessToken) {
      try {
        const res = await api.get<{ data: MyCultivationResponse }>('/gamification/me', {
          token: accessToken,
          signal,
        });
        if (!signal?.aborted) setMyData(res.data);
      } catch {
        // Ignore
      }
    } else {
      api
        .get<{ data: QuestItem[] }>('/gamification/quests', { signal })
        .then((r) => {
          if (!signal?.aborted) setPublicQuests(r.data || []);
        })
        .catch(() => {});
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    loadCultivation(controller.signal);
    return () => controller.abort();
  }, [loadCultivation]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ data: LeaderboardEntry[] }>(`/gamification/leaderboard?metric=${leaderMetric}&limit=20`, {
        signal: controller.signal,
      })
      .then((r) => {
        if (!controller.signal.aborted) setLeaderboard(r.data || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [leaderMetric]);

  const handleCheckIn = async () => {
    if (!accessToken || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await api.post<{ data: { alreadyCheckedIn: boolean; xpEarned: number; coinsEarned: number } }>(
        '/gamification/check-in',
        {},
        { token: accessToken },
      );
      if (res.data.alreadyCheckedIn) {
        toast.info('Hôm nay bạn đã điểm danh rồi!');
      } else {
        toast.success(`Điểm danh thành công! +${res.data.xpEarned} XP, +${res.data.coinsEarned} Xu`);
      }
      await Promise.all([loadCultivation(), fetchProfile()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi điểm danh');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    if (!accessToken || claimingId) return;
    setClaimingId(questId);
    try {
      const res = await api.post<{ data: { rewardXp: number; rewardCoins: number } }>(
        `/gamification/quests/${questId}/claim`,
        {},
        { token: accessToken },
      );
      toast.success(`Nhận thưởng +${res.data.rewardXp} XP và +${res.data.rewardCoins} Xu!`);
      await Promise.all([loadCultivation(), fetchProfile()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể nhận thưởng');
    } finally {
      setClaimingId(null);
    }
  };

  const quests = myData?.quests || publicQuests;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-1">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
          <Sparkles className="h-4 w-4" />
          Hệ Sinh Thái Đạo Lộ
        </p>
        <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Tàng Kinh Các · Tu Luyện</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Đọc truyện, bình luận và hoàn thành nhiệm vụ để đột phá 9 tầng Cảnh Giới và tích lũy Xu Linh Thạch.
        </p>
      </div>

      {user && myData ? (
        <div className="space-y-5">
          <RealmProgressCard
            displayName={myData.profile.displayName}
            level={myData.profile.level}
            experience={myData.profile.experience}
            totalExperience={myData.profile.totalExperience}
            coins={myData.profile.coins}
            loginStreak={myData.profile.loginStreak}
            chaptersReadCount={myData.profile.chaptersReadCount}
          />
          <DailyCheckInCard
            loginStreak={myData.profile.loginStreak}
            checkedInToday={myData.profile.checkedInToday}
            onCheckIn={handleCheckIn}
            isLoading={checkingIn}
          />
        </div>
      ) : (
        <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center bg-gradient-to-r from-[var(--accent-primary-soft)] to-[var(--accent-warm-soft)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Gia nhập Tàng Kinh Các ngay hôm nay
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Tặng ngay 30 Xu tân thủ khi đăng ký tài khoản để mở khóa chương VIP và đua top cảnh giới.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/login">
              <Button>Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <Button variant="warm">Đăng ký (+30 Xu)</Button>
            </Link>
          </div>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'quests', label: 'Nhiệm vụ', icon: <ScrollText className="h-4 w-4" /> },
          { value: 'realms', label: '9 Cảnh Giới', icon: <Sparkles className="h-4 w-4" /> },
          { value: 'leaderboard', label: 'Đạo Lộ Bảng', icon: <Trophy className="h-4 w-4" /> },
          ...(user ? [{ value: 'ledger' as const, label: 'Lịch sử Xu & XP', icon: <History className="h-4 w-4" /> }] : []),
        ]}
      />

      {tab === 'quests' && (
        <div className="space-y-6">
          {([
            { type: QuestType.DAILY, title: 'Nhiệm vụ Hàng Ngày' },
            { type: QuestType.WEEKLY, title: 'Nhiệm vụ Tuần' },
            { type: QuestType.MILESTONE, title: 'Cột mốc Thành Tựu' },
          ] as const).map((group) => {
            const list = quests.filter((q) => q.type === group.type);
            if (list.length === 0) return null;
            return (
              <div key={group.type} className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.title}
                </h3>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {list.map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      isAuthenticated={!!user}
                      claimingId={claimingId}
                      onClaim={handleClaimQuest}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'realms' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CULTIVATION_REALMS.map((realm) => {
            const isCurrent =
              user && user.level >= realm.minLevel && user.level <= realm.maxLevel;
            return (
              <Card
                key={realm.index}
                className={isCurrent ? 'ring-2 ring-[var(--accent-primary)]' : ''}
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      color: realm.color,
                      backgroundColor: isDark ? realm.bgDark : realm.bgLight,
                      borderColor: isDark ? realm.borderDark : realm.borderLight,
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
                  >
                    Tầng {realm.index} · {realm.name}
                  </span>
                  <span className="font-serif text-lg font-bold text-[var(--text-muted)]">
                    {realm.hanViet}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold text-[var(--text-primary)]">
                  Cấp độ {realm.minLevel} — {realm.maxLevel > 500 ? '90+' : realm.maxLevel}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {realm.description}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: 'xp', l: 'Tổng Tu Vi (XP)' },
                { k: 'chapters', l: 'Số chương đã đọc' },
                { k: 'streak', l: 'Chuỗi điểm danh' },
              ] as const
            ).map((m) => (
              <button
                key={m.k}
                type="button"
                onClick={() => setLeaderMetric(m.k)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                  leaderMetric === m.k
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>

          <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
            {leaderboard.map((row) => (
              <Link
                key={row.id}
                href={`/@${row.username}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[var(--bg-subtle)]/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      row.rank <= 3
                        ? 'bg-[var(--accent-warm)] text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {row.rank}
                  </span>
                  <Avatar src={row.avatarUrl} name={row.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">{row.displayName}</p>
                      <RealmBadge level={row.level} experience={row.experience} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">@{row.username} · Cấp {row.level}</p>
                  </div>
                </div>
                <div className="text-right text-xs font-bold text-[var(--accent-primary)] shrink-0">
                  {leaderMetric === 'xp'
                    ? `${row.totalExperience.toLocaleString('vi-VN')} XP`
                    : leaderMetric === 'chapters'
                      ? `${row.chaptersReadCount} chương`
                      : `${row.loginStreak} ngày`}
                </div>
              </Link>
            ))}
          </Card>
        </div>
      )}

      {tab === 'ledger' && myData && (
        <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {myData.recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có giao dịch nào.</div>
          ) : (
            myData.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {tx.note || tx.source}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{formatRelativeTime(tx.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`inline-flex items-center gap-1 text-sm font-bold ${
                      tx.amount >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}
                  >
                    {tx.currency === 'COIN' && <Coins className="h-3.5 w-3.5" />}
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} {tx.currency === 'COIN' ? 'Xu' : 'XP'}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Số dư: {tx.balanceAfter.toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
