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
  publishedAt: string | null;
  createdAt: string;
}

interface PageData {
  id: string;
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
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
  DRAFT: 'bg-zinc-500/20 text-zinc-300',
  ONGOING: 'bg-emerald-500/20 text-emerald-300',
  COMPLETED: 'bg-violet-500/20 text-violet-300',
  HIATUS: 'bg-amber-500/20 text-amber-300',
};
const contentRatingLabel: Record<string, string> = { EVERYONE: 'Mọi người', TEEN: 'Thanh thiếu niên (13+)', MATURE: 'Người lớn (18+)' };

export default function ManageComicPage() {
  const params = useParams();
  const router = useRouter();
  const { user, accessToken, isHydrated } = useAuthStore();
  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', description: '', status: 'DRAFT', contentRating: 'EVERYONE', genreIds: [], bannerPosition: 50 });
  const [saving, setSaving] = useState(false);
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Add chapter state
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ number: 1, title: '' });
  const [addingChapter, setAddingChapter] = useState(false);

  // Page management state
  const [managingChapterId, setManagingChapterId] = useState<string | null>(null);
  const [chapterPages, setChapterPages] = useState<PageData[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isHydrated && !user) router.push('/login');
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (!accessToken || !params.id) return;

    Promise.all([
      api.get<{ data: Comic }>(`/comics/author/my-comics`, { token: accessToken })
        .then((r) => {
          const found = (r.data as unknown as Comic[]).find((c: Comic) => c.id === params.id);
          return found || null;
        }),
      api.get<{ data: Chapter[] }>(`/comics/${params.id}/chapters`),
      api.get<{ data: Genre[] }>('/comics/genres'),
    ])
      .then(([c, chRes, gRes]) => {
        setComic(c);
        setChapters(chRes.data);
        setAllGenres(gRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, params.id]);

  // ── Edit Modal ──

  const openEditModal = () => {
    if (!comic) return;
    setEditForm({
      title: comic.title,
      description: comic.description || '',
      status: comic.status,
      contentRating: comic.contentRating || 'EVERYONE',
      genreIds: comic.genres.map((g) => g.id),
      bannerPosition: comic.bannerPosition ?? 50,
    });
    setCoverFile(null);
    setCoverPreview(comic.coverUrl || null);
    setBannerFile(null);
    setBannerPreview(comic.bannerUrl || null);
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!accessToken || !comic) return;
    setSaving(true);
    try {
      // Upload cover first if selected
      if (coverFile) {
        setUploadingCover(true);
        const formData = new FormData();
        formData.append('file', coverFile);
        const coverRes = await api.upload<{ data: { url: string } }>(
          `/upload/comics/${comic.id}/cover`,
          formData,
          { token: accessToken },
        );
        setUploadingCover(false);
        setComic((prev) => prev ? { ...prev, coverUrl: coverRes.data.url } : prev);
      }

      // Upload banner if selected
      if (bannerFile) {
        const formData = new FormData();
        formData.append('file', bannerFile);
        const bannerRes = await api.upload<{ data: { url: string } }>(
          `/upload/comics/${comic.id}/banner`,
          formData,
          { token: accessToken },
        );
        setComic((prev) => prev ? { ...prev, bannerUrl: bannerRes.data.url } : prev);
      }

      // Update comic metadata
      const res = await api.put<{ data: Comic }>(`/comics/${comic.id}`, editForm, { token: accessToken });

      // Refresh comic data with updated info
      setComic((prev) => {
        if (!prev) return prev;
        const updated = res.data || prev;
        return {
          ...prev,
          title: editForm.title || prev.title,
          description: editForm.description,
          status: editForm.status,
          contentRating: editForm.contentRating,
          bannerPosition: editForm.bannerPosition,
          genres: updated.genres || prev.genres,
          slug: updated.slug || prev.slug,
        };
      });

      setShowEditModal(false);
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
      genreIds: prev.genreIds.includes(genreId)
        ? prev.genreIds.filter((id) => id !== genreId)
        : [...prev.genreIds, genreId],
    }));
  };

  // ── Chapter Actions ──

  const handlePublish = async () => {
    if (!accessToken || !comic) return;
    try {
      await api.post(`/comics/${comic.id}/publish`, {}, { token: accessToken });
      setComic((prev) => prev ? { ...prev, status: 'ONGOING', publishedAt: new Date().toISOString() } : prev);
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
      await api.post(`/chapters/${chapterId}/publish`, {}, { token: accessToken });
      setChapters((prev) => prev.map((ch) => ch.id === chapterId ? { ...ch, publishedAt: new Date().toISOString() } : ch));
    } catch {}
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!accessToken || !confirm('Xóa chapter này?')) return;
    try {
      await api.delete(`/chapters/${chapterId}`, { token: accessToken });
      setChapters((prev) => prev.filter((ch) => ch.id !== chapterId));
      if (managingChapterId === chapterId) closePageManager();
    } catch {}
  };

  // ── Page Management ──

  const openPageManager = async (chapterId: string) => {
    if (managingChapterId === chapterId) {
      closePageManager();
      return;
    }
    setManagingChapterId(chapterId);
    setSelectedFiles([]);
    setPreviews([]);
    setLoadingPages(true);

    try {
      const res = await api.get<{ data: { pages: PageData[] } }>(`/chapters/${chapterId}`);
      setChapterPages(res.data.pages || []);
    } catch {
      setChapterPages([]);
    }
    setLoadingPages(false);
  };

  const closePageManager = () => {
    setManagingChapterId(null);
    setChapterPages([]);
    setSelectedFiles([]);
    setPreviews([]);
    setUploadProgress(0);
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setSelectedFiles(fileArr);
    const urls = fileArr.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadPages = async () => {
    if (!accessToken || !managingChapterId || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('files', file));
      setUploadProgress(30);

      const res = await api.upload<{ data: { urls: string[]; count: number } }>(
        `/upload/chapters/${managingChapterId}/pages`,
        formData,
        { token: accessToken },
      );
      setUploadProgress(90);

      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === managingChapterId ? { ...ch, totalPages: res.data.count } : ch,
        ),
      );

      const chRes = await api.get<{ data: { pages: PageData[] } }>(`/chapters/${managingChapterId}`);
      setChapterPages(chRes.data.pages || []);

      previews.forEach((url) => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviews([]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1500);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProgress(0);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  if (loading || !isHydrated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>;
  if (!comic) return <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">Truyện không tồn tại hoặc bạn không có quyền.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back */}
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white">← Dashboard</Link>

      {/* Comic Info */}
      <div className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {/* Banner */}
        {comic.bannerUrl && (
          <div className="relative h-36 w-full">
            <img src={comic.bannerUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]" />
          </div>
        )}
        <div className={`flex items-start gap-5 p-6 ${comic.bannerUrl ? '-mt-10 relative' : ''}`}>
          {/* Cover thumbnail */}
          <div className="shrink-0">
            {comic.coverUrl ? (
              <img src={comic.coverUrl} alt={comic.title} className="h-32 w-24 rounded-lg border border-white/10 object-cover" />
            ) : (
              <div className="flex h-32 w-24 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 text-2xl text-zinc-600">📖</div>
            )}
          </div>

          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{comic.title}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[comic.status] || statusColor.DRAFT}`}>
                {statusLabel[comic.status] || comic.status}
              </span>
            </div>
            {comic.description && <p className="mb-2 text-sm text-zinc-400 line-clamp-2">{comic.description}</p>}
            {comic.genres.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {comic.genres.map((g) => (
                  <span key={g.id} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">{g.name}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>📖 {comic.stats.totalChapters} chương</span>
              <span>👁️ {comic.stats.totalViews} lượt đọc</span>
              <span>⭐ {comic.stats.avgRating}</span>
              <span>🔖 {comic.stats.totalBookmarks}</span>
              <span>🔞 {contentRatingLabel[comic.contentRating] || comic.contentRating}</span>
            </div>
          </div>

          <div className="ml-4 flex flex-col gap-2">
            <button onClick={openEditModal} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              ✏️ Chỉnh sửa
            </button>
            {comic.status === 'DRAFT' && (
              <button onClick={handlePublish} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white">
                🚀 Xuất bản
              </button>
            )}
            <Link href={`/comics/${comic.slug}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center text-xs text-zinc-400 hover:text-white transition-colors">
              👁️ Xem
            </Link>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Danh sách chương ({chapters.length})</h2>
          <button
            onClick={() => { setNewChapter({ number: chapters.length + 1, title: '' }); setShowAddChapter(true); }}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
          >
            + Thêm chương
          </button>
        </div>

        {/* Add chapter form */}
        {showAddChapter && (
          <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex gap-3">
              <input
                type="number"
                value={newChapter.number}
                onChange={(e) => setNewChapter((n) => ({ ...n, number: Number(e.target.value) }))}
                placeholder="Số chương"
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                value={newChapter.title}
                onChange={(e) => setNewChapter((n) => ({ ...n, title: e.target.value }))}
                placeholder="Tiêu đề (tùy chọn)"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              />
              <button onClick={handleAddChapter} disabled={addingChapter} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                {addingChapter ? '...' : 'Thêm'}
              </button>
              <button onClick={() => setShowAddChapter(false)} className="text-sm text-zinc-500">Hủy</button>
            </div>
          </div>
        )}

        {chapters.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Chưa có chương nào. Thêm chương đầu tiên!</p>
        ) : (
          <div className="space-y-2">
            {chapters.map((ch) => (
              <div key={ch.id}>
                {/* Chapter Row */}
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-white">Chương {ch.number}</span>
                    {ch.title && <span className="ml-2 text-sm text-zinc-500">— {ch.title}</span>}
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-600">
                      <span>📄 {ch.totalPages} trang</span>
                      <span>👁️ {ch.views} views</span>
                      <span>{ch.publishedAt ? `✅ ${new Date(ch.publishedAt).toLocaleDateString('vi-VN')}` : '📝 Nháp'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openPageManager(ch.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        managingChapterId === ch.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-violet-600/20 text-violet-300 hover:bg-violet-600/30'
                      }`}
                    >
                      📷 Quản lý trang
                    </button>
                    {!ch.publishedAt && (
                      <button onClick={() => handlePublishChapter(ch.id)} className="rounded-md bg-emerald-600/80 px-2.5 py-1 text-xs text-white">
                        Xuất bản
                      </button>
                    )}
                    <button onClick={() => handleDeleteChapter(ch.id)} className="rounded-md bg-red-600/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-600/30">
                      Xóa
                    </button>
                  </div>
                </div>

                {/* Page Manager Panel */}
                {managingChapterId === ch.id && (
                  <div className="mt-1 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    {loadingPages ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                      </div>
                    ) : (
                      <>
                        {chapterPages.length > 0 && (
                          <div className="mb-4">
                            <h4 className="mb-2 text-sm font-medium text-zinc-300">Trang hiện tại ({chapterPages.length})</h4>
                            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                              {chapterPages.map((page) => (
                                <div key={page.id} className="group relative aspect-[3/4] overflow-hidden rounded-md border border-white/10 bg-black/30">
                                  <img src={page.imageUrl} alt={`Trang ${page.pageNumber}`} className="h-full w-full object-cover" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 text-center text-[10px] text-zinc-300">{page.pageNumber}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-zinc-300">
                            {chapterPages.length > 0 ? 'Upload lại (thay thế toàn bộ)' : 'Upload trang'}
                          </h4>
                          <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer rounded-lg border-2 border-dashed border-white/10 p-6 text-center transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
                          >
                            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
                            <div className="text-3xl">🖼️</div>
                            <p className="mt-2 text-sm text-zinc-400">Kéo thả ảnh vào đây hoặc <span className="text-violet-400 underline">click để chọn</span></p>
                            <p className="mt-1 text-xs text-zinc-600">JPEG, PNG, WebP, GIF — tối đa 10MB/ảnh</p>
                          </div>

                          {selectedFiles.length > 0 && (
                            <div className="mt-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs text-zinc-400">Đã chọn {selectedFiles.length} ảnh</span>
                                <button onClick={() => { previews.forEach((u) => URL.revokeObjectURL(u)); setSelectedFiles([]); setPreviews([]); }} className="text-xs text-red-400 hover:text-red-300">Xóa tất cả</button>
                              </div>
                              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                                {previews.map((url, i) => (
                                  <div key={i} className="group relative aspect-[3/4] overflow-hidden rounded-md border border-white/10">
                                    <img src={url} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 text-center text-[10px] text-zinc-300">{i + 1}</div>
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600/80 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">×</button>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <button onClick={handleUploadPages} disabled={uploading} className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                  {uploading ? 'Đang upload...' : `Upload ${selectedFiles.length} trang`}
                                </button>
                                {uploadProgress > 0 && (
                                  <div className="flex-1">
                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                  </div>
                                )}
                                {uploadProgress === 100 && <span className="text-xs text-emerald-400">✅ Hoàn tất!</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300 ${
          showEditModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowEditModal(false)}
      >
        <div
          className={`relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl transition-all duration-300 ${
            showEditModal ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-6 text-xl font-bold text-white">Chỉnh sửa truyện</h2>

          <div className="space-y-5">
            {/* Cover Image */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Ảnh bìa</label>
              <div className="flex items-start gap-4">
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="group relative h-40 w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-dashed border-white/20 bg-white/5 transition-colors hover:border-violet-500/40"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-zinc-600">
                      <span className="text-2xl">📷</span>
                      <span className="mt-1 text-[10px]">Chọn ảnh</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-xs text-white">Đổi ảnh</span>
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverSelected(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
                <div className="text-xs text-zinc-500">
                  <p>Tỉ lệ khuyến nghị: 3:4 (600×850px)</p>
                  <p className="mt-1">Định dạng: JPEG, PNG, WebP</p>
                  {coverFile && <p className="mt-2 text-emerald-400">✅ Đã chọn: {coverFile.name}</p>}
                </div>
              </div>
            </div>

            {/* Banner Image */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Ảnh banner</label>
              <div
                onClick={() => bannerInputRef.current?.click()}
                className="group relative h-32 w-full cursor-pointer overflow-hidden rounded-lg border border-dashed border-white/20 bg-white/5 transition-colors hover:border-violet-500/40"
              >
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" style={{ objectPosition: `center ${editForm.bannerPosition}%` }} />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-zinc-600">
                    <span className="text-2xl">🖼️</span>
                    <span className="mt-1 text-xs">Chọn ảnh banner</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-xs text-white">Đổi banner</span>
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleBannerSelected(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
                <span>Tỉ lệ khuyến nghị: 3:1 (1200×400px)</span>
                {bannerFile && <span className="text-emerald-400">✅ Đã chọn: {bannerFile.name}</span>}
              </div>

              {/* Banner Position Slider - only when banner exists */}
              {bannerPreview && (
                <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400">Vị trí hiển thị</label>
                    <span className="text-xs text-zinc-500">{editForm.bannerPosition}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-600">Trên</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editForm.bannerPosition}
                      onChange={(e) => setEditForm((f) => ({ ...f, bannerPosition: Number(e.target.value) }))}
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-[10px] text-zinc-600">Dưới</span>
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Tên truyện</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Mô tả</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Mô tả nội dung truyện..."
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {/* Status + Content Rating row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Trạng thái</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                >
                  <option value="DRAFT">📝 Nháp</option>
                  <option value="ONGOING">🟢 Đang ra</option>
                  <option value="COMPLETED">✅ Hoàn thành</option>
                  <option value="HIATUS">⏸️ Tạm dừng</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Đánh giá nội dung</label>
                <select
                  value={editForm.contentRating}
                  onChange={(e) => setEditForm((f) => ({ ...f, contentRating: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                >
                  <option value="EVERYONE">🌐 Mọi người</option>
                  <option value="TEEN">🔵 Thanh thiếu niên (13+)</option>
                  <option value="MATURE">🔴 Người lớn (18+)</option>
                </select>
              </div>
            </div>

            {/* Genres */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
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
                        selected
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {genre.icon && <span className="mr-1">{genre.icon}</span>}
                      {genre.name}
                    </button>
                  );
                })}
                {allGenres.length === 0 && <p className="text-xs text-zinc-600">Không có thể loại nào.</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-end gap-3 border-t border-white/5 pt-4">
            <button
              onClick={() => setShowEditModal(false)}
              className="rounded-lg px-5 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editForm.title.trim()}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50 transition-all hover:shadow-violet-500/40"
            >
              {saving ? (uploadingCover ? 'Đang upload ảnh...' : 'Đang lưu...') : '💾 Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
