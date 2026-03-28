'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

interface HistoryItem {
  id: string;
  lastPage: number;
  readAt: string;
  chapter: {
    id: string; number: string; title: string | null; totalPages: number;
    comic: { id: string; title: string; slug: string; coverUrl: string | null };
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, accessToken, isHydrated } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isHydrated && !user) router.push('/login?redirect=/history');
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    api.get<{ data: HistoryItem[] }>('/history', { token: accessToken })
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (!isHydrated || !user) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">📖 Lịch sử đọc</h1>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-16 text-center">
          <div className="text-4xl mb-4">📖</div>
          <h2 className="text-lg font-semibold text-white">Chưa đọc truyện nào</h2>
          <p className="mt-2 text-sm text-zinc-500">Bắt đầu đọc truyện ngay!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Link
              key={item.id}
              href={`/read/${item.chapter.id}`}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
            >
              <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {item.chapter.comic.coverUrl ? (
                  <img src={item.chapter.comic.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xl font-bold text-zinc-600">{item.chapter.comic.title[0]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-white">{item.chapter.comic.title}</h3>
                <p className="text-sm text-zinc-500">Chương {item.chapter.number}{item.chapter.title ? ` — ${item.chapter.title}` : ''}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-600">
                  <span>📄 Trang {item.lastPage}/{item.chapter.totalPages}</span>
                  <span>{new Date(item.readAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
