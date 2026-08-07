'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/studio/stat-card';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string;
  tags: string[];
  isPinned: boolean;
  isPublished: boolean;
  approvalStatus?: string;
  rejectionReason?: string | null;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  ANNOUNCEMENT: { label: 'Thông báo', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/20' },
  EVENT: { label: 'Sự kiện', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/20' },
  UPDATE: { label: 'Cập nhật', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/20' },
  COMMUNITY: { label: 'Cộng đồng', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/20' },
  FEATURED: { label: 'Nổi bật', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/20' },
};

const categoryOptions = [
  { value: 'ALL', label: 'Tất cả danh mục' },
  { value: 'ANNOUNCEMENT', label: 'Thông báo' },
  { value: 'EVENT', label: 'Sự kiện' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'COMMUNITY', label: 'Cộng đồng' },
  { value: 'FEATURED', label: 'Nổi bật' },
];

const statusOptions = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pinned', label: 'Đã ghim 📌' },
];

export default function StudioNewsPage() {
  const { accessToken } = useAuthStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchArticles = () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (search) params.set('search', search);

    api
      .get<{ data: NewsArticle[] }>(`/news/studio?${params.toString()}`, { token: accessToken })
      .then((res) => setArticles(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArticles();
  }, [accessToken, categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  const handleSubmitReview = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await api.post<{ data: { autoApproved: boolean; status: string } }>(
        `/news/${id}/submit-review`,
        {},
        { token: accessToken },
      );
      fetchArticles();
      alert(
        res.data.autoApproved
          ? 'Tác giả đã được xác minh. Bài viết đã được tự động phê duyệt!'
          : 'Đã gửi yêu cầu phê duyệt bài viết tới Ban Quản Trị.',
      );
    } catch (err: any) {
      alert(err?.message || 'Gửi yêu cầu thất bại');
    }
  };

  const handleTogglePublish = async (id: string) => {
    if (!accessToken) return;
    try {
      await api.post(`/news/${id}/publish`, {}, { token: accessToken });
      fetchArticles();
    } catch (err: unknown) {
      console.error('Failed to toggle publish status:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Không thể thay đổi trạng thái xuất bản';
      alert(msg);
    }
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    if (!accessToken) return;
    try {
      await api.put(`/news/${id}`, { isPinned: !currentPinStatus }, { token: accessToken });
      fetchArticles();
    } catch (err: unknown) {
      console.error('Failed to toggle pin status:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Không thể thay đổi trạng thái ghim';
      alert(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết tin tức này?')) return;
    try {
      await api.delete(`/news/${id}`, { token: accessToken });
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (err: unknown) {
      console.error('Failed to delete article:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Không thể xóa bài viết';
      alert(msg);
    }
  };

  const publishedCount = articles.filter((a) => a.isPublished).length;
  const draftCount = articles.filter((a) => !a.isPublished).length;
  const pinnedCount = articles.filter((a) => a.isPinned).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Quản lý Tin tức
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tạo, chỉnh sửa và quản lý các bài viết tin tức, thông báo, sự kiện trên hệ thống
          </p>
        </div>
        <Link
          href="/studio/news/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-500"
        >
          <i className="fa-solid fa-plus" />
          <span>Viết bài mới</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<i className="fa-solid fa-newspaper"></i>} label="Tổng bài viết" value={articles.length} gradient="from-violet-500 to-fuchsia-500" />
        <StatCard icon={<i className="fa-solid fa-circle-check"></i>} label="Đã xuất bản" value={publishedCount} gradient="from-emerald-500 to-teal-500" />
        <StatCard icon={<i className="fa-solid fa-file-pen"></i>} label="Bản nháp" value={draftCount} gradient="from-amber-500 to-orange-500" />
        <StatCard icon={<i className="fa-solid fa-thumbtack"></i>} label="Đã ghim" value={pinnedCount} gradient="from-pink-500 to-rose-500" />
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài viết theo tiêu đề..."
            className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-xs text-zinc-400" />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.06] [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.06] [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Lưới"
            >
              <i className="fa-solid fa-grid-2" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-zinc-200 dark:bg-white/[0.1] text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Danh sách"
            >
              <i className="fa-solid fa-list" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.01] p-8 text-center">
          <div className="mb-3 text-4xl"><i className="fa-regular fa-newspaper text-zinc-400" /></div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Chưa có bài viết nào</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            Bắt đầu tạo bài viết tin tức đầu tiên để cập nhật thông báo, sự kiện tới cộng đồng.
          </p>
          <Link
            href="/studio/news/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
          >
            <i className="fa-solid fa-plus" />
            <span>Viết bài ngay</span>
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const cat = categoryLabels[article.category] || { label: article.category, color: 'bg-zinc-500/15 text-zinc-600 border-zinc-300' };
            return (
              <div
                key={article.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] shadow-sm dark:shadow-none transition-all duration-300 hover:border-zinc-300 dark:hover:border-white/[0.12]"
              >
                {/* Cover Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-white/[0.02]">
                  {article.coverUrl ? (
                    <img
                      src={article.coverUrl}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <i className="fa-regular fa-image text-3xl opacity-40" />
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md ${cat.color}`}>
                      {cat.label}
                    </span>
                    {article.isPinned && (
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/80 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                        📌 Ghim
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute right-3 top-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md ${
                        article.isPublished
                          ? 'border-emerald-500/30 bg-emerald-500/80 text-white'
                          : 'border-zinc-500/30 bg-zinc-600/80 text-white'
                      }`}
                    >
                      {article.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-2 text-base font-bold text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-white/[0.04] text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>{new Date(article.createdAt).toLocaleDateString('vi-VN')}</span>
                    <span className="flex items-center gap-1">
                      <i className="fa-regular fa-eye" /> {article.viewCount}
                    </span>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="mt-4 flex items-center justify-between gap-1.5 pt-3 border-t border-zinc-100 dark:border-white/[0.04]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePublish(article.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          article.isPublished
                            ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.1]'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                        title={article.isPublished ? 'Hủy xuất bản' : 'Xuất bản'}
                      >
                        {article.isPublished ? 'Ẩn' : 'Đăng'}
                      </button>
                      <button
                        onClick={() => handleTogglePin(article.id, article.isPinned)}
                        className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                          article.isPinned
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-white'
                        }`}
                        title={article.isPinned ? 'Bỏ ghim' : 'Ghim bài'}
                      >
                        📌
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {article.isPublished && (
                        <Link
                          href={`/news/${article.slug}`}
                          target="_blank"
                          className="rounded-lg p-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white"
                          title="Xem trang công khai"
                        >
                          <i className="fa-regular fa-arrow-up-right-from-square" />
                        </Link>
                      )}
                      <Link
                        href={`/studio/news/${article.id}`}
                        className="rounded-lg p-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-violet-600 dark:hover:text-violet-400"
                        title="Chỉnh sửa bài viết"
                      >
                        <i className="fa-regular fa-pen-to-square" />
                      </Link>
                      <button
                        onClick={() => handleDelete(article.id)}
                        className="rounded-lg p-1.5 text-xs text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        title="Xóa bài viết"
                      >
                        <i className="fa-regular fa-trash-can" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="divide-y divide-zinc-200 dark:divide-white/[0.06] rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] overflow-hidden">
          {articles.map((article) => {
            const cat = categoryLabels[article.category] || { label: article.category, color: 'bg-zinc-500/15 text-zinc-600' };
            return (
              <div key={article.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-white/[0.02]">
                    {article.coverUrl ? (
                      <img src={article.coverUrl} alt={article.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <i className="fa-regular fa-newspaper" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${cat.color}`}>{cat.label}</span>
                      {article.isPinned && <span className="text-xs">📌</span>}
                      <span className={`text-[10px] font-semibold ${article.isPublished ? 'text-emerald-500' : 'text-zinc-400'}`}>
                        {article.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                      </span>
                    </div>
                    <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{article.title}</h4>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{article.excerpt || 'Không có tóm tắt'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-400"><i className="fa-regular fa-eye mr-1" />{article.viewCount}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePublish(article.id)}
                      className="rounded-lg border border-zinc-200 dark:border-white/[0.08] px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                    >
                      {article.isPublished ? 'Ẩn' : 'Đăng'}
                    </button>
                    <Link
                      href={`/studio/news/${article.id}`}
                      className="rounded-lg border border-zinc-200 dark:border-white/[0.08] p-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                    >
                      <i className="fa-regular fa-pen-to-square" />
                    </Link>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="rounded-lg border border-zinc-200 dark:border-white/[0.08] p-1.5 text-xs text-red-500 hover:bg-red-500/10"
                    >
                      <i className="fa-regular fa-trash-can" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
