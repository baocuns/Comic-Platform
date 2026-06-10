'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

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
  DRAFT: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/20',
  ONGOING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  COMPLETED: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
  HIATUS: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
};

const filterOptions = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ONGOING', label: 'Đang ra' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
];

export default function StudioComicsPage() {
  const { accessToken } = useAuthStore();
  const searchParams = useSearchParams();

  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newComic, setNewComic] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create') setShowCreate(true);
  }, [searchParams]);

  useEffect(() => {
    if (!accessToken) return;
    api
      .get<{ data: Comic[] }>('/comics/author/my-comics', { token: accessToken })
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
      setShowCreate(false);
      setNewComic({ title: '', description: '' });
    } catch {}
    setCreating(false);
  };

  const filtered = comics.filter((c) => {
    if (filter !== 'ALL' && c.status !== filter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Truyện của tôi</h1>
          <p className="mt-1 text-sm text-zinc-500">{comics.length} truyện</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
        >
          <span className="text-base">+</span>
          Tạo truyện mới
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm truyện..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/10"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                filter === opt.value
                  ? 'bg-violet-500/15 text-violet-300 shadow-sm'
                  : 'bg-white/[0.03] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-l-lg px-3 py-2 text-xs transition-colors ${
              viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Grid"
          >
            ▦
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-r-lg px-3 py-2 text-xs transition-colors ${
              viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="List"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Comics */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-16 text-center">
          <div className="mb-3 text-4xl">📭</div>
          <h3 className="text-base font-semibold text-white">
            {search || filter !== 'ALL' ? 'Không tìm thấy truyện' : 'Chưa có truyện nào'}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {search || filter !== 'ALL' ? 'Thử thay đổi bộ lọc hoặc từ khóa' : 'Hãy tạo truyện đầu tiên!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((comic) => (
            <Link
              key={comic.id}
              href={`/studio/comics/${comic.id}`}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:border-violet-500/20 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-violet-500/5"
            >
              {/* Cover banner */}
              <div className="relative h-32 w-full bg-gradient-to-br from-zinc-800 to-zinc-900">
                {comic.coverUrl && (
                  <img src={comic.coverUrl} alt="" className="h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0f] via-transparent to-transparent" />
                <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusColor[comic.status] || statusColor.DRAFT}`}>
                  {statusLabel[comic.status] || comic.status}
                </span>
              </div>

              {/* Info */}
              <div className="relative -mt-8 px-5 pb-5">
                <div className="mb-3 flex items-end gap-3">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-[#0c0c0f] bg-zinc-800 shadow-lg">
                    {comic.coverUrl ? (
                      <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-bold text-zinc-600">{comic.title[0]}</div>
                    )}
                  </div>
                </div>
                <h3 className="truncate text-base font-semibold text-white group-hover:text-violet-300 transition-colors">
                  {comic.title}
                </h3>
                <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">📖 {comic.stats?.totalChapters || 0} chương</span>
                  <span className="flex items-center gap-1">👁️ {(comic.stats?.totalViews || 0).toLocaleString()} đọc</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map((comic) => (
            <Link
              key={comic.id}
              href={`/studio/comics/${comic.id}`}
              className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all duration-200 hover:border-violet-500/20 hover:bg-white/[0.04]"
            >
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-800">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-600">{comic.title[0]}</div>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="truncate text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                  {comic.title}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                  <span>📖 {comic.stats?.totalChapters || 0} chương</span>
                  <span>👁️ {(comic.stats?.totalViews || 0).toLocaleString()} đọc</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusColor[comic.status] || statusColor.DRAFT}`}>
                {statusLabel[comic.status] || comic.status}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-white">Tạo truyện mới</h2>
            <p className="mb-6 text-sm text-zinc-500">Bắt đầu câu chuyện mới của bạn</p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Tên truyện *</label>
                <input
                  value={newComic.title}
                  onChange={(e) => setNewComic((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Nhập tên truyện"
                  autoFocus
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Mô tả</label>
                <textarea
                  value={newComic.description}
                  onChange={(e) => setNewComic((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả nội dung truyện..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newComic.title.trim()}
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:opacity-50"
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
