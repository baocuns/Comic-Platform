'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

interface BookmarkItem {
  id: string;
  isFavorite: boolean;
  createdAt: string;
  comic: {
    id: string; title: string; slug: string; coverUrl: string | null;
    status: string; totalChapters: number; lastChapterAt: string | null;
    author: { displayName: string };
  };
}

export default function BookmarksPage() {
  const router = useRouter();
  const { user, accessToken, isHydrated } = useAuthStore();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isHydrated && !user) router.push('/login?redirect=/bookmarks');
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    api.get<{ data: BookmarkItem[] }>('/bookmarks', { token: accessToken })
      .then((r) => setBookmarks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (!isHydrated || !user) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">📚 Truyện đã lưu</h1>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" /></div>
      ) : bookmarks.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-16 text-center">
          <div className="text-4xl mb-4">🔖</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Chưa lưu truyện nào</h2>
          <p className="mt-2 text-sm text-zinc-500">Khám phá và lưu truyện yêu thích!</p>
          <Link href="/comics" className="mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:brightness-110 transition-all">
            Khám phá truyện →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bm) => (
            <Link
              key={bm.id}
              href={`/comics/${bm.comic.slug}`}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-4 transition-all hover:border-amber-500/30 hover:bg-amber-500/5 hover:shadow-sm"
            >
              <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {bm.comic.coverUrl ? (
                  <img src={bm.comic.coverUrl} alt={bm.comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xl font-bold text-zinc-400 dark:text-zinc-650">{bm.comic.title[0]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-white">{bm.comic.title}</h3>
                  {bm.isFavorite && <span className="text-xs">❤️</span>}
                </div>
                <p className="text-sm text-zinc-555 dark:text-zinc-500">{bm.comic.author.displayName}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-600">
                  <span>📖 {bm.comic.totalChapters} chương</span>
                  {bm.comic.lastChapterAt && <span>Cập nhật: {new Date(bm.comic.lastChapterAt).toLocaleDateString('vi-VN')}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
