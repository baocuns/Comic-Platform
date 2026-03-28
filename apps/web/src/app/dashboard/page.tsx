'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

interface Comic {
  id: string;
  title: string;
  slug: string;
  status: string;
  stats: { totalViews: number; totalChapters: number };
  coverUrl: string | null;
  genres: { id: string; name: string }[];
}

const statusLabel: Record<string, string> = { DRAFT: 'Nháp', ONGOING: 'Đang ra', COMPLETED: 'Hoàn thành' };

export default function AuthorDashboard() {
  const router = useRouter();
  const { user, accessToken, isHydrated } = useAuthStore();
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComic, setNewComic] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isHydrated && !user) router.push('/login?redirect=/dashboard');
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    api.get<{ data: Comic[] }>('/comics/author/my-comics', { token: accessToken })
      .then((res) => setComics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleCreate = async () => {
    if (!newComic.title.trim() || !accessToken) return;
    setCreating(true);
    try {
      const res = await api.post<{ data: Comic }>('/comics', newComic, { token: accessToken });
      setComics((prev) => [res.data, ...prev]);
      setShowCreateModal(false);
      setNewComic({ title: '', description: '' });
    } catch {
      /* handled by UI */
    }
    setCreating(false);
  };

  if (!isHydrated || !user) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tác giả Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Quản lý truyện của bạn</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
        >
          + Tạo truyện mới
        </button>
      </div>

      {/* Comics Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>
      ) : comics.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-16 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h2 className="text-lg font-semibold text-white">Chưa có truyện nào</h2>
          <p className="mt-2 text-sm text-zinc-500">Hãy tạo truyện đầu tiên của bạn!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comics.map((comic) => (
            <Link
              key={comic.id}
              href={`/dashboard/comics/${comic.id}`}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-base font-semibold text-white group-hover:text-violet-300">{comic.title}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
                  {statusLabel[comic.status] || comic.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>📖 {comic.stats.totalChapters} chương</span>
                <span>👁️ {comic.stats.totalViews} lượt đọc</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Tạo truyện mới</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Tên truyện</label>
                <input
                  value={newComic.title}
                  onChange={(e) => setNewComic((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Nhập tên truyện"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Mô tả</label>
                <textarea
                  value={newComic.description}
                  onChange={(e) => setNewComic((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả nội dung truyện..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newComic.title.trim()}
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : 'Tạo truyện'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
