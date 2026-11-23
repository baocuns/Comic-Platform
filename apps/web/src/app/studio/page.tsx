'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Eye, Bookmark, Coins, Star, Plus, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { APPROVAL_STATUS_LABEL, formatCompactNumber } from '@/lib/format';
import { StatCard } from '@/components/studio/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StudioOverview {
  stats: {
    totalComics: number;
    totalChapters: number;
    totalViews: number;
    totalBookmarks: number;
    totalNews: number;
    totalRevenueCoins: number;
    avgRating: number;
  };
  topComics: Array<{
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    totalViews: number;
    totalChapters: number;
    avgRating: number;
    approvalStatus: string;
  }>;
  recentChapters: Array<{
    id: string;
    number: number;
    title: string | null;
    approvalStatus: string;
    views: number;
    isPremium: boolean;
    priceCoins: number;
    comic: { id: string; title: string };
  }>;
}

export default function StudioDashboardPage() {
  const { user, accessToken } = useAuthStore();
  const [data, setData] = useState<StudioOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .get<{ data: StudioOverview }>('/studio/overview', { token: accessToken })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Xin chào, {user?.displayName}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Theo dõi hiệu quả tác phẩm, lượt đọc và doanh thu Xu từ chương VIP.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/studio/comics">
            <Button variant="warm" size="sm">
              <Plus className="h-4 w-4" />
              Quản lý & Đăng truyện
            </Button>
          </Link>
          <Link href="/studio/news/new">
            <Button variant="outline" size="sm">
              Viết bài tin tức
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tổng lượt đọc"
              value={formatCompactNumber(data.stats.totalViews)}
              sub={`${data.stats.totalComics} truyện · ${data.stats.totalChapters} chương`}
              icon={<Eye className="h-5 w-5" />}
            />
            <StatCard
              label="Độc giả theo dõi"
              value={formatCompactNumber(data.stats.totalBookmarks)}
              sub={`Đánh giá TB: ${data.stats.avgRating.toFixed(1)} ★`}
              icon={<Bookmark className="h-5 w-5" />}
            />
            <StatCard
              label="Doanh thu chương VIP"
              value={`${data.stats.totalRevenueCoins.toLocaleString('vi-VN')} Xu`}
              sub="Chia sẻ 70% trực tiếp"
              icon={<Coins className="h-5 w-5" />}
            />
            <StatCard
              label="Bài viết Tin tức"
              value={data.stats.totalNews}
              sub={user?.isTrusted ? 'Tác giả Uy tín (tự duyệt)' : 'Kiểm duyệt tiêu chuẩn'}
              icon={<Star className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Truyện nổi bật của bạn</h2>
                <Link href="/studio/comics" className="text-xs font-semibold text-[var(--accent-primary)] hover:underline">
                  Xem tất cả <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
              {data.topComics.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">Bạn chưa tạo bộ truyện nào.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topComics.map((c) => (
                    <Link
                      key={c.id}
                      href={`/studio/comics/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-2.5 hover:bg-[var(--bg-subtle)]/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
                          {c.coverUrl && <img src={c.coverUrl} alt={c.title} className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--text-primary)]">{c.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatCompactNumber(c.totalViews)} lượt xem · {c.totalChapters} chương
                          </p>
                        </div>
                      </div>
                      <Badge variant={c.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                        {APPROVAL_STATUS_LABEL[c.approvalStatus]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Chương mới tạo gần đây</h2>
              {data.recentChapters.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">Chưa có chương nào.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recentChapters.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/studio/comics/${ch.comic.id}/chapters/${ch.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3 hover:bg-[var(--bg-subtle)]/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {ch.comic.title} — Chương {ch.number}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {ch.views} lượt xem {ch.isPremium ? `· VIP ${ch.priceCoins} Xu` : ''}
                        </p>
                      </div>
                      <Badge variant={ch.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                        {APPROVAL_STATUS_LABEL[ch.approvalStatus]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
