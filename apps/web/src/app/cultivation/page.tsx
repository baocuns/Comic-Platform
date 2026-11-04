'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  CultivationProfileResponse,
  QuestItem,
  LeaderboardRanker,
  AchievementItem,
} from '@/lib/cultivation-api';

// Fallback dummy data cho Guest hoặc khi API đang tải
const DEFAULT_REALMS = [
  { index: 1, name: 'Luyện Khí', maxTier: 10, reqExp: '1k EXP' },
  { index: 2, name: 'Trúc Cơ', maxTier: 10, reqExp: '10k EXP' },
  { index: 3, name: 'Kim Đan', maxTier: 10, reqExp: '50k EXP' },
  { index: 4, name: 'Nguyên Anh', maxTier: 10, reqExp: '100k EXP' },
  { index: 5, name: 'Hóa Thần', maxTier: 10, reqExp: '300k EXP' },
  { index: 6, name: 'Luyện Hư', maxTier: 10, reqExp: '800k EXP' },
  { index: 7, name: 'Hợp Thể', maxTier: 10, reqExp: '2M EXP' },
  { index: 8, name: 'Đại Thừa', maxTier: 10, reqExp: '5M EXP' },
];

// Helpers render Font Awesome icons cho privileges & achievements
function renderPrivilegeIcon(icon: string) {
  switch (icon) {
    case 'bolt':
      return <i className="fa-solid fa-bolt-lightning" />;
    case 'palette':
      return <i className="fa-solid fa-palette" />;
    case 'chat':
      return <i className="fa-solid fa-comments" />;
    case 'psychology':
      return <i className="fa-solid fa-brain" />;
    case 'task_alt':
      return <i className="fa-solid fa-circle-check" />;
    case 'bookmarks':
      return <i className="fa-solid fa-bookmark" />;
    case 'military_tech':
      return <i className="fa-solid fa-medal" />;
    case 'push_pin':
      return <i className="fa-solid fa-thumbtack" />;
    case 'diamond':
      return <i className="fa-solid fa-gem" />;
    case 'brush':
      return <i className="fa-solid fa-paintbrush" />;
    case 'verified':
      return <i className="fa-solid fa-badge-check" />;
    case 'blur_on':
      return <i className="fa-solid fa-circle-dot" />;
    case 'auto_awesome':
      return <i className="fa-solid fa-sparkles" />;
    case 'inventory_2':
      return <i className="fa-solid fa-box-open" />;
    case 'brightness_high':
      return <i className="fa-solid fa-sun-bright" />;
    case 'campaign':
      return <i className="fa-solid fa-bullhorn" />;
    case 'workspace_premium':
      return <i className="fa-solid fa-award" />;
    case 'stars':
      return <i className="fa-solid fa-star" />;
    case 'crown':
      return <i className="fa-solid fa-crown" />;
    case 'trophy':
      return <i className="fa-solid fa-trophy" />;
    case 'all_inclusive':
      return <i className="fa-solid fa-infinity" />;
    default:
      return <i className="fa-solid fa-sparkles" />;
  }
}

function renderAchievementIcon(icon: string) {
  switch (icon) {
    case 'menu_book':
      return <i className="fa-solid fa-book-open" />;
    case 'forum':
      return <i className="fa-solid fa-comments" />;
    case 'cycle':
      return <i className="fa-solid fa-rotate-right" />;
    case 'shield':
      return <i className="fa-solid fa-shield-halved" />;
    default:
      return <i className="fa-solid fa-award" />;
  }
}

