'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  QuestItem,
  ChestMilestone,
  QuestsResponse,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationQuestsPage() {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'daily' | 'weekly'>('all');
  const [questsData, setQuestsData] = useState<QuestsResponse['data'] | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadQuests = async () => {
    if (!accessToken) return;
    try {
      const res = await cultivationApi.getQuests(accessToken);
      if (res.success) {
        setQuestsData(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải nhiệm vụ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuests();
  }, [accessToken]);

  const handleClaimQuest = async (questId: string) => {
    if (!accessToken) return;
    try {
      const res = await cultivationApi.claimQuest(questId, accessToken);
      if (res.success) {
        showToast(res.message, 'success');
        loadQuests();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi khi nhận thưởng', 'error');
    }
  };

  const handleClaimChest = async (milestone: number) => {
    if (!accessToken) return;
    try {
      const res = await cultivationApi.claimChest(milestone, accessToken);
      if (res.success) {
        showToast(res.message, 'success');
        loadQuests();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Không thể mở rương lúc này', 'error');
    }
  };

  const activityPoints = questsData?.activityPoints ?? 65;
  const chestMilestones: ChestMilestone[] = questsData?.chestMilestones ?? [
    { points: 20, rewardXp: 30, rewardCoins: 2, isClaimed: true },
    { points: 40, rewardXp: 50, rewardCoins: 5, isClaimed: true },
    { points: 60, rewardXp: 80, rewardCoins: 8, isClaimed: true },
    { points: 80, rewardXp: 120, rewardCoins: 12, isClaimed: false },
    { points: 100, rewardXp: 200, rewardCoins: 20, isClaimed: false },
  ];

  const allQuests: QuestItem[] = questsData?.quests ?? [
    {
      id: 'read_5_chapters',
      type: 'daily',
      tag: 'Nhật Khóa',
      title: 'Đọc 5 chương truyện mới',
      current: 5,
      target: 5,
      unit: 'chương',
      rewardXp: 80,
      rewardCoins: 10,
      rewardPoints: 25,
      rewardDisplay: '+80 EXP • +10 Linh Thạch',
      status: 'CLAIMABLE',
      actionUrl: '/the-loai',
      actionText: 'Đọc Truyện',
    },
    {
      id: 'daily_checkin',
      type: 'daily',
      tag: 'Nhật Khóa',
      title: 'Điểm danh tu luyện mỗi ngày',
      current: 1,
      target: 1,
      unit: 'lần',
      rewardXp: 100,
      rewardCoins: 5,
      rewardPoints: 20,
      rewardDisplay: '+100 EXP • +5 Linh Thạch',
      status: 'CLAIMED',
      actionUrl: '/cultivation',
      actionText: 'Tọa Thiền',
    },
    {
      id: 'comment_2_times',
      type: 'daily',
      tag: 'Nhật Khóa',
      title: 'Để lại 2 bình luận luận đạo có tâm',
      current: 1,
      target: 2,
      unit: 'bình luận',
      rewardXp: 60,
      rewardCoins: 5,
      rewardPoints: 20,
      rewardDisplay: '+60 EXP • +5 Linh Thạch',
      status: 'IN_PROGRESS',
      actionUrl: '/the-loai',
      actionText: 'Làm Ngay',
    },
    {
      id: 'bookmark_1_comic',
      type: 'daily',
      tag: 'Nhật Khóa',
      title: 'Theo dõi 1 bộ truyện mới',
      current: 1,
      target: 1,
      unit: 'bộ',
      rewardXp: 50,
      rewardCoins: 0,
      rewardPoints: 15,
      rewardDisplay: '+50 EXP',
      status: 'CLAIMED',
      actionUrl: '/the-loai',
      actionText: 'Khám Phá',
    },
    {
      id: 'read_3_hours_weekly',
      type: 'weekly',
      tag: 'Chu Kỳ Tuần',
      title: 'Tích lũy 3 giờ đọc truyện',
      current: 2.4,
      target: 3.0,
      unit: 'giờ',
      rewardXp: 300,
      rewardCoins: 20,
      rewardPoints: 50,
      rewardDisplay: '+300 EXP • 1 Rương Đan Dược Cổ',
      status: 'IN_PROGRESS',
      actionUrl: '/truyen-moi',
      actionText: 'Tiếp Tục Đọc',
    },
  ];

  const filteredQuests = allQuests.filter((q) => {
    if (activeTab === 'daily') return q.type === 'daily';
    if (activeTab === 'weekly') return q.type === 'weekly';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl transition-all animate-bounce ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <i className={`fa-solid ${toastMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-lg`} />
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Sub-Navigation Bar */}
      <CultivationNav />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
              Hành Tẩu Tu Tiên • Nhật Dạ Tu Hành
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Vấn Đạo Các • Hệ Thống Nhiệm Vụ Tu Luyện
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] text-xs font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-moon-stars" />
              <span>Ngộ Đạo Ban Đêm: 20h - 22h x2 Chân Khí</span>
            </span>
          </div>
        </div>

        {/* RƯƠNG ĐIỂM NĂNG ĐỘNG NGÀY */}
        <section className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-treasure-chest text-[#FF7A1A]" />
                <span>Rương Điểm Năng Động Nhật Khóa</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tích lũy điểm năng động khi hoàn thành các nhiệm vụ tu luyện hàng ngày
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-[#FF7A1A]">{activityPoints}</span>
              <span className="text-xs text-zinc-400"> / 100 Điểm</span>
            </div>
          </div>

          {/* Activity Progress Bar & Milestones */}
          <div className="relative pt-6 pb-2">
            {/* Track */}
            <div className="w-full h-3 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, activityPoints))}%` }}
              />
            </div>

            {/* Milestones Markers */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {chestMilestones.map((m) => {
                const canUnlock = activityPoints >= m.points && !m.isClaimed;

                return (
                  <div
                    key={m.points}
                    className="flex flex-col items-center text-center space-y-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => canUnlock && handleClaimChest(m.points)}
                      disabled={!canUnlock}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all ${
                        m.isClaimed
                          ? 'bg-zinc-100 dark:bg-white/5 text-zinc-400 border border-zinc-200/50 cursor-not-allowed'
                          : canUnlock
                          ? 'bg-gradient-to-tr from-amber-500 to-[#FF7A1A] text-white shadow-md hover:scale-110 active:scale-95 animate-bounce cursor-pointer'
                          : 'bg-zinc-50 dark:bg-white/5 text-zinc-300 dark:text-zinc-600 border border-zinc-200/40 cursor-not-allowed'
                      }`}
                    >
                      <i className={`fa-solid ${m.isClaimed ? 'fa-box-open' : 'fa-chest-packed'}`} />
                    </button>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      {m.points} Điểm
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      +{m.rewardCoins} Linh Thạch
                    </span>
                    {m.isClaimed ? (
                      <span className="text-[10px] font-bold text-zinc-400">Đã mở</span>
                    ) : canUnlock ? (
                      <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
                        Mở ngay
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400">Chưa đủ</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Filter Tabs & Quests List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#FF7A1A] text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Tất Cả ({allQuests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'daily'
                    ? 'bg-[#FF7A1A] text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Nhật Khóa
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'weekly'
                    ? 'bg-[#FF7A1A] text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Chu Kỳ Tuần
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredQuests.map((q) => {
              const isClaimable = q.status === 'CLAIMABLE';
              const isClaimed = q.status === 'CLAIMED';
              const percent = Math.min(100, Math.round((q.current / q.target) * 100));

              return (
                <div
                  key={q.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isClaimed
                      ? 'bg-white/60 dark:bg-[#141516]/50 border-zinc-200/50 dark:border-white/5 opacity-75'
                      : isClaimable
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm'
                      : 'bg-white dark:bg-[#141516] border-zinc-200/80 dark:border-white/10 shadow-sm'
                  }`}
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          q.type === 'weekly'
                            ? 'bg-[#E85D04] text-white'
                            : 'bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A]'
                        }`}
                      >
                        {q.tag}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                        {q.title}
                      </h3>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                        +{q.rewardPoints} Năng động
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-3">
                      <div className="w-48 sm:w-64 h-2.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isClaimed
                              ? 'bg-emerald-500 w-full'
                              : isClaimable
                              ? 'bg-emerald-500 w-full'
                              : q.type === 'weekly'
                              ? 'bg-amber-500'
                              : 'bg-[#FF7A1A]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {q.current} / {q.target} {q.unit} ({percent}%)
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                      <span>Phần thưởng:</span>
                      <span className="font-bold text-[#FF7A1A]">{q.rewardDisplay}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isClaimable ? (
                      <button
                        type="button"
                        onClick={() => handleClaimQuest(q.id)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-gift" />
                        <span>Nhận Thưởng</span>
                      </button>
                    ) : isClaimed ? (
                      <button
                        type="button"
                        disabled
                        className="px-5 py-2 bg-zinc-100 dark:bg-white/5 text-zinc-400 text-xs font-semibold rounded-xl cursor-not-allowed"
                      >
                        Đã Nhận
                      </button>
                    ) : (
                      <Link
                        href={q.actionUrl || '/comics'}
                        className="px-5 py-2 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                      >
                        {q.actionText || 'Làm Ngay'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

