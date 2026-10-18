'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

interface Comic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  status: string;
  contentRating: string;
  originalLanguage: string;
  stats: { totalViews: number; totalChapters: number; avgRating: number; totalBookmarks: number };
  genres: { id: string; name: string; slug: string }[];
  publishedAt: string | null;
}

interface Chapter {
  id: string;
  number: string;
  title: string | null;
  totalPages: number;
  views: number;
  approvalStatus?: string;
  rejectionReason?: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface EditForm {
  title: string;
  description: string;
  status: string;
  contentRating: string;
  genreIds: string[];
  bannerPosition: number;
}

const statusLabel: Record<string, string> = { DRAFT: 'Nháp', ONGOING: 'Đang ra', COMPLETED: 'Hoàn thành', HIATUS: 'Tạm dừng' };
const statusColor: Record<string, string> = {
  DRAFT: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-500/20',
  ONGOING: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/20',
  COMPLETED: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/20',
  HIATUS: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/20',
};
const contentRatingLabel: Record<string, string> = { EVERYONE: 'Mọi người', TEEN: 'Thanh thiếu niên (13+)', MATURE: 'Người lớn (18+)' };

type Tab = 'info' | 'chapters' | 'stats';

export default function StudioComicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Edit form
  const [editForm, setEditForm] = useState<EditForm>({ title: '', description: '', status: 'DRAFT', contentRating: 'EVERYONE', genreIds: [], bannerPosition: 50 });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Chapter actions
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ number: 1, title: '' });
  const [addingChapter, setAddingChapter] = useState(false);

  useEffect(() => {
    if (!accessToken || !params.id) return;

    Promise.all([
      api.get<{ data: Comic[] }>('/comics/author/my-comics', { token: accessToken })
        .then((r) => (r.data as unknown as Comic[]).find((c: Comic) => c.id === params.id) || null),
      api.get<{ data: Chapter[] }>(`/comics/${params.id}/chapters`),
      api.get<{ data: Genre[] }>('/comics/genres'),
    ])
      .then(([c, chRes, gRes]) => {
        setComic(c);
        setChapters(chRes.data);
        setAllGenres(gRes.data);
        if (c) {
          setEditForm({
            title: c.title,
            description: c.description || '',
            status: c.status,
            contentRating: c.contentRating || 'EVERYONE',
            genreIds: c.genres.map((g) => g.id),
            bannerPosition: c.bannerPosition ?? 50,
          });
          setCoverPreview(c.coverUrl);
          setBannerPreview(c.bannerUrl);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, params.id]);

  // ── Save ──
  const handleSave = async () => {
    if (!accessToken || !comic) return;
    setSaving(true);
    try {
      if (coverFile) {
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('file', coverFile);
        const coverRes = await api.upload<{ data: { url: string } }>(`/upload/comics/${comic.id}/cover`, fd, { token: accessToken });
        setUploadingCover(false);
        setComic((prev) => prev ? { ...prev, coverUrl: coverRes.data.url } : prev);
      }
      if (bannerFile) {
        const fd = new FormData();
        fd.append('file', bannerFile);
        const bannerRes = await api.upload<{ data: { url: string } }>(`/upload/comics/${comic.id}/banner`, fd, { token: accessToken });
        setComic((prev) => prev ? { ...prev, bannerUrl: bannerRes.data.url } : prev);
      }
      const res = await api.put<{ data: Comic }>(`/comics/${comic.id}`, editForm, { token: accessToken });
      setComic((prev) => {
        if (!prev) return prev;
        const updated = res.data || prev;
        return { ...prev, title: editForm.title, description: editForm.description, status: editForm.status, contentRating: editForm.contentRating, bannerPosition: editForm.bannerPosition, genres: updated.genres || prev.genres, slug: updated.slug || prev.slug };
      });
      setCoverFile(null);
      setBannerFile(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  const handleCoverSelected = (file: File | null) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleBannerSelected = (file: File | null) => {
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const toggleGenre = (genreId: string) => {
    setEditForm((prev) => ({
      ...prev,
      genreIds: prev.genreIds.includes(genreId) ? prev.genreIds.filter((id) => id !== genreId) : [...prev.genreIds, genreId],
    }));
  };

  // ── Chapter Actions ──
  const handlePublish = async () => {
    if (!accessToken || !comic) return;
    try {
      await api.post(`/comics/${comic.id}/publish`, {}, { token: accessToken });
      setComic((prev) => prev ? { ...prev, status: 'ONGOING', publishedAt: new Date().toISOString() } : prev);
      setEditForm((prev) => ({ ...prev, status: 'ONGOING' }));
    } catch {}
  };

  const handleAddChapter = async () => {
    if (!accessToken || !comic) return;
    setAddingChapter(true);
    try {
      const res = await api.post<{ data: Chapter }>(`/comics/${comic.id}/chapters`, newChapter, { token: accessToken });
      setChapters((prev) => [...prev, res.data]);
      setShowAddChapter(false);
      setNewChapter({ number: chapters.length + 2, title: '' });
    } catch {}
    setAddingChapter(false);
  };

  const handlePublishChapter = async (chapterId: string) => {
    if (!accessToken) return;
    try {
      const res = await api.post<{ data: { autoApproved: boolean; status: string } }>(
        `/chapters/${chapterId}/submit-review`,
        {},
        { token: accessToken },
      );
      setChapters((prev) =>
        prev.map((ch) => (ch.id === chapterId ? { ...ch, approvalStatus: res.data.status, rejectionReason: null } : ch)),
      );
      alert(
        res.data.autoApproved
          ? 'Tác giả đã được xác minh. Chương truyện đã được tự động phê duyệt!'
          : 'Đã gửi yêu cầu phê duyệt chương truyện tới Ban Quản Trị.',
      );
    } catch (err: any) {
      alert(err?.message || 'Gửi yêu cầu thất bại');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!accessToken || !confirm('Xóa chapter này?')) return;
    try {
      await api.delete(`/chapters/${chapterId}`, { token: accessToken });
      setChapters((prev) => prev.filter((ch) => ch.id !== chapterId));
    } catch {}
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" /></div>;
  if (!comic) return <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">Truyện không tồn tại hoặc bạn không có quyền.</div>;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'info', label: 'Thông tin', icon: '📝' },
    { key: 'chapters', label: 'Chương', icon: '📖' },
    { key: 'stats', label: 'Thống kê', icon: '📈' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-3.5 py-4 sm:px-6 sm:py-8">
      {/* Comic Header */}
      <div className="mb-4 sm:mb-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-sm dark:shadow-none">
        {/* Banner */}
        {comic.bannerUrl && (
          <div className="relative h-28 sm:h-36 w-full">
            <img src={comic.bannerUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-[#0c0c0f]" />
          </div>
        )}
        <div className={`flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5 sm:gap-5 p-4 sm:p-6 ${comic.bannerUrl ? '-mt-10 sm:-mt-10 relative' : ''}`}>
          <div className="shrink-0">
            {comic.coverUrl ? (
              <img src={comic.coverUrl} alt={comic.title} className="h-24 w-18 sm:h-28 sm:w-20 rounded-lg border-2 border-white dark:border-[#0c0c0f] object-cover shadow-lg" />
            ) : (
              <div className="flex h-24 w-18 sm:h-28 sm:w-20 items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-white/20 bg-zinc-100 dark:bg-white/5 text-2xl text-zinc-400 dark:text-zinc-600">📖</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white truncate max-w-full">{comic.title}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-medium border ${statusColor[comic.status] || statusColor.DRAFT}`}>
                {statusLabel[comic.status] || comic.status}
              </span>
            </div>
            {comic.description && <p className="mb-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{comic.description}</p>}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-4 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
              <span>📖 {comic.stats.totalChapters} chương</span>
              <span>👁️ {comic.stats.totalViews.toLocaleString()} đọc</span>
              <span>⭐ {comic.stats.avgRating}</span>
              <span>🔖 {comic.stats.totalBookmarks}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 w-full sm:w-auto justify-center sm:justify-start pt-2 sm:pt-0">
            {comic.status === 'DRAFT' && (
              <button onClick={handlePublish} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500">
                🚀 Xuất bản
              </button>
            )}
            <Link href={`/comics/${comic.slug}`} className="rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-white">
              👁️ Xem
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.02] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="space-y-6 animate-fade-in">
          {/* Cover & Banner */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Cover */}
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none">
              <label className="mb-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Ảnh bìa</label>
              <div className="flex items-start gap-4">
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="group relative h-40 w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-dashed border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/5 transition-all hover:border-amber-500/50"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                      <span className="text-2xl">📷</span>
                      <span className="mt-1 text-[10px]">Chọn ảnh</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-xs text-white">Đổi ảnh</span>
                  </div>
                  <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleCoverSelected(e.target.files?.[0] || null)} className="hidden" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  <p>Tỉ lệ 3:4 (600×850px)</p>
                  <p className="mt-1">JPEG, PNG, WebP</p>
                  {coverFile && <p className="mt-2 text-emerald-600 dark:text-emerald-400 font-medium">✅ {coverFile.name}</p>}
                </div>
              </div>
            </div>

            {/* Banner */}
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none">
              <label className="mb-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Ảnh banner</label>
              <div
                onClick={() => bannerInputRef.current?.click()}
                className="group relative h-28 w-full cursor-pointer overflow-hidden rounded-lg border border-dashed border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/5 transition-all hover:border-amber-500/50"
              >
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" style={{ objectPosition: `center ${editForm.bannerPosition}%` }} />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                    <span className="text-2xl">🖼️</span>
                    <span className="mt-1 text-xs">Chọn banner</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-xs text-white">Đổi banner</span>
                </div>
                <input ref={bannerInputRef} type="file" accept="image/*" onChange={(e) => handleBannerSelected(e.target.files?.[0] || null)} className="hidden" />
              </div>
              {bannerPreview && (
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Vị trí: {editForm.bannerPosition}%</span>
                  <input type="range" min={0} max={100} value={editForm.bannerPosition} onChange={(e) => setEditForm((f) => ({ ...f, bannerPosition: Number(e.target.value) }))} className="flex-1 accent-amber-500" />
                </div>
              )}
              {bannerFile && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">✅ {bannerFile.name}</p>}
            </div>
          </div>

          {/* Title & Description */}
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tên truyện</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mô tả</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Mô tả nội dung truyện..."
                className="w-full resize-none rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Trạng thái</label>
                <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white">
                  <option value="DRAFT">📝 Nháp</option>
                  <option value="ONGOING">🟢 Đang ra</option>
                  <option value="COMPLETED">✅ Hoàn thành</option>
                  <option value="HIATUS">⏸️ Tạm dừng</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Đánh giá nội dung</label>
                <select value={editForm.contentRating} onChange={(e) => setEditForm((f) => ({ ...f, contentRating: e.target.value }))} className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white">
                  <option value="EVERYONE">🌐 Mọi người</option>
                  <option value="TEEN">🔵 Thanh thiếu niên (13+)</option>
                  <option value="MATURE">🔴 Người lớn (18+)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Genres */}
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none">
            <label className="mb-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Thể loại {editForm.genreIds.length > 0 && <span className="text-xs text-zinc-500">({editForm.genreIds.length} đã chọn)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {allGenres.map((genre) => {
                const selected = editForm.genreIds.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      selected ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {genre.icon && <span className="mr-1">{genre.icon}</span>}
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !editForm.title.trim()}
              className={`rounded-lg px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-50 ${
                saveSuccess
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25 hover:shadow-amber-500/40'
              }`}
            >
              {saving ? (uploadingCover ? 'Đang upload ảnh...' : 'Đang lưu...') : saveSuccess ? '✓ Đã lưu thay đổi' : '💾 Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'chapters' && (
        <div className="animate-fade-in">
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">Danh sách chương ({chapters.length})</h2>
            <button
              onClick={() => { setNewChapter({ number: chapters.length + 1, title: '' }); setShowAddChapter(true); }}
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-amber-500/25 shrink-0"
            >
              + Thêm chương
            </button>
          </div>

          {/* Add chapter form */}
          {showAddChapter && (
            <div className="mb-4 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 p-3 sm:p-4 animate-slide-up">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex gap-2 flex-1">
                  <input type="number" value={newChapter.number} onChange={(e) => setNewChapter((n) => ({ ...n, number: Number(e.target.value) }))} placeholder="Số" className="w-20 sm:w-24 shrink-0 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none" />
                  <input value={newChapter.title} onChange={(e) => setNewChapter((n) => ({ ...n, title: e.target.value }))} placeholder="Tiêu đề (tùy chọn)" className="flex-1 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none" />
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <button onClick={handleAddChapter} disabled={addingChapter} className="rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs sm:text-sm font-medium text-white disabled:opacity-50">{addingChapter ? '...' : 'Thêm'}</button>
                  <button onClick={() => setShowAddChapter(false)} className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1">Hủy</button>
                </div>
              </div>
            </div>
          )}

          {chapters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.08] bg-white dark:bg-transparent p-10 sm:p-16 text-center shadow-sm dark:shadow-none">
              <div className="mb-2 sm:mb-3 text-3xl sm:text-4xl">📄</div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Chưa có chương nào. Thêm chương đầu tiên!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => (
                <div
                  key={ch.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3 sm:px-5 sm:py-4 shadow-sm dark:shadow-none transition-all duration-200 hover:border-zinc-300 dark:hover:border-white/[0.1] hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">Chương {ch.number}</span>
                      {ch.title && <span className="text-xs sm:text-sm text-zinc-500 truncate max-w-[160px] sm:max-w-xs">— {ch.title}</span>}
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${
                        ch.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : ch.approvalStatus === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : ch.approvalStatus === 'REJECTED'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                          : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      }`}>
                        {ch.approvalStatus === 'APPROVED' ? '✅ Đã duyệt' : ch.approvalStatus === 'PENDING_APPROVAL' ? '⏳ Chờ duyệt' : ch.approvalStatus === 'REJECTED' ? '❌ Bị từ chối' : '📝 Bản nháp'}
                      </span>
                    </div>
                    {ch.approvalStatus === 'REJECTED' && ch.rejectionReason && (
                      <p className="mt-1 text-[11px] sm:text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-1.5 rounded border border-red-500/20">
                        Lý do từ chối: {ch.rejectionReason}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                      <span>📄 {ch.totalPages} trang</span>
                      <span>👁️ {ch.views} views</span>
                      {ch.publishedAt && <span>📅 {new Date(ch.publishedAt).toLocaleDateString('vi-VN')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto shrink-0">
                    <Link
                      href={`/studio/comics/${params.id}/chapters/${ch.id}`}
                      className="rounded-lg bg-amber-500/15 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/25"
                    >
                      🎨 Editor
                    </Link>
                    {(ch.approvalStatus === 'DRAFT' || ch.approvalStatus === 'REJECTED' || !ch.approvalStatus) && (
                      <button onClick={() => handlePublishChapter(ch.id)} className="rounded-lg bg-amber-500/15 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/25 border border-amber-500/30">
                        {ch.approvalStatus === 'REJECTED' ? 'Sửa & Gửi lại' : 'Gửi duyệt'}
                      </button>
                    )}
                    <button onClick={() => handleDeleteChapter(ch.id)} className="rounded-lg bg-red-500/10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20">
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5 sm:p-5 text-center shadow-sm dark:shadow-none">
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">{comic.stats.totalViews.toLocaleString()}</div>
              <div className="mt-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Lượt đọc</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5 sm:p-5 text-center shadow-sm dark:shadow-none">
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">{comic.stats.totalChapters}</div>
              <div className="mt-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Chương</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5 sm:p-5 text-center shadow-sm dark:shadow-none">
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">⭐ {comic.stats.avgRating}</div>
              <div className="mt-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Đánh giá TB</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5 sm:p-5 text-center shadow-sm dark:shadow-none">
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">{comic.stats.totalBookmarks}</div>
              <div className="mt-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Bookmark</div>
            </div>
          </div>
          <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Thống kê chi tiết sẽ được cập nhật trong phiên bản tiếp theo.</p>
        </div>
      )}
    </div>
  );
}