export default function CultivationPage() {
  const { user, accessToken } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<CultivationProfileResponse['data'] | null>(null);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'all' | 'weekly' | 'sect'>('all');
  const [topRankers, setTopRankers] = useState<LeaderboardRanker[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardRanker | null>(null);

  // Check-in state & toast message
  const [isMeditating, setIsMeditating] = useState(false);
  const [meditateMessage, setMeditateMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Tải dữ liệu ban đầu
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        // Luôn tải leaderboard công khai
        const lbRes = await cultivationApi.getLeaderboard(leaderboardType, accessToken || undefined);
        if (isMounted && lbRes.success) {
          setTopRankers(lbRes.data.topUsers);
          setCurrentUserRank(lbRes.data.currentUserRank);
        }

        // Nếu đã đăng nhập, tải profile, quests, achievements cá nhân
        if (accessToken) {
          const [profRes, questRes, achRes] = await Promise.allSettled([
            cultivationApi.getProfile(accessToken),
            cultivationApi.getQuests(accessToken),
            cultivationApi.getAchievements(accessToken),
          ]);

          if (isMounted && profRes.status === 'fulfilled' && profRes.value.success) {
            setProfileData(profRes.value.data);
          }
          if (isMounted && questRes.status === 'fulfilled' && questRes.value.success) {
            setQuests(questRes.value.data.quests);
          }
          if (isMounted && achRes.status === 'fulfilled' && achRes.value.success) {
            setAchievements(achRes.value.data);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu tu luyện:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [accessToken, leaderboardType]);

  // 2. Xử lý Tọa Thiền Tụ Khí
  const handleMeditate = async () => {
    if (!accessToken) {
      showToast('Đạo hữu vui lòng đăng nhập để bắt đầu tọa thiền tích lũy chân khí!', 'error');
      return;
    }

    if (profileData && !profileData.stats.canCheckInToday) {
      showToast('Hôm nay đạo hữu đã tọa thiền rồi, hãy trở lại vào ngày mai!', 'error');
      return;
    }

    setIsMeditating(true);
    try {
      const res = await cultivationApi.dailyCheckin(accessToken);
      if (res.success) {
        showToast(res.message, 'success');
        setMeditateMessage('Thiền định thành công! Đan điền đã tiếp nhận linh khí dồi dào.');

        // Cập nhật lại profile & quests
        const [profRes, questRes] = await Promise.allSettled([
          cultivationApi.getProfile(accessToken),
          cultivationApi.getQuests(accessToken),
        ]);
        if (profRes.status === 'fulfilled' && profRes.value.success) {
          setProfileData(profRes.value.data);
        }
        if (questRes.status === 'fulfilled' && questRes.value.success) {
          setQuests(questRes.value.data.quests);
        }
      } else {
        showToast(res.message || 'Không thể thực hiện tọa thiền lúc này', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi xảy ra khi tọa thiền', 'error');
    } finally {
      setIsMeditating(false);
    }
  };

  // 3. Xử lý nhận thưởng nhiệm vụ
  const handleClaimQuest = async (questId: string) => {
    if (!accessToken) return;

    try {
      const res = await cultivationApi.claimQuest(questId, accessToken);
      if (res.success) {
        showToast(res.message, 'success');

        // Cập nhật lại UI state quest sang CLAIMED
        setQuests((prev) =>
          prev.map((q) => (q.id === questId ? { ...q, status: 'CLAIMED' } : q))
        );

        // Refresh profile để cập nhật EXP & Coins
        const profRes = await cultivationApi.getProfile(accessToken);
        if (profRes.success) {
          setProfileData(profRes.data);
        }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi nhận thưởng', 'error');
    }
  };

  // Tính toán dữ liệu hiển thị (kết hợp profile thật hoặc mock demo)
  const currentRealmIndex = profileData?.realm.realmIndex || 3; // Mặc định Kim Đan cho demo nếu chưa login
  const currentRealmName = profileData?.realm.fullName || 'Kim Đan Tầng 4';
  const currentTitle = profileData?.realm.title || 'Thiên Đạo Trúc Cơ';
  const userDisplayName = profileData?.user.displayName || user?.displayName || 'Tiêu Dao Chân Nhân';
  const userRank = profileData?.user.rank || 48;
  const currentExp = profileData?.stats.experience ?? 14850;
  const maxExp = profileData?.stats.xpMax ?? 20000;
  const progressPercent = profileData?.stats.progressPercent ?? 74.25;
  const expRemaining = profileData?.stats.expRemaining ?? 5150;
  const streakDays = profileData?.stats.loginStreak ?? 42;
  const coinsBalance = profileData?.stats.coins ?? 3250;
  const canMeditate = profileData ? profileData.stats.canCheckInToday : true;

  const currentPrivileges = profileData?.realm.privileges || [
    { title: '+20% Tốc Độ Tích Lũy', description: 'Gia tăng EXP khi đọc truyện tranh liên tục', icon: 'bolt' },
    { title: 'Khung Avatar Hoàng Kim', description: 'Viền hào quang Kim Đan rực rỡ độc bản', icon: 'palette' },
    { title: 'Danh Hiệu Động Bình Luận', description: 'Nổi bật giữa hàng vạn đạo hữu thảo luận', icon: 'chat' },
    { title: 'Huy Hiệu Thần Thông', description: 'Quyền bỏ phiếu bình chọn siêu phẩm mỗi tháng', icon: 'psychology' },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl transition-all animate-bounce ${toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
            }`}
        >
          <i className={`fa-solid ${toastMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-lg`} />
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      <CultivationNav currentStreak={streakDays} coins={coinsBalance} />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* 1. TOP NOTICE & REALM AURA GREETING */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F6F3F2] dark:bg-[#18191a] px-4 py-2.5 rounded-xl border border-zinc-200/60 dark:border-white/5">
          <div className="flex items-center gap-2 text-[#FF7A1A]">
            <i className="fa-solid fa-sparkles text-[18px]" />
            <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-zinc-900 dark:text-white">
              Đại Điện Tu Luyện • Thiên Địa Linh Khí Thịnh Vượng
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{profileData?.buffs?.veinName || `Linh Mạch Cấp ${profileData?.realm?.realmIndex || 1}`}</span>
              {profileData?.buffs && profileData.buffs.realmBonusPercent > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  (+{profileData.buffs.realmBonusPercent}%)
                </span>
              )}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            {profileData?.buffs?.isAuspiciousHour ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 dark:bg-orange-500/20 text-[#FF7A1A] font-bold border border-orange-500/30 animate-pulse">
                <i className="fa-solid fa-clock-nine" />
                Giờ Hoàng Đạo ({profileData.buffs.auspiciousLabel}): +25% Linh Khí
              </span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <i className="fa-solid fa-clock text-zinc-400" />
                <span>Giờ Hoàng Đạo kế tiếp: {profileData?.buffs?.nextAuspiciousWindow || '06:00 - 09:00'} (+25% Linh Khí)</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. CULTIVATION HERO CARD (Trạng Thái Đan Điền) */}
        <section className="relative bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-5 sm:p-6 lg:p-8 overflow-hidden">
          {/* Decorative Backdrop Glows */}
          <div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-orange-400/10 pointer-events-none blur-3xl" />
          <div className="absolute right-1/4 -bottom-20 w-80 h-80 rounded-full bg-emerald-400/10 pointer-events-none blur-2xl" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Avatar & Realm Halo */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="relative shrink-0">
                {/* Jade Ring Halo */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-gradient-to-tr from-emerald-500 via-orange-500 to-amber-300 flex items-center justify-center shadow-md">
                  <div className="w-full h-full rounded-full p-1 bg-white dark:bg-[#141516] overflow-hidden">
                    {profileData?.user.avatarUrl || user?.avatarUrl ? (
                      <img
                        src={profileData?.user.avatarUrl || user?.avatarUrl || ''}
                        alt={userDisplayName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-3xl font-bold">
                        {userDisplayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                {/* Realm Tag Pill */}
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#FF7A1A] text-white text-xs font-bold shadow-sm whitespace-nowrap">
                  {currentRealmName}
                </span>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] text-xs font-bold">
                  <i className="fa-solid fa-fire-flame-curved text-[13px]" />
                  <span>{currentTitle}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white truncate">
                  {userDisplayName}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1">
                  <i className="fa-solid fa-badge-check text-[15px] text-emerald-500" />
                  <span>Độc giả chân truyền OWOC #{userRank}</span>
                </p>
              </div>
            </div>

            {/* Cultivation Stats & Dantian EXP Gauge */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <div className="flex items-end justify-between mb-1.5">
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                      Tiến Độ Ngưng Đan
                    </span>
                    <p className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                      {currentExp.toLocaleString()} / {maxExp.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        Chân Khí EXP
                      </span>
                    </p>
                  </div>
                  <span className="text-base sm:text-lg font-extrabold text-[#FF7A1A]">
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-zinc-200/50 dark:border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
                  />
                </div>

                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <i className="fa-solid fa-hourglass-clock text-[14px] text-[#FF7A1A]" />
                  <span>
                    Còn <strong>{expRemaining.toLocaleString()} EXP</strong> để đốn ngộ đột phá cảnh giới tiếp theo
                  </span>
                </p>
              </div>

              {/* Streak & Jade Stones Stat Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-[#F6F3F2] dark:bg-[#1b1c1d] p-3 rounded-xl flex items-center gap-3 border border-zinc-200/40 dark:border-white/5">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[#FF7A1A] shrink-0">
                    <i className="fa-solid fa-fire-flame-curved text-[20px]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                      Chuỗi Tu Luyện
                    </span>
                    <span className="text-lg font-bold text-zinc-900 dark:text-white">
                      {streakDays}{' '}
                      <span className="text-xs font-normal text-zinc-500">ngày</span>
                    </span>
                  </div>
                </div>

                <div className="bg-[#F6F3F2] dark:bg-[#1b1c1d] p-3 rounded-xl flex items-center gap-3 border border-zinc-200/40 dark:border-white/5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <i className="fa-solid fa-gem text-[20px]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                      Linh Thạch OWOC
                    </span>
                    <span className="text-lg font-bold text-zinc-900 dark:text-white">
                      {coinsBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Meditation Quick Action */}
            <div className="lg:col-span-3 flex flex-col justify-center items-center lg:items-end gap-2.5 text-center lg:text-right border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center lg:justify-end gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Linh Vân Tụ Khí Đã Đầy
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Thu gom linh khí bồi dưỡng nguyên thần nhật khóa
                </p>
              </div>

              {canMeditate ? (
                <button
                  type="button"
                  onClick={handleMeditate}
                  disabled={isMeditating}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FF7A1A] hover:bg-[#E85D04] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-yin-yang text-[18px]" />
                  <span>
                    {isMeditating
                      ? 'Đang Tụ Khí...'
                      : `Tọa Thiền Tụ Khí (+${profileData?.buffs?.effectiveMeditationXp || 100} EXP)`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-not-allowed opacity-90"
                >
                  <i className="fa-solid fa-circle-check text-[18px]" />
                  <span>Đã Tụ Khí Hôm Nay</span>
                </button>
              )}

              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {meditateMessage || 'Làm mới lúc 00:00 mỗi ngày'}
              </span>
            </div>
          </div>
        </section>

        {/* 3. BÁT ĐẠI CẢNH GIỚI TU TIÊN */}
        <section className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-1">
            <div>
              <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
                Lộ Trình Bất Hủ
              </span>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                  Bát Đại Cảnh Giới Tu Tiên
                </h2>
                <Link href="/cultivation/realms" className="text-xs font-bold text-[#FF7A1A] hover:underline flex items-center gap-1">
                  <span>Chi tiết & Đột phá</span>
                  <i className="fa-solid fa-chevron-right text-[10px]" />
                </Link>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Tích lũy chân khí qua từng trang truyện để thăng tiến cảnh giới vạn thế
            </p>
          </div>

          {/* Progression Rail Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {DEFAULT_REALMS.map((r) => {
              const isPast = r.index < currentRealmIndex;
              const isCurrent = r.index === currentRealmIndex;
              const isLocked = r.index > currentRealmIndex;

              if (isCurrent) {
                return (
                  <div
                    key={r.index}
                    className="bg-orange-50 dark:bg-orange-950/50 border-2 border-[#FF7A1A] p-3.5 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="absolute -right-3 -top-3 w-12 h-12 bg-orange-400/20 rounded-full blur-sm"></div>
                    <div className="flex items-center justify-between relative z-10">
                      <span className="px-2 py-0.5 rounded-md bg-[#FF7A1A] text-white text-[11px] font-bold">
                        Hiện Tại
                      </span>
                      <i className="fa-solid fa-sun-bright text-[#FF7A1A] text-[16px] animate-pulse" />
                    </div>
                    <div className="my-2.5 relative z-10">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{r.name}</h3>
                      <p className="text-xs font-bold text-[#FF7A1A]">
                        Tầng {profileData?.realm.subLevel || 4} / 10
                      </p>
                    </div>
                    <span className="text-[11px] text-[#FF7A1A] font-semibold">
                      {Math.round(currentExp / 1000)}k / {Math.round(maxExp / 1000)}k EXP
                    </span>
                  </div>
                );
              }

              if (isPast) {
                return (
                  <div
                    key={r.index}
                    className="bg-white dark:bg-[#141516] p-3.5 rounded-xl border border-zinc-200/80 dark:border-white/5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-[11px] text-zinc-500 font-medium">
                        Kỳ {r.index}
                      </span>
                      <i className="fa-solid fa-circle-check text-emerald-500 text-[16px]" />
                    </div>
                    <div className="my-2.5">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{r.name}</h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Đã viên mãn
                      </p>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">10 / 10 Tầng</span>
                  </div>
                );
              }

              // Locked
              return (
                <div
                  key={r.index}
                  className="bg-[#F6F3F2]/60 dark:bg-[#141516]/60 p-3.5 rounded-xl border border-zinc-200/40 dark:border-white/5 flex flex-col justify-between opacity-80"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-white/5 text-[11px] text-zinc-500">
                      Kỳ {r.index}
                    </span>
                    <i className="fa-solid fa-lock text-zinc-400 text-[15px]" />
                  </div>
                  <div className="my-2.5">
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{r.name}</h3>
                    <p className="text-xs text-zinc-500 font-medium">{r.reqExp}</p>
                  </div>
                  <span className="text-[11px] text-zinc-400">Chưa mở</span>
                </div>
              );
            })}
          </div>

          {/* Current Realm Privileges Banner */}
          <div className="bg-white dark:bg-[#141516] p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-3">
              <i className="fa-solid fa-medal text-[#FF7A1A] text-[18px]" />
              Đặc Quyền Cảnh Giới {currentRealmName.split(' ')[0]} Đang Kích Hoạt
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentPrivileges.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F3F2] dark:bg-[#18191a] border border-zinc-200/40 dark:border-white/5"
                >
                  <span className="text-[#FF7A1A] text-[20px] shrink-0 mt-0.5 w-6 text-center">
                    {renderPrivilegeIcon(p.icon)}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{p.title}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. DUAL LAYOUT: NHIỆM VỤ TU LUYỆN & BẢNG PHONG THẦN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Nhiệm Vụ Hàng Ngày & Hàng Tuần (7 Cols) */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
                  Hành Tẩu Tu Tiên
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                    Nhiệm Vụ Tu Luyện
                  </h2>
                  <Link href="/cultivation/quests" className="text-xs font-bold text-[#FF7A1A] hover:underline flex items-center gap-1">
                    <span>Vấn Đạo Các</span>
                    <i className="fa-solid fa-chevron-right text-[10px]" />
                  </Link>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                Hoàn thành: {quests.filter((q) => q.status === 'CLAIMED' || q.status === 'CLAIMABLE').length} /{' '}
                {quests.length || 5}
              </span>
            </div>

            {/* Quests List */}
            <div className="space-y-3">
              {(quests.length > 0
                ? quests
                : [
                  {
                    id: 'read_5_chapters',
                    type: 'daily' as const,
                    tag: 'Nhật Khóa',
                    title: 'Đọc 5 chương truyện mới',
                    current: 5,
                    target: 5,
                    unit: 'chương',
                    rewardXp: 80,
                    rewardCoins: 10,
                    rewardDisplay: '+80 EXP • +10 Linh Thạch',
                    status: 'CLAIMABLE' as const,
                    actionUrl: '/comics',
                    actionText: 'Đọc Truyện',
                  },
                  {
                    id: 'daily_checkin',
                    type: 'daily' as const,
                    tag: 'Nhật Khóa',
                    title: 'Điểm danh tu luyện mỗi ngày',
                    current: 1,
                    target: 1,
                    unit: 'lần',
                    rewardXp: 100,
                    rewardCoins: 5,
                    rewardDisplay: '+100 EXP • +5 Linh Thạch',
                    status: 'CLAIMED' as const,
                    actionUrl: '#meditate',
                    actionText: 'Tọa Thiền',
                  },
                  {
                    id: 'comment_2_times',
                    type: 'daily' as const,
                    tag: 'Nhật Khóa',
                    title: 'Để lại 2 bình luận luận đạo có tâm',
                    current: 1,
                    target: 2,
                    unit: 'bình luận',
                    rewardXp: 60,
                    rewardCoins: 5,
                    rewardDisplay: '+60 EXP • +5 Linh Thạch',
                    status: 'IN_PROGRESS' as const,
                    actionUrl: '/comics',
                    actionText: 'Làm Ngay',
                  },
                  {
                    id: 'bookmark_1_comic',
                    type: 'daily' as const,
                    tag: 'Nhật Khóa',
                    title: 'Theo dõi 1 bộ truyện mới',
                    current: 1,
                    target: 1,
                    unit: 'bộ',
                    rewardXp: 50,
                    rewardCoins: 0,
                    rewardDisplay: '+50 EXP',
                    status: 'CLAIMABLE' as const,
                    actionUrl: '/comics',
                    actionText: 'Khám Phá',
                  },
                  {
                    id: 'read_3_hours_weekly',
                    type: 'weekly' as const,
                    tag: 'Chu Kỳ Tuần',
                    title: 'Tích lũy 3 giờ đọc truyện',
                    current: 2.4,
                    target: 3.0,
                    unit: 'giờ',
                    rewardXp: 300,
                    rewardCoins: 20,
                    rewardDisplay: '+300 EXP • 1 Rương Đan Dược Cổ',
                    status: 'IN_PROGRESS' as const,
                    actionUrl: '/comics',
                    actionText: 'Tiếp Tục Đọc',
                  },
                ]
              ).map((q) => {
                const isClaimable = q.status === 'CLAIMABLE';
                const isClaimed = q.status === 'CLAIMED';
                const percent = Math.min(100, Math.round((q.current / q.target) * 100));

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${q.type === 'weekly'
                      ? 'bg-gradient-to-r from-white via-white to-amber-50 dark:from-[#141516] dark:via-[#141516] dark:to-orange-950/20 border-amber-200/60 dark:border-white/10'
                      : isClaimed
                        ? 'bg-white/70 dark:bg-[#141516]/60 border-zinc-200/50 dark:border-white/5 opacity-75'
                        : 'bg-white dark:bg-[#141516] border-zinc-200/80 dark:border-white/10 shadow-sm'
                      }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${q.type === 'weekly'
                            ? 'bg-[#E85D04] text-white'
                            : 'bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A]'
                            }`}
                        >
                          {q.tag}
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {q.title}
                        </h3>
                      </div>

                      {/* Progress line */}
                      <div className="flex items-center gap-3">
                        <div className="w-32 sm:w-44 h-2 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isClaimed
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
                        <span
                          className={`text-xs font-bold ${isClaimed
                            ? 'text-zinc-400'
                            : isClaimable
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                            }`}
                        >
                          {q.current} / {q.target} {q.unit} ({percent}%)
                        </span>
                      </div>

                      {/* Rewards */}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Phần thưởng:</span>
                        <span className="font-bold text-[#FF7A1A]">{q.rewardDisplay}</span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="shrink-0 flex items-center">
                      {isClaimable ? (
                        <button
                          type="button"
                          onClick={() => handleClaimQuest(q.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          Nhận Thưởng
                        </button>
                      ) : isClaimed ? (
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2 bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 text-xs font-semibold rounded-xl cursor-not-allowed"
                        >
                          Đã Nhận
                        </button>
                      ) : (
                        <Link
                          href={q.actionUrl || '/comics'}
                          className="px-4 py-2 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                        >
                          {q.actionText || 'Làm Ngay'}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TÀNG BẢO CÁC & THÀNH TỰU BADGES GRID */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-award text-[#FF7A1A] text-[18px]" />
                  Tàng Bảo Các • Thành Tựu Thu Thập
                </h3>
                <Link href="/cultivation/achievements" className="text-xs font-bold text-[#FF7A1A] hover:underline flex items-center gap-1">
                  <span>Xem Bách Khoa</span>
                  <i className="fa-solid fa-chevron-right text-[10px]" />
                </Link>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Đã kích hoạt: {achievements.filter((a) => a.isUnlocked).length || 4} / 24
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(achievements.length > 0
                  ? achievements
                  : [
                    {
                      id: 'ancient_bookworm',
                      name: 'Mọt Sách Thượng Cổ',
                      description: 'Đọc trên 500 chương',
                      icon: 'menu_book',
                      tier: 'BẬC III',
                      color: 'primary',
                      isUnlocked: true,
                      progress: '520/500',
                    },
                    {
                      id: 'discussion_master',
                      name: 'Tông Sư Luận Đạo',
                      description: 'Nhận 200 lượt thích',
                      icon: 'forum',
                      tier: 'BẬC II',
                      color: 'secondary',
                      isUnlocked: true,
                      progress: '215/200',
                    },
                    {
                      id: 'reincarnation_warrior',
                      name: 'Chiến Binh Trùng Sinh',
                      description: 'Đọc 10 bộ trùng sinh',
                      icon: 'cycle',
                      tier: 'BẬC I',
                      color: 'tertiary',
                      isUnlocked: true,
                      progress: '10/10',
                    },
                    {
                      id: 'owoc_guardian',
                      name: 'Hộ Pháp OWOC',
                      description: 'Gắn bó 100 ngày',
                      icon: 'shield',
                      tier: 'VINH DANH',
                      color: 'primary-container',
                      isUnlocked: true,
                      progress: '100/100',
                    },
                  ]
                ).map((ach) => (
                  <div
                    key={ach.id}
                    className="bg-white dark:bg-[#141516] p-3.5 rounded-xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center space-y-2 hover:border-[#FF7A1A]/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[#FF7A1A] group-hover:scale-110 transition-transform">
                      <span className="text-[22px]">{renderAchievementIcon(ach.icon)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate w-full">
                        {ach.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        {ach.description}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold tracking-wider">
                      {ach.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: Bảng Phong Thần / Leaderboard (5 Cols) */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#FF7A1A] uppercase tracking-wider">
                  Quần Hùng Tranh Đấu
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                  Bảng Phong Thần
                </h2>
              </div>
              <i className="fa-solid fa-trophy text-[#FF7A1A] text-[20px]" />
            </div>

            {/* Leaderboard Card Container */}
            <div className="bg-white dark:bg-[#141516] rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm p-4 sm:p-5 space-y-4">
              {/* Filter Tabs */}
              <div className="flex rounded-xl bg-zinc-100 dark:bg-[#1b1c1d] p-1 gap-1">
                {(['all', 'weekly', 'sect'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setLeaderboardType(tab)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${leaderboardType === tab
                      ? 'bg-white dark:bg-[#252628] text-[#FF7A1A] shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                  >
                    {tab === 'all'
                      ? 'Toàn Máy Chủ'
                      : tab === 'weekly'
                        ? 'Tuần Này'
                        : 'Bảng Tông Môn'}
                  </button>
                ))}
              </div>

              {/* Top Rankers List */}
              <div className="space-y-2.5">
                {(topRankers.length > 0
                  ? topRankers.slice(0, 5)
                  : [
                    {
                      rank: 1,
                      id: 'mock-1',
                      username: 'thaithuongkiemton',
                      displayName: 'Thái Thượng Kiếm Tôn',
                      avatarUrl: null,
                      level: 39,
                      realmName: 'Nguyên Anh Tầng 9',
                      experience: 248900,
                    },
                    {
                      rank: 2,
                      id: 'mock-2',
                      username: 'namcungthienvu',
                      displayName: 'Nam Cung Thiên Vũ',
                      avatarUrl: null,
                      level: 35,
                      realmName: 'Nguyên Anh Tầng 5',
                      experience: 186400,
                    },
                    {
                      rank: 3,
                      id: 'mock-3',
                      username: 'bachlientientu',
                      displayName: 'Bạch Liên Tiên Tử',
                      avatarUrl: null,
                      level: 32,
                      realmName: 'Nguyên Anh Tầng 2',
                      experience: 142100,
                    },
                    {
                      rank: 4,
                      id: 'mock-4',
                      username: 'luckhidaonhan',
                      displayName: 'Lục Khí Đạo Nhân',
                      avatarUrl: null,
                      level: 30,
                      realmName: 'Kim Đan Tầng 10',
                      experience: 98200,
                    },
                  ]
                ).map((rk) => (
                  <div
                    key={rk.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${rk.rank === 1
                      ? 'bg-gradient-to-r from-amber-100/70 via-orange-50/40 to-transparent dark:from-amber-950/40 dark:via-transparent border border-amber-300/50 dark:border-white/5'
                      : rk.rank === 2
                        ? 'bg-zinc-50 dark:bg-white/5 border border-zinc-200/60 dark:border-white/5'
                        : rk.rank === 3
                          ? 'bg-zinc-50/60 dark:bg-white/5 border border-zinc-200/40 dark:border-white/5'
                          : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                      }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${rk.rank === 1
                        ? 'bg-[#FF7A1A] text-white'
                        : rk.rank === 2
                          ? 'bg-amber-400 text-white'
                          : rk.rank === 3
                            ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-white'
                            : 'text-zinc-500 font-semibold'
                        }`}
                    >
                      {rk.rank}
                    </div>

                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200">
                      {rk.avatarUrl ? (
                        <img src={rk.avatarUrl} alt={rk.displayName} className="w-full h-full object-cover" />
                      ) : (
                        rk.displayName.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {rk.displayName}
                        </span>
                        {rk.rank <= 3 && (
                          <i className="fa-solid fa-badge-check text-[#FF7A1A] text-[13px]" />
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{rk.realmName}</span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-[#FF7A1A] block">
                        {rk.experience.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-400">EXP</span>
                    </div>
                  </div>
                ))}

                {/* Current User Floating Position in Leaderboard */}
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-[#FF7A1A]/30 mt-4 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#FF7A1A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {userRank}
                  </div>
                  <div className="w-9 h-9 rounded-full p-0.5 bg-emerald-500 shrink-0">
                    {profileData?.user.avatarUrl || user?.avatarUrl ? (
                      <img
                        src={profileData?.user.avatarUrl || user?.avatarUrl || ''}
                        alt="My Avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-white dark:bg-[#141516] flex items-center justify-center text-xs font-bold text-[#FF7A1A]">
                        {userDisplayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-[#FF7A1A] truncate">
                        Bạn ({userDisplayName})
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-[#FF7A1A] text-white text-[10px] font-bold">
                        Hạng {userRank}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{currentRealmName}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-[#FF7A1A] block">
                      {currentExp.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-400">EXP</span>
                  </div>
                </div>
              </div>

              {/* Detailed leaderboard CTA link */}
              <Link
                href="/cultivation/leaderboard"
                className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Xem Bảng Phong Thần Chi Tiết</span>
                <i className="fa-solid fa-arrow-right text-[13px]" />
              </Link>
            </div>
          </section>
        </div>

        {/* 5. CULTIVATION INSIGHTS & TIPS FOOTER BANNER */}
        <div className="bg-gradient-to-r from-orange-50 via-white to-amber-50 dark:from-[#161718] dark:via-[#141516] dark:to-orange-950/20 p-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-lightbulb text-[24px]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Bí Quyết Đột Phá Nhanh Chóng
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Đọc các bộ truyện đạt nhãn &ldquo;Kỳ Thư Thượng Cổ&rdquo; vào khung giờ 20h - 22h sẽ nhận gấp đôi chân khí bồi dưỡng đan điền.
              </p>
            </div>
          </div>
          <Link
            href="/comics"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-[#E85D04] hover:bg-[#d05303] text-white text-xs font-bold transition-all shadow-sm"
          >
            Khám Phá Kỳ Thư
          </Link>
        </div>
      </main>
    </div>
  );
}

