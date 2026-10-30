'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import '../supporting-pages.css';

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

  if (!isHydrated || !user) return <div className="ow-support ow-shelf"><div className="ow-state" role="status"><span className="ow-spinner" aria-hidden="true" />Đang mở tủ truyện...</div></div>;

  return (
    <div className="ow-support ow-shelf">
      <header className="ow-masthead">
        <span className="ow-kicker">OWOC / Góc của bạn</span>
        <h1>Truyện đã lưu<span aria-hidden="true">.</span></h1>
        <p>Những câu chuyện bạn muốn giữ lại, sẵn sàng cho lần lật trang tiếp theo.</p>
      </header>

      {loading ? (
        <div className="ow-state" role="status"><span className="ow-spinner" aria-hidden="true" />Đang mở tủ truyện...</div>
      ) : bookmarks.length === 0 ? (
        <div className="ow-empty">
          <div className="text-4xl mb-4">🔖</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Chưa lưu truyện nào</h2>
          <p className="mt-2 text-sm text-zinc-500">Khám phá và lưu truyện yêu thích!</p>
          <Link href="/comics" className="ow-action mt-5">
            Khám phá truyện →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bm) => (
            <Link
              key={bm.id}
              href={`/comics/${bm.comic.slug}`}
              className="ow-shelf-row items-center"
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
                <div className="ow-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
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
