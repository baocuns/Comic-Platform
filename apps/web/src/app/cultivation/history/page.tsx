'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  HistoryTransactionItem,
  HistoryResponse,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationHistoryPage() {
  const { accessToken } = useAuthStore();
  const [filterType, setFilterType] = useState<'ALL' | 'XP' | 'COIN'>('ALL');
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<HistoryResponse['data'] | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await cultivationApi.getHistory(accessToken, 50);
        if (isMounted && res.success) {
          setHistoryData(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải lịch sử tu hành:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const defaultTransactions: HistoryTransactionItem[] = [
    {
      id: '1',
      type: 'XP',
      amount: 100,
      source: 'daily_login',
      sourceId: '2026-11-04',
      balanceAfter: 14850,
      note: 'Tọa thiền tụ khí nhật khóa',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'COIN',
      amount: 5,
      source: 'daily_login',
      sourceId: '2026-11-04',
      balanceAfter: 3250,
      note: 'Thưởng Linh Thạch điểm danh',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      type: 'XP',
      amount: 80,
      source: 'quest_claim',
      sourceId: 'read_5_chapters',
      balanceAfter: 14750,
      note: 'Thưởng nhiệm vụ: Đọc 5 chương truyện mới',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '4',
      type: 'XP',
      amount: 25,
      source: 'read_chapter',
      sourceId: 'chap-152',
      balanceAfter: 14670,
      note: 'Đọc chương: Đại Quản Gia Là Ma Hoàng #152',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: '5',
      type: 'COIN',
      amount: 20,
      source: 'level_up',
      sourceId: 'lvl-24',
      balanceAfter: 3245,
      note: 'Đột phá Kim Đan Tầng 4 thành công',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const transactions = historyData?.transactions?.length
    ? historyData.transactions
    : defaultTransactions;

  const checkedDates = new Set(historyData?.checkedDates || []);

  const filtered = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  // Tạo mảng 28 ngày gần nhất cho Heatmap
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const str = d.toISOString().slice(0, 10);
    return {
      dateStr: str,
      dayNum: d.getDate(),
      monthNum: d.getMonth() + 1,
      isChecked: checkedDates.has(str) || i >= 20, // dummy fallback
    };
  });

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Sub-Navigation Bar */}
      <CultivationNav />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
              Nhật Ký Đạo Pháp • Dấu Chân Tu Hành
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-[#FF7A1A]" />
              <span>Lịch Sử Tu Hành & Biến Động Chân Khí</span>
            </h1>
          </div>
        </div>

        {/* Lịch Tọa Thiền Tụ Khí 28 ngày (Heatmap Grid) */}
        <section className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-calendar-check text-[#FF7A1A]" />
              <span>Lịch Tọa Thiền Tụ Khí (4 Tuần Gần Nhất)</span>
            </h2>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
              Chuỗi hiện tại: 42 ngày liên tục
            </span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 lg:grid-cols-28 gap-1.5 pt-2">
            {days.map((d) => (
              <div
                key={d.dateStr}
                className={`p-2 rounded-xl text-center border flex flex-col items-center justify-center transition-all ${
                  d.isChecked
                    ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                    : 'bg-zinc-100 dark:bg-white/5 border-zinc-200/50 text-zinc-400'
                }`}
                title={d.dateStr}
              >
                <span className="text-[10px] font-bold block">{d.dayNum}/{d.monthNum}</span>
                <i className={`fa-solid ${d.isChecked ? 'fa-check' : 'fa-minus'} text-[10px] mt-0.5`} />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-white/5">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Đã tọa thiền (+100 EXP)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-zinc-200 dark:bg-white/10 inline-block" /> Chưa thiền
            </span>
          </div>
        </section>

        {/* Biến Động Tu Vi & Filter Tabs */}
        <section className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-white/5 pb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Dòng Thời Gian Biến Động Đạo Khí
            </h2>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-[#FF7A1A] text-white'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Tất Cả
              </button>
              <button
                type="button"
                onClick={() => setFilterType('XP')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'XP'
                    ? 'bg-[#FF7A1A] text-white'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Chân Khí (EXP)
              </button>
              <button
                type="button"
                onClick={() => setFilterType('COIN')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'COIN'
                    ? 'bg-[#FF7A1A] text-white'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Linh Thạch
              </button>
            </div>
          </div>

          {/* Transaction list */}
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {filtered.map((t) => {
              const isPositive = t.amount >= 0;
              const isXp = t.type === 'XP';

              return (
                <div key={t.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isXp
                          ? 'bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A]'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                      }`}
                    >
                      <i className={`fa-solid ${isXp ? 'fa-sparkles' : 'fa-gem'}`} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {t.note || (isXp ? 'Nhận Chân Khí EXP' : 'Biến động Linh Thạch')}
                      </p>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(t.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-extrabold block ${
                        isPositive ? (isXp ? 'text-[#FF7A1A]' : 'text-emerald-600') : 'text-red-500'
                      }`}
                    >
                      {isPositive ? `+${t.amount}` : t.amount} {isXp ? 'EXP' : 'Thạch'}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Số dư: {t.balanceAfter.toLocaleString()}
                    </span>
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

