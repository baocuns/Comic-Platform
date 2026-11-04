'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  LeaderboardRanker,
  LeaderboardResponse,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationLeaderboardPage() {
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'all' | 'weekly' | 'sect'>('all');
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<LeaderboardRanker[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardRanker | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const res = await cultivationApi.getLeaderboard(activeTab, accessToken || undefined);
        if (isMounted && res.success) {
          setTopUsers(res.data.topUsers);
          setCurrentUserRank(res.data.currentUserRank);
        }
      } catch (err) {
        console.error('Lỗi tải bảng phong thần:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [activeTab, accessToken]);

  const top1 = topUsers[0] || {
    rank: 1,
    id: '1',
    username: 'thaithuongkiemton',
    displayName: 'Thái Thượng Kiếm Tôn',
    avatarUrl: null,
    level: 39,
    realmName: 'Nguyên Anh Tầng 9',
    experience: 248900,
  };

  const top2 = topUsers[1] || {
    rank: 2,
    id: '2',
    username: 'namcungthienvu',
    displayName: 'Nam Cung Thiên Vũ',
    avatarUrl: null,
    level: 35,
    realmName: 'Nguyên Anh Tầng 5',
    experience: 186400,
  };

  const top3 = topUsers[2] || {
    rank: 3,
    id: '3',
    username: 'bachlientientu',
    displayName: 'Bạch Liên Tiên Tử',
    avatarUrl: null,
    level: 32,
    realmName: 'Nguyên Anh Tầng 2',
    experience: 142100,
  };

  const restRankers = topUsers.slice(3);

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Sub-Navigation Bar */}
      <CultivationNav />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header Title & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
              Quần Hùng Tranh Đấu • Vạn Giới Phong Thần
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-trophy text-[#FF7A1A]" />
              <span>Bảng Phong Thần Tu Tiên</span>
            </h1>
          </div>

          <div className="flex rounded-xl bg-zinc-100 dark:bg-white/5 p-1 gap-1">
            {(['all', 'weekly', 'sect'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white dark:bg-[#252628] text-[#FF7A1A] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? 'Toàn Máy Chủ' : tab === 'weekly' ? 'Chiến Tích Tuần' : 'Bảng Tông Môn'}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium (Quán Quân, Á Quân, Quý Quân) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Top 2: Á Quân */}
          <div className="order-2 md:order-1 bg-white dark:bg-[#141516] p-6 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center space-y-3 relative overflow-hidden">
            <span className="w-8 h-8 rounded-full bg-amber-400 text-white font-black text-sm flex items-center justify-center shadow-md">
              2
            </span>
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-amber-400 to-amber-200">
              <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden flex items-center justify-center font-bold text-base text-zinc-700 dark:text-white">
                {top2.avatarUrl ? (
                  <img src={top2.avatarUrl} alt={top2.displayName} className="w-full h-full object-cover" />
                ) : (
                  top2.displayName.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">{top2.displayName}</h3>
              <p className="text-xs text-[#FF7A1A] font-semibold">{top2.realmName}</p>
            </div>
            <div className="text-center pt-2 border-t border-zinc-100 dark:border-white/5 w-full">
              <span className="text-base font-extrabold text-zinc-900 dark:text-white block">
                {top2.experience.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Chân Khí EXP</span>
            </div>
          </div>

          {/* Top 1: Quán Quân */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-orange-50/80 via-white to-amber-50/50 dark:from-orange-950/40 dark:via-[#141516] dark:to-[#141516] p-6 rounded-2xl border-2 border-[#FF7A1A] shadow-lg flex flex-col items-center text-center space-y-3 relative transform md:-translate-y-2">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-[#FF7A1A] to-amber-400" />
            <span className="w-10 h-10 rounded-full bg-[#FF7A1A] text-white font-black text-base flex items-center justify-center shadow-md">
              <i className="fa-solid fa-crown" />
            </span>
            <div className="w-24 h-24 rounded-full p-1.5 bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-300 shadow-md">
              <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden flex items-center justify-center font-black text-xl text-zinc-700 dark:text-white">
                {top1.avatarUrl ? (
                  <img src={top1.avatarUrl} alt={top1.displayName} className="w-full h-full object-cover" />
                ) : (
                  top1.displayName.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF7A1A] text-white text-[10px] font-extrabold uppercase">
                Đệ Nhất Cao Thủ
              </span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-1">{top1.displayName}</h3>
              <p className="text-xs text-[#FF7A1A] font-bold">{top1.realmName}</p>
            </div>
            <div className="text-center pt-2 border-t border-zinc-100 dark:border-white/5 w-full">
              <span className="text-xl font-black text-[#FF7A1A] block">
                {top1.experience.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Chân Khí Đỉnh Phong</span>
            </div>
          </div>

          {/* Top 3: Quý Quân */}
          <div className="order-3 bg-white dark:bg-[#141516] p-6 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center space-y-3 relative overflow-hidden">
            <span className="w-8 h-8 rounded-full bg-amber-600 text-white font-black text-sm flex items-center justify-center shadow-md">
              3
            </span>
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-amber-600 to-amber-300">
              <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden flex items-center justify-center font-bold text-base text-zinc-700 dark:text-white">
                {top3.avatarUrl ? (
                  <img src={top3.avatarUrl} alt={top3.displayName} className="w-full h-full object-cover" />
                ) : (
                  top3.displayName.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">{top3.displayName}</h3>
              <p className="text-xs text-[#FF7A1A] font-semibold">{top3.realmName}</p>
            </div>
            <div className="text-center pt-2 border-t border-zinc-100 dark:border-white/5 w-full">
              <span className="text-base font-extrabold text-zinc-900 dark:text-white block">
                {top3.experience.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Chân Khí EXP</span>
            </div>
          </div>
        </div>

        {/* Top 4 to 30 List */}
        <section className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Bảng Xếp Hạng Các Vị Tiên Hữu (Top 4 - 30)
          </h2>

          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {restRankers.map((rk) => (
              <div key={rk.id} className="py-3.5 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-white/5 px-2 rounded-xl transition-colors">
                <span className="w-7 text-center font-bold text-sm text-zinc-500">
                  {rk.rank}
                </span>

                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-white shrink-0">
                  {rk.avatarUrl ? (
                    <img src={rk.avatarUrl} alt={rk.displayName} className="w-full h-full object-cover" />
                  ) : (
                    rk.displayName.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                      {rk.displayName}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                      Cấp {rk.level}
                    </span>
                  </div>
                  <span className="text-xs text-[#FF7A1A]">{rk.realmName}</span>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-[#FF7A1A] block">
                    {rk.experience.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-400">EXP</span>
                </div>
              </div>
            ))}
          </div>

          {/* Floating Current User Rank */}
          {currentUserRank && (
            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-[#FF7A1A]/40 flex items-center justify-between gap-4 shadow-sm mt-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#FF7A1A] text-white font-black text-xs flex items-center justify-center shrink-0">
                  {currentUserRank.rank}
                </span>
                <div>
                  <span className="text-sm font-bold text-[#FF7A1A] block">
                    Vị Trí Của Bạn ({currentUserRank.displayName})
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {currentUserRank.realmName} • Cấp {currentUserRank.level}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-[#FF7A1A] block">
                  {currentUserRank.experience.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">EXP</span>
              </div>
            </div>
          )}
        </section>

        {/* Bổng Lộc Mùa Giải Tu Tiên */}
        <section className="bg-gradient-to-r from-orange-50 via-white to-amber-50 dark:from-[#161718] dark:via-[#141516] dark:to-orange-950/20 p-6 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-gift text-[#FF7A1A]" />
              <span>Bổng Lộc Mùa Giải Tu Tiên Kỷ (Mùa 1)</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tổng kết và phát thưởng vinh danh vào ngày cuối cùng của mỗi tháng
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#1a1b1c] p-4 rounded-xl border border-amber-300/40 shadow-xs space-y-1">
              <span className="text-xs font-bold text-amber-500 block">Hạng 1 (Quán Quân)</span>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold">+2,000 Linh Thạch</p>
              <p className="text-[11px] text-zinc-500">Khung Vương Miện Tiên Tôn độc bản 30 ngày</p>
            </div>
            <div className="bg-white dark:bg-[#1a1b1c] p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 space-y-1">
              <span className="text-xs font-bold text-orange-500 block">Hạng 2 - 3</span>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold">+1,000 Linh Thạch</p>
              <p className="text-[11px] text-zinc-500">Khung Kim Đan Huyễn Ảo 30 ngày</p>
            </div>
            <div className="bg-white dark:bg-[#1a1b1c] p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 space-y-1">
              <span className="text-xs font-bold text-emerald-500 block">Hạng 4 - 10</span>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold">+500 Linh Thạch</p>
              <p className="text-[11px] text-zinc-500">Huy hiệu Tông Sư Luận Đạo</p>
            </div>
            <div className="bg-white dark:bg-[#1a1b1c] p-4 rounded-xl border border-zinc-200/60 dark:border-white/5 space-y-1">
              <span className="text-xs font-bold text-zinc-500 block">Hạng 11 - 50</span>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold">+200 Linh Thạch</p>
              <p className="text-[11px] text-zinc-500">Rương Đan Dược Thượng Phẩm</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

