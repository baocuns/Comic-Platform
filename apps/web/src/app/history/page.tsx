'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import { api } from '@/lib/api-client';

interface HistoryItem {
  id: string;
  lastPage: number;
  readAt: string;
  chapter: {
    id: string; number: string; title: string | null; totalPages: number;
    comic: {
      id: string; title: string; slug: string; coverUrl: string | null;
      chapters?: { id: string; number: string }[];
    };
  };
}

export default function HistoryPage() {
  const { user, accessToken, isHydrated } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const localRecords = useReadingHistoryStore((s) => s.records);
  const hydrateLocalHistory = useReadingHistoryStore((s) => s.hydrate);

  useEffect(() => {
    hydrateLocalHistory();
  }, [hydrateLocalHistory]);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get<{ data: HistoryItem[] }>('/history', { token: accessToken })
      .then((r) => setHistory(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Group server history by comic, keeping only the most recently read chapter per comic
  const serverGroupedHistory = history.reduce<HistoryItem[]>((acc, item) => {
    const comicId = item.chapter.comic.id;
    if (!acc.some((existing) => existing.chapter.comic.id === comicId)) {
      acc.push(item);
    }
    return acc;
  }, []);

  // Guest history items from localStorage
  const guestHistoryItems: HistoryItem[] = Object.values(localRecords)
    .sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())
    .map((rec) => ({
      id: rec.comicId,
      lastPage: rec.lastPage || 1,
      readAt: rec.readAt,
      chapter: {
        id: rec.chapterId,
        number: rec.chapterNumber,
        title: rec.chapterTitle || null,
        totalPages: rec.totalPages || rec.lastPage || 1,
        comic: {
          id: rec.comicId,
          title: rec.comicTitle || 'Truyện tranh',
          slug: rec.comicSlug || '',
          coverUrl: rec.coverUrl || null,
        },
      },
    }));

  const displayHistory = user ? serverGroupedHistory : guestHistoryItems;

  if (!isHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
          <i className="fa-light fa-clock-rotate-left text-amber-500" />
          <span>Lịch sử đọc</span>
        </h1>
      </div>

      {!user && displayHistory.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <i className="fa-light fa-cloud-arrow-up text-lg text-amber-500 shrink-0" />
            <span>Lịch sử đọc này đang được lưu trên thiết bị của bạn.</span>
          </div>
          <Link
            href="/login?redirect=/history"
            className="self-start sm:self-auto shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 active:scale-95 transition-all"
          >
            Đăng nhập để đồng bộ
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" /></div>
      ) : displayHistory.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-16 text-center">
          <div className="text-4xl mb-4">📖</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Chưa đọc truyện nào</h2>
          <p className="mt-2 text-sm text-zinc-500">Bắt đầu đọc truyện ngay!</p>
          <Link
            href="/comics"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:brightness-105 active:scale-95 transition-all"
          >
            <span>Khám phá truyện</span>
            <i className="fa-light fa-arrow-right text-xs" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayHistory.map((item) => {
            const latestChapter = item.chapter.comic.chapters?.[0];
            const isLatestRead =
              latestChapter &&
              parseFloat(item.chapter.number) >= parseFloat(latestChapter.number);
            const hasNewChapter =
              latestChapter &&
              parseFloat(latestChapter.number) > parseFloat(item.chapter.number);

            return (
              <Link
                key={item.id}
                href={`/read/${item.chapter.id}`}
                className="flex items-start sm:items-center gap-3 sm:gap-4 rounded border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-3 sm:p-4 transition-all hover:border-amber-500/30 hover:bg-amber-500/5 hover:shadow-sm"
              >
                <div className="h-20 w-14 sm:h-24 sm:w-16 flex-shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  {item.chapter.comic.coverUrl ? (
                    <img src={item.chapter.comic.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-lg sm:text-xl font-bold text-zinc-400 dark:text-zinc-650">{item.chapter.comic.title[0]}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="line-clamp-1 text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">{item.chapter.comic.title}</h3>
                    {hasNewChapter ? (
                      <span className="self-start sm:self-auto shrink-0 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 dark:bg-amber-500/20">
                        ✨ Có chương mới
                      </span>
                    ) : isLatestRead ? (
                      <span className="self-start sm:self-auto shrink-0 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20">
                        ✓ Đã đọc mới nhất
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 sm:gap-x-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Đã đọc: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Chương {item.chapter.number}</strong>{item.chapter.title ? ` — ${item.chapter.title}` : ''}</span>
                    {latestChapter && (
                      <span className="text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500">
                        {isLatestRead ? '(Chương mới nhất)' : `(Mới nhất: Ch.${latestChapter.number})`}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                    <span>📄 Trang {item.lastPage}/{item.chapter.totalPages}</span>
                    <span>•</span>
                    <span>{new Date(item.readAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
