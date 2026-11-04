'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  CultivationProfileResponse,
  RealmDefinitionItem,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationRealmsPage() {
  const { user, accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<CultivationProfileResponse['data'] | null>(null);
  const [realmsDef, setRealmsDef] = useState<RealmDefinitionItem[]>([]);
  const [isBreakingThrough, setIsBreakingThrough] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedRealmIdx, setSelectedRealmIdx] = useState<number>(3); // Mặc định Kim Đan

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const realmsRes = await cultivationApi.getRealms();
        if (isMounted && realmsRes.success) {
          setRealmsDef(realmsRes.data);
        }

        if (accessToken) {
          const profRes = await cultivationApi.getProfile(accessToken);
          if (isMounted && profRes.success) {
            setProfileData(profRes.data);
            setSelectedRealmIdx(profRes.data.realm.realmIndex);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu cảnh giới:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const handleBreakthrough = async () => {
    if (!accessToken) {
      showToast('Đạo hữu cần đăng nhập để tiến hành độ kiếp đột phá!', 'error');
      return;
    }

    setIsBreakingThrough(true);
    try {
      const res = await cultivationApi.breakthrough(accessToken);
      if (res.success) {
        showToast(res.message, 'success');
        // Refresh profile
        const profRes = await cultivationApi.getProfile(accessToken);
        if (profRes.success) {
          setProfileData(profRes.data);
          setSelectedRealmIdx(profRes.data.realm.realmIndex);
        }
      } else {
        showToast(res.message || 'Chưa đủ điều kiện độ kiếp!', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi xảy ra trong quá trình độ kiếp', 'error');
    } finally {
      setIsBreakingThrough(false);
    }
  };

  const currentLevel = profileData?.stats.level || 24;
  const currentRealm = profileData?.realm || {
    realmIndex: 3,
    realmName: 'Kim Đan',
    subLevel: 4,
    fullName: 'Kim Đan Tầng 4',
    title: 'Thiên Đạo Trúc Cơ',
    badge: 'Độc giả chân truyền OWOC #0024',
    privileges: [],
  };

  const expCurrent = profileData?.stats.experience ?? 14850;
  const xpMax = profileData?.stats.xpMax ?? 20000;
  const progressPercent = profileData?.stats.progressPercent ?? 74.25;
  const canBreakthrough = profileData?.stats.canBreakthrough ?? false;

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
      <CultivationNav
        currentStreak={profileData?.stats.loginStreak ?? 42}
        coins={profileData?.stats.coins ?? 3250}
      />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Hero: Current Realm & Breakthrough Control */}
        <section className="relative bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 lg:p-8 overflow-hidden">
          <div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-orange-400/10 pointer-events-none blur-3xl" />
          <div className="absolute right-1/3 -bottom-20 w-80 h-80 rounded-full bg-amber-400/10 pointer-events-none blur-2xl" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Realm Aura Display */}
            <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full p-2 bg-gradient-to-tr from-amber-500 via-orange-500 to-emerald-400 flex items-center justify-center shadow-lg animate-pulse">
                  <div className="w-full h-full rounded-full bg-[#FCF9F8] dark:bg-[#141516] flex flex-col items-center justify-center p-2 text-center">
                    <i className="fa-solid fa-sun-bright text-3xl text-[#FF7A1A] mb-1" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-white leading-tight">
                      {currentRealm.fullName}
                    </span>
                  </div>
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#FF7A1A] text-white text-[11px] font-extrabold whitespace-nowrap shadow-sm">
                  Cảnh Giới Thứ {currentRealm.realmIndex}
                </span>
              </div>

              <div className="space-y-1.5 text-center sm:text-left min-w-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] text-xs font-bold">
                  <i className="fa-solid fa-fire-flame-curved" />
                  <span>{currentRealm.title}</span>
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {currentRealm.fullName}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Cấp độ tu vi hiện tại: Cấp {currentLevel} • Thần thức sung mãn
                </p>
              </div>
            </div>

            {/* Right: Breakthrough Action & Conditions */}
            <div className="lg:col-span-7 bg-[#F6F3F2] dark:bg-[#1a1b1c] p-5 rounded-2xl border border-zinc-200/50 dark:border-white/5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-bolt-lightning text-[#FF7A1A]" />
                  <span>Điều Kiện Độ Kiếp Đột Phá Lên Tầng Kế</span>
                </h3>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
                  Tỷ lệ thành công: 100%
                </span>
              </div>

              {/* Progress gauge */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-600 dark:text-zinc-400">Đan Khí Tích Lũy</span>
                  <span className="text-[#FF7A1A] font-bold">
                    {expCurrent.toLocaleString()} / {xpMax.toLocaleString()} EXP ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
                  />
                </div>
              </div>

              {/* Conditions List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <i className="fa-solid fa-circle-check text-sm" />
                  <span>Tọa thiền đều đặn ({profileData?.stats.loginStreak || 42} ngày streak)</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <i className="fa-solid fa-circle-check text-sm" />
                  <span>Đọc trên 30 chương truyện</span>
                </div>
              </div>

              {/* Breakthrough Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Phần thưởng đột phá: <strong>+{currentLevel * 20} Linh Thạch</strong> + Mở rộng đan điền
                </span>
                <button
                  type="button"
                  onClick={handleBreakthrough}
                  disabled={isBreakingThrough || !canBreakthrough}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    canBreakthrough
                      ? 'bg-gradient-to-r from-[#FF7A1A] to-[#E85D04] text-white hover:shadow-lg active:scale-95 animate-pulse'
                      : 'bg-zinc-200 dark:bg-white/10 text-zinc-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <i className="fa-solid fa-bolt" />
                  <span>
                    {isBreakingThrough
                      ? 'Đang Độ Kiếp...'
                      : canBreakthrough
                      ? 'Độ Kiếp Đột Phá Ngay'
                      : 'Chưa Đầy Chân Khí'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 10 Tầng của cảnh giới hiện tại */}
        <section className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-layer-group text-[#FF7A1A]" />
                <span>Thập Trọng {currentRealm.realmName} Kỳ</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Lộ trình 10 tầng tiến hóa từ Sơ Kỳ, Trung Kỳ, Hậu Kỳ đến Đại Viên Mãn
              </p>
            </div>
            <span className="text-xs font-bold text-[#FF7A1A] bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-full border border-orange-200/60 dark:border-white/5">
              Đang ở Tầng {currentRealm.subLevel} / 10
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((tier) => {
              const isPassed = tier < currentRealm.subLevel;
              const isCurrent = tier === currentRealm.subLevel;
              const isLocked = tier > currentRealm.subLevel;

              return (
                <div
                  key={tier}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'bg-orange-50 dark:bg-orange-950/50 border-[#FF7A1A] shadow-sm'
                      : isPassed
                      ? 'bg-white dark:bg-[#1a1b1c] border-emerald-300/40 dark:border-emerald-950/50'
                      : 'bg-zinc-50 dark:bg-white/5 border-zinc-200/40 dark:border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-zinc-500">Tầng {tier}</span>
                    {isPassed && <i className="fa-solid fa-circle-check text-emerald-500" />}
                    {isCurrent && <i className="fa-solid fa-sun-bright text-[#FF7A1A] animate-spin-slow" />}
                    {isLocked && <i className="fa-solid fa-lock text-zinc-400" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {tier <= 3 ? 'Sơ Kỳ' : tier <= 6 ? 'Trung Kỳ' : tier <= 9 ? 'Hậu Kỳ' : 'Viên Mãn'}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {isPassed ? 'Đã đốn ngộ' : isCurrent ? 'Đang tu tập' : 'Chưa đạt'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bát Đại Cảnh Giới Tu Chân (Chi Tiết Toàn Bộ 8 Cảnh Giới) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
                Vạn Cổ Đạo Thống
              </span>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Bát Đại Cảnh Giới Tu Chân Chi Tiết
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Nhấp vào cảnh giới để khám phá đặc quyền và bí pháp thần thông
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(realmsDef.length > 0 ? realmsDef : []).map((r, idx) => {
              const realmIndex = idx + 1;
              const isPassed = realmIndex < currentRealm.realmIndex;
              const isCurrent = realmIndex === currentRealm.realmIndex;
              const isLocked = realmIndex > currentRealm.realmIndex;
              const isSelected = selectedRealmIdx === realmIndex;

              return (
                <div
                  key={r.name}
                  onClick={() => setSelectedRealmIdx(realmIndex)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#FF7A1A] ring-2 ring-[#FF7A1A]/30 bg-orange-50/40 dark:bg-orange-950/20 shadow-md'
                      : 'bg-white dark:bg-[#141516] border-zinc-200/80 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        Kỳ Thứ {realmIndex}
                      </span>
                      {isPassed && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <i className="fa-solid fa-circle-check" /> Viên mãn
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-xs font-bold text-[#FF7A1A] flex items-center gap-1">
                          <i className="fa-solid fa-sun-bright animate-spin-slow" /> Đang ở đây
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <i className="fa-solid fa-lock" /> Khóa
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{r.name}</h3>
                      <p className="text-xs font-semibold text-[#FF7A1A] mt-0.5">{r.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                    </div>

                    {/* Privileges summary */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1">
                      {r.privileges.slice(0, 2).map((priv, pIdx) => (
                        <p key={pIdx} className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                          <i className="fa-solid fa-sparkles text-[10px] text-[#FF7A1A]" />
                          <span>{priv.title}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs text-zinc-500">
                    <span>Yêu cầu cấp: Cấp {r.minLevel} - {r.maxLevel}</span>
                    <i className="fa-solid fa-chevron-right text-[10px]" />
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

