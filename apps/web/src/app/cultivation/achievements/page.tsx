'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  AchievementItem,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationAchievementsPage() {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadAchievements() {
      setLoading(true);
      try {
        if (accessToken) {
          const res = await cultivationApi.getAchievements(accessToken);
          if (isMounted && res.success) {
            setAchievements(res.data);
          }
        }
      } catch (err) {
        console.error('Lỗi tải thành tựu:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAchievements();
    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const defaultAchievements: AchievementItem[] = [
    {
      id: 'ancient_bookworm',
      category: 'Đọc Truyện',
      name: 'Mọt Sách Thượng Cổ',
      description: 'Đọc trên 500 chương truyện tranh',
      icon: 'book-open',
      tier: 'BẬC III',
      rewardCoins: 100,
      isUnlocked: true,
      progress: '520/500',
    },
    {
      id: 'discussion_master',
      category: 'Luận Đạo',
      name: 'Tông Sư Luận Đạo',
      description: 'Nhận 200 lượt thích cho các bình luận luận đạo',
      icon: 'comments',
      tier: 'BẬC II',
      rewardCoins: 80,
      isUnlocked: true,
      progress: '215/200',
    },
    {
      id: 'reincarnation_warrior',
      category: 'Khám Phá',
      name: 'Chiến Binh Trùng Sinh',
      description: 'Đọc và lưu vào tủ truyện 10 bộ truyện trọng sinh',
      icon: 'rotate-right',
      tier: 'BẬC I',
      rewardCoins: 50,
      isUnlocked: true,
      progress: '10/10',
    },
    {
      id: 'owoc_guardian',
      category: 'Tu Hành',
      name: 'Hộ Pháp OWOC',
      description: 'Gắn bó tu hành cùng OWOC trên 100 ngày',
      icon: 'shield-halved',
      tier: 'VINH DANH',
      rewardCoins: 200,
      isUnlocked: true,
      progress: '100/100',
    },
    {
      id: 'immortal_tycoon',
      category: 'Cống Hiến',
      name: 'Vạn Cổ Phú Hào',
      description: 'Tích lũy đạt mốc 1,000 Linh Thạch OWOC',
      icon: 'gem',
      tier: 'BẬC III',
      rewardCoins: 150,
      isUnlocked: true,
      progress: '3,250/1000',
    },
    {
      id: 'realm_sovereign',
      category: 'Tu Hành',
      name: 'Đế Vương Tiên Tôn',
      description: 'Đột phá đạt cảnh giới Nguyên Anh trở lên',
      icon: 'crown',
      tier: 'THƯỢNG CỔ',
      rewardCoins: 300,
      isUnlocked: false,
      progress: 'Kim Đan Tầng 4',
    },
  ];

  const list = achievements.length > 0 ? achievements : defaultAchievements;
  const filtered = list.filter((a) => {
    if (activeCategory === 'all') return true;
    return a.category === activeCategory;
  });

  const unlockedCount = list.filter((a) => a.isUnlocked).length;

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Sub-Navigation Bar */}
      <CultivationNav />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header Title & Progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
              Bách Khoa Thành Tựu • Vạn Thế Lưu Danh
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-award text-[#FF7A1A]" />
              <span>Tàng Bảo Các & Thành Tựu Tu Luyện</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] text-xs font-bold">
              Đã Kích Hoạt: {unlockedCount} / {list.length} Thành Tựu
            </span>
          </div>
        </div>

        {/* Filter Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {['all', 'Đọc Truyện', 'Luận Đạo', 'Tu Hành', 'Cống Hiến', 'Khám Phá'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#FF7A1A] text-white shadow-sm'
                  : 'bg-white dark:bg-[#141516] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/10 hover:border-zinc-300'
              }`}
            >
              {cat === 'all' ? 'Tất Cả Thành Tựu' : cat}
            </button>
          ))}
        </div>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ach) => (
            <div
              key={ach.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                ach.isUnlocked
                  ? 'bg-white dark:bg-[#141516] border-zinc-200/80 dark:border-white/10 shadow-sm hover:border-[#FF7A1A]/50'
                  : 'bg-[#F6F3F2]/60 dark:bg-white/5 border-zinc-200/40 dark:border-white/5 opacity-65'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        ach.isUnlocked
                          ? 'bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] shadow-sm'
                          : 'bg-zinc-200 dark:bg-white/10 text-zinc-400'
                      }`}
                    >
                      <i className={`fa-solid fa-${ach.icon || 'award'}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{ach.name}</h3>
                      <span className="text-[11px] text-zinc-400">{ach.category}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                      ach.isUnlocked
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-400'
                    }`}
                  >
                    {ach.tier}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {ach.description}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs mt-4">
                <span className="font-semibold text-zinc-500">
                  Tiến độ: <strong>{ach.progress}</strong>
                </span>
                <span className="font-bold text-[#FF7A1A] flex items-center gap-1">
                  <i className="fa-solid fa-gem text-[10px]" />
                  <span>+{ach.rewardCoins} Linh Thạch</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Đổi Bổng Lộc Tàng Bảo Các */}
        <section className="bg-gradient-to-r from-orange-50 via-white to-amber-50 dark:from-[#161718] dark:via-[#141516] dark:to-orange-950/20 p-6 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-store text-[#FF7A1A]" />
                <span>Đổi Bổng Lộc Tàng Bảo Các</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sử dụng Linh Thạch nhận được từ thành tựu để đổi các đặc quyền tu tiên
              </p>
            </div>
            <Link
              href="/cultivation/inventory"
              className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E85D04] text-white text-xs font-bold rounded-xl shadow-sm transition-all text-center"
            >
              Mở Túi Trữ Vật & Tiệm
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

