'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/studio/stat-card';

interface Comic {
  id: string;
  title: string;
  slug: string;
  status: string;
  coverUrl: string | null;
  stats: { totalViews: number; totalChapters: number };
  genres: { id: string; name: string }[];
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Nháp',
  ONGOING: 'Đang ra',
  COMPLETED: 'Hoàn thành',
  HIATUS: 'Tạm dừng',
};

const statusColor: Record<string, string> = {
  DRAFT: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  ONGOING: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  COMPLETED: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  HIATUS: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

export default function StudioDashboard() {
  const { accessToken } = useAuthStore();
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .get<{ data: Comic[] }>('/comics/author/my-comics', { token: accessToken })
      .then((res) => setComics(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const totalViews = comics.reduce((sum, c) => sum + (c.stats?.totalViews || 0), 0);
  const totalChapters = comics.reduce((sum, c) => sum + (c.stats?.totalChapters || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Tổng quan hoạt động sáng tác của bạn</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<i className="fa-duotone fa-thin fa-books"></i>} label="Tổng truyện" value={comics.length} gradient="from-violet-500 to-fuchsia-500" />
        <StatCard icon={<i className="fa-light fa-book-open-cover"></i>} label="Tổng chương" value={totalChapters} gradient="from-blue-500 to-cyan-500" />
        <StatCard icon={<i className="fa-duotone fa-thin fa-eye"></i>} label="Lượt đọc" value={totalViews} gradient="from-amber-500 to-orange-500" />
        <StatCard icon={<i className="fa-duotone fa-thin fa-file-zipper"></i>} label="Bản nháp" value={comics.filter(c => c.status === 'DRAFT').length} gradient="from-zinc-400 to-zinc-500" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/studio/comics"
          className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-6 shadow-sm dark:shadow-none transition-all duration-300 hover:border-violet-500/30 dark:hover:border-violet-500/20 hover:bg-violet-500/5 dark:hover:bg-violet-500/[0.04]"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 opacity-0 blur-2xl transition-opacity group-hover:opacity-30" />
          <div className="relative">
            <div className="mb-2 text-2xl"><i className="fa-duotone fa-thin fa-books"></i></div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Quản lý truyện</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Xem, chỉnh sửa và quản lý tất cả truyện của bạn</p>
          </div>
        </Link>
        <Link
          href="/studio/comics?action=create"
          className="group relative overflow-hidden rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.1] bg-zinc-50/50 dark:bg-white/[0.01] p-6 transition-all duration-300 hover:border-green-500/30 hover:bg-green-500/5 dark:hover:bg-green-500/[0.04]"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-green-500 to-lime-500 opacity-0 blur-2xl transition-opacity group-hover:opacity-30" />
          <div className="relative">
            <div className="mb-2 text-2xl"><i className="fa-light fa-wand-sparkles"></i></div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Tạo truyện mới</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Bắt đầu một câu chuyện mới của bạn</p>
          </div>
        </Link>
      </div>

      {/* Recent Comics */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Truyện gần đây</h2>
          <Link href="/studio/comics" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors">
            Xem tất cả →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
          </div>
        ) : comics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.08] bg-white dark:bg-transparent p-16 text-center shadow-sm dark:shadow-none">
            <div className="mb-3 text-4xl">📝</div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Chưa có truyện nào</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Bắt đầu sáng tác truyện đầu tiên!</p>
            <Link
              href="/studio/comics?action=create"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
            >
              + Tạo truyện mới
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comics.slice(0, 6).map((comic) => (
              <Link
                key={comic.id}
                href={`/studio/comics/${comic.id}`}
                className="group flex gap-4 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 shadow-sm dark:shadow-none transition-all duration-200 hover:border-violet-500/30 dark:hover:border-violet-500/20 hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
              >
                {/* Cover */}
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-zinc-800">
                  {comic.coverUrl ? (
                    <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 overflow-hidden">
                  <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                    {comic.title}
                  </h4>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[comic.status] || statusColor.DRAFT}`}>
                    {statusLabel[comic.status] || comic.status}
                  </span>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>📖 {comic.stats?.totalChapters || 0}</span>
                    <span>👁️ {comic.stats?.totalViews || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
