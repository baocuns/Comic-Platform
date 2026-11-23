'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Flame,
  Trophy,
  Sparkles,
  Newspaper,
  Clock,
  Star,
  CalendarCheck2,
  BookOpen,
} from 'lucide-react';
import type { ComicSummary, GenreItem, NewsItem } from 'shared';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import { useToast } from '@/components/providers/toast-provider';
import { HeroSpotlight, ComicGrid, ComicCardHorizontal } from '@/components/comic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NEWS_CATEGORY_LABEL, formatRelativeTime } from '@/lib/format';

interface HomepageData {
  featured: ComicSummary[];
  trending: ComicSummary[];
  latest: ComicSummary[];
  topRated: ComicSummary[];
}

interface FeaturedNewsData {
  featured: NewsItem | null;
  latest: NewsItem[];
}

export default function HomePage() {
  const { user, accessToken, fetchProfile } = useAuthStore();
  const { toast } = useToast();
  const historyEntries = useReadingHistoryStore((s) => s.entries);
  const isHistoryHydrated = useReadingHistoryStore((s) => s.isHydrated);

  const [homeData, setHomeData] = useState<HomepageData | null>(null);
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [newsData, setNewsData] = useState<FeaturedNewsData | null>(null);
  const [rankingTab, setRankingTab] = useState<'week' | 'day' | 'month'>('week');
  const [rankings, setRankings] = useState<ComicSummary[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api
        .get<{ data: HomepageData }>('/comics/homepage?limit=12', { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setHomeData(r.data);
        })
        .catch(() => {}),
      api
        .get<{ data: GenreItem[] }>('/genres', { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setGenres(r.data || []);
        })
        .catch(() => {}),
      api
        .get<{ data: FeaturedNewsData }>('/news/featured', { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setNewsData(r.data);
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!controller.signal.aborted) setLoadingHome(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ data: ComicSummary[] }>(`/comics/rankings?period=${rankingTab}&limit=5`, {
        signal: controller.signal,
      })
      .then((r) => {
        if (!controller.signal.aborted) setRankings(r.data || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [rankingTab]);

  const continueList = isHistoryHydrated
    ? Object.values(historyEntries)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4)
    : [];

  const handleQuickCheckIn = async () => {
    if (!accessToken) return;
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
        toast.success(`Nhận +${res.data.xpEarned} XP và +${res.data.coinsEarned} Xu!`);
        await fetchProfile();
      }
    } catch {
      toast.error('Không thể điểm danh lúc này');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 space-y-12">
      {/* 1. Editorial Hero Spotlight */}
      <HeroSpotlight comics={homeData?.featured || homeData?.trending || []} isLoading={loadingHome} />

      {/* 2. Genre Discovery Ribbon */}
      {genres.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <Link
              href="/comics"
              className="shrink-0 rounded-full border border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-white"
            >
              Tất cả thể loại
            </Link>
            {genres.map((g) => (
              <Link
                key={g.id}
                href={`/comics?genre=${g.slug}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                {g.icon && <span>{g.icon}</span>}
                <span>{g.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Continue Reading Shelf */}
      {continueList.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--accent-primary)]" />
              <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                Tiếp tục hành trình đọc
              </h2>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              <span>Xem lịch sử</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {continueList.map((entry) => (
              <Link
                key={entry.comicId}
                href={`/read/${entry.chapterId}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-all hover:border-[var(--accent-primary)]/40 hover:shadow-sm"
              >
                <div className="h-18 w-13 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
                  {entry.coverUrl ? (
                    <img src={entry.coverUrl} alt={entry.comicTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-bold text-[var(--text-muted)]">
                      {entry.comicTitle[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                    {entry.comicTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Đọc tiếp Chương {entry.chapterNumber}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-warm)]"
                      style={{
                        width: `${Math.min(100, Math.round((entry.lastPage / Math.max(1, entry.totalPages)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Fresh Updates (8 cols) + Top Ranking Widget (4 cols) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 8 cols */}
          <div className="lg:col-span-8 space-y-5">
            <div className="flex items-end justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-warm)]">
                  <Flame className="h-3.5 w-3.5" />
                  Mới cập nhật
                </p>
                <h2 className="mt-0.5 font-serif text-2xl font-bold text-[var(--text-primary)]">
                  Chương mới lên sóng
                </h2>
              </div>
              <Link
                href="/comics?sort=updated"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <ComicGrid
              comics={(homeData?.latest || []).slice(0, 8)}
              isLoading={loadingHome}
              skeletonCount={8}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
            />
          </div>

          {/* Right 4 cols: Interactive Ranking + Cultivation Quick Box */}
          <div className="lg:col-span-4 space-y-6">
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[var(--accent-warm)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Bảng xếp hạng</h3>
                </div>
                <div className="inline-flex rounded-lg bg-[var(--bg-subtle)] p-0.5 text-[11px] font-semibold">
                  {(
                    [
                      { k: 'day', l: 'Ngày' },
                      { k: 'week', l: 'Tuần' },
                      { k: 'month', l: 'Tháng' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => setRankingTab(t.k)}
                      className={`rounded-md px-2 py-1 cursor-pointer transition-colors ${
                        rankingTab === t.k
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 space-y-2">
                {rankings.map((comic, idx) => (
                  <ComicCardHorizontal key={comic.id} comic={comic} rank={idx + 1} />
                ))}
              </div>
              <Link
                href="/rankings"
                className="block border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 py-2.5 text-center text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                Xem toàn bộ Bảng xếp hạng →
              </Link>
            </Card>

            {/* Cultivation Daily Strip */}
            <Card className="bg-gradient-to-br from-[var(--accent-primary-soft)] via-[var(--bg-surface)] to-[var(--accent-warm-soft)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Tàng Kinh Các · Tu Luyện
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    {user
                      ? `Bạn đang ở Cấp ${user.level} (${user.cultivation?.realm.name || 'Phàm Nhân'}) · Chuỗi ${user.loginStreak} ngày.`
                      : 'Đọc truyện mỗi ngày để đột phá 9 cảnh giới và tích lũy Xu mở khóa chương VIP.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {user ? (
                  <Button
                    size="sm"
                    variant="warm"
                    className="flex-1"
                    isLoading={checkingIn}
                    onClick={handleQuickCheckIn}
                  >
                    <CalendarCheck2 className="h-3.5 w-3.5" />
                    Điểm danh
                  </Button>
                ) : (
                  <Link href="/login" className="flex-1">
                    <Button size="sm" variant="warm" className="w-full">
                      Đăng nhập nhận Xu
                    </Button>
                  </Link>
                )}
                <Link href="/cultivation">
                  <Button size="sm" variant="outline">
                    Chi tiết
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. Top Rated Showcase */}
      {homeData && homeData.topRated.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex items-end justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--warning)]">
                <Star className="h-3.5 w-3.5 fill-current" />
                Độc giả đánh giá cao
              </p>
              <h2 className="mt-0.5 font-serif text-2xl font-bold text-[var(--text-primary)]">
                Tác phẩm được yêu thích nhất
              </h2>
            </div>
            <Link
              href="/comics?sort=rating"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              <span>Khám phá thêm</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ComicGrid
            comics={homeData.topRated.slice(0, 6)}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6"
          />
        </section>
      )}

      {/* 6. Editorial News Bento */}
      {newsData && (newsData.featured || newsData.latest.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex items-end justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                <Newspaper className="h-3.5 w-3.5" />
                Tạp chí & Cộng đồng
              </p>
              <h2 className="mt-0.5 font-serif text-2xl font-bold text-[var(--text-primary)]">
                Tin tức & Hậu trường sáng tác
              </h2>
            </div>
            <Link
              href="/news"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              <span>Tất cả bài viết</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {newsData.featured && (
              <Link
                href={`/news/${newsData.featured.slug}`}
                className="group relative flex min-h-[290px] flex-col justify-end overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[#181B22] p-6 text-white lg:col-span-7"
              >
                {newsData.featured.coverUrl && (
                  <img
                    src={newsData.featured.coverUrl}
                    alt={newsData.featured.title}
                    className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <span className="inline-block rounded-full bg-[var(--accent-warm)] px-3 py-0.5 text-[11px] font-bold uppercase">
                    {NEWS_CATEGORY_LABEL[newsData.featured.category] || newsData.featured.category}
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold leading-snug group-hover:text-amber-200 transition-colors line-clamp-2">
                    {newsData.featured.title}
                  </h3>
                  {newsData.featured.excerpt && (
                    <p className="line-clamp-2 text-xs sm:text-sm text-white/80">
                      {newsData.featured.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            )}

            <div className="grid grid-cols-1 gap-3 lg:col-span-5">
              {newsData.latest.slice(0, 4).map((article) => (
                <Link
                  key={article.id}
                  href={`/news/${article.slug}`}
                  className="group flex items-center gap-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-all hover:border-[var(--border-strong)] hover:shadow-xs"
                >
                  <div className="h-18 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
                    {article.coverUrl ? (
                      <img src={article.coverUrl} alt={article.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                      {NEWS_CATEGORY_LABEL[article.category] || article.category}
                    </span>
                    <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                      {article.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {formatRelativeTime(article.publishedAt)} · {article.readTimeMinutes} phút đọc
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
