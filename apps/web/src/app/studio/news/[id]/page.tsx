'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { NewsContentRenderer } from '@/components/news/news-content-renderer';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverUrl: string | null;
  category: string;
  tags: string[];
  isPinned: boolean;
  isPublished: boolean;
  approvalStatus?: string;
  rejectionReason?: string | null;
}

interface ArticleEvent {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'MODERATION';
  user?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
  content?: string;
  action?: string;
  createdAt: string;
}

interface ArticleStats {
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  approvalStatus: string;
  rejectionReason: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

const categoryOptions = [
  { value: 'ANNOUNCEMENT', label: 'Thông báo' },
  { value: 'EVENT', label: 'Sự kiện' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'COMMUNITY', label: 'Cộng đồng' },
  { value: 'FEATURED', label: 'Nổi bật' },
];

export default function EditNewsPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const articleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('ANNOUNCEMENT');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  // Stats & Events
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [events, setEvents] = useState<ArticleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Cover image mode: 'upload' | 'url'
  const [coverMode, setCoverMode] = useState<'upload' | 'url'>('upload');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Editor mode: 'write' | 'preview'
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  // Insert content image modal
  const [showImageModal, setShowImageModal] = useState(false);
  const [contentImageMode, setContentImageMode] = useState<'upload' | 'url'>('upload');
  const [contentImageUrl, setContentImageUrl] = useState('');
  const [contentImageAlt, setContentImageAlt] = useState('');
  const [uploadingContentImg, setUploadingContentImg] = useState(false);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchEvents = () => {
    if (!accessToken || !articleId) return;
    setEventsLoading(true);
    api
      .get<{ stats: ArticleStats; events: ArticleEvent[] }>(`/news/${articleId}/events`, { token: accessToken })
      .then((res) => {
        if (res) {
          setStats(res.stats || null);
          setEvents(res.events || []);
        }
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, [accessToken, articleId]);

  // Fetch article data
  useEffect(() => {
    if (!accessToken || !articleId) return;
    setLoading(true);
    api
      .get<{ data: NewsArticle }>(`/news/id/${articleId}`, { token: accessToken })
      .then((res) => {
        const a = res.data;
        if (a) {
          setTitle(a.title || '');
          setExcerpt(a.excerpt || '');
          setContent(a.content || '');
          setCategory(a.category || 'ANNOUNCEMENT');
          setTags(a.tags || []);
          setCoverUrl(a.coverUrl || '');
          setIsPinned(a.isPinned || false);
          setIsPublished(a.isPublished || false);
        }
      })
      .catch((err) => {
        console.error('Failed to load article:', err);
        setErrorMsg('Không thể tải dữ liệu bài viết.');
      })
      .finally(() => setLoading(false));
  }, [accessToken, articleId]);

  // Tags management
  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Upload Cover image
  const handleCoverFileSelected = async (file: File | null) => {
    if (!file || !accessToken) return;
    setUploadingCover(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<{ data: { url: string } }>('/upload/news/cover', formData, { token: accessToken });
      if (res.data?.url) {
        setCoverUrl(res.data.url);
      }
    } catch (err) {
      console.error('Failed to upload cover image:', err);
      setErrorMsg('Không thể tải ảnh bìa lên. Vui lòng thử lại.');
    } finally {
      setUploadingCover(false);
    }
  };

  // Upload Content Image & Insert into Textarea
  const handleContentImageUpload = async (file: File | null) => {
    if (!file || !accessToken) return;
    setUploadingContentImg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<{ data: { url: string } }>('/upload/news/content', formData, { token: accessToken });
      if (res.data?.url) {
        insertImageMarkdown(res.data.url, contentImageAlt || file.name);
        setShowImageModal(false);
        setContentImageUrl('');
        setContentImageAlt('');
      }
    } catch (err) {
      console.error('Failed to upload content image:', err);
      alert('Tải ảnh chèn vào bài thất bại!');
    } finally {
      setUploadingContentImg(false);
    }
  };

  const insertImageMarkdown = (url: string, alt = '') => {
    const markdown = `\n![${alt}](${url})\n`;
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = content.substring(0, start) + markdown + content.substring(end);
      setContent(newText);
    } else {
      setContent((prev) => prev + markdown);
    }
  };

  const handleInsertUrlImage = () => {
    if (!contentImageUrl.trim()) return;
    insertImageMarkdown(contentImageUrl.trim(), contentImageAlt.trim());
    setShowImageModal(false);
    setContentImageUrl('');
    setContentImageAlt('');
  };

  // Helper for quick formatting buttons
  const insertFormatting = (prefix: string, suffix = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'nội dung'}${suffix}`;
    const newText = content.substring(0, start) + replacement + content.substring(end);
    setContent(newText);
  };

  // Submit update form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung bài viết.');
      return;
    }
    if (!accessToken) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.put(
        `/news/${articleId}`,
        {
          title: title.trim(),
          excerpt: excerpt.trim() || undefined,
          content: content.trim(),
          coverUrl: coverUrl.trim() || undefined,
          category,
          tags,
          isPinned,
          isPublished,
        },
        { token: accessToken }
      );

      router.push('/studio/news');
    } catch (err: unknown) {
      console.error('Failed to update article:', err);
      setErrorMsg('Cập nhật bài viết thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken) return;
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
    try {
      await api.delete(`/news/${articleId}`, { token: accessToken });
      router.push('/studio/news');
    } catch (err) {
      console.error('Failed to delete article:', err);
      alert('Xóa bài viết thất bại.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/studio/news"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>Quay lại Quản lý tin tức</span>
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <i className="fa-regular fa-trash-can" />
          <span>Xóa bài viết</span>
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          Chỉnh sửa bài viết tin tức
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cập nhật thông tin, nội dung và các tùy chọn xuất bản của bài viết
        </p>
      </div>

      {/* Article Performance Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Lượt xem</span>
            <span>👁️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{stats?.viewCount || 0}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Lượt thích</span>
            <span>❤️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{stats?.likesCount || 0}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Bình luận</span>
            <span>💬</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{stats?.commentsCount || 0}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Phê duyệt</span>
            <span>🛡️</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                stats?.approvalStatus === 'APPROVED'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : stats?.approvalStatus === 'REJECTED'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}
            >
              {stats?.approvalStatus === 'APPROVED'
                ? '✅ Đã duyệt'
                : stats?.approvalStatus === 'REJECTED'
                ? '❌ Bị từ chối'
                : '⏳ Chờ duyệt'}
            </span>
          </div>
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {stats?.approvalStatus === 'REJECTED' && stats?.rejectionReason && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-300">
          <p className="font-bold text-sm">❌ Bài viết chưa được phê duyệt</p>
          <p className="mt-1">Lý do từ chối: "{stats.rejectionReason}"</p>
          <p className="mt-1 text-[11px] text-zinc-500">Vui lòng chỉnh sửa lại nội dung phù hợp rồi gửi lại yêu cầu phê duyệt.</p>
        </div>
      )}

      {/* Article Activity & Events Feed */}
      <div className="mb-8 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Thông báo sự kiện & Tương tác</h2>
            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
              {events.length} sự kiện
            </span>
          </div>
          <button
            type="button"
            onClick={fetchEvents}
            className="rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            🔄 Làm mới
          </button>
        </div>

        {eventsLoading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            Chưa có tương tác (thích, bình luận) nào trên bài viết này.
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] p-3 text-xs border border-zinc-100 dark:border-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  {ev.type === 'LIKE' && <span className="text-base">❤️</span>}
                  {ev.type === 'COMMENT' && <span className="text-base">💬</span>}
                  {ev.type === 'MODERATION' && <span className="text-base">🛡️</span>}

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {ev.user?.displayName || 'Hệ thống'}
                      </span>
                      {ev.user?.username && <span className="text-zinc-500">@{ev.user.username}</span>}
                    </div>

                    {ev.type === 'LIKE' && (
                      <p className="text-zinc-600 dark:text-zinc-400">Đã thả tim bài viết của bạn</p>
                    )}
                    {ev.type === 'COMMENT' && (
                      <p className="text-zinc-700 dark:text-zinc-300 italic bg-white dark:bg-white/5 p-2 rounded-lg mt-1 border border-zinc-200 dark:border-white/5">
                        "{ev.content}"
                      </p>
                    )}
                    {ev.type === 'MODERATION' && (
                      <p className="text-amber-600 dark:text-amber-400 font-medium">
                        {ev.action}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-zinc-400 shrink-0">
                  {new Date(ev.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-6 shadow-sm dark:shadow-none space-y-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-white/[0.06] pb-3">
            Thông tin bài viết
          </h2>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tiêu đề bài viết <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề hấp dẫn cho bài viết..."
              className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tóm tắt ngắn (Excerpt)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Mô tả ngắn gọn nội dung bài viết..."
              rows={2}
              className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Category & Tags Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white outline-none cursor-pointer focus:border-amber-500 [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Thẻ (Tags - Nhấn Enter để thêm)
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="ví dụ: event, manga, update"
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-300"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cover Image Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Ảnh bìa bài viết (Cover Image)
            </label>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setCoverMode('upload')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  coverMode === 'upload'
                    ? 'bg-amber-500 text-white'
                    : 'border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                Upload từ máy tính
              </button>
              <button
                type="button"
                onClick={() => setCoverMode('url')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  coverMode === 'url'
                    ? 'bg-amber-500 text-white'
                    : 'border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                Nhập Link ảnh (URL)
              </button>
            </div>

            {coverMode === 'upload' ? (
              <div>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCoverFileSelected(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.1] bg-zinc-50/50 dark:bg-white/[0.01] p-6 text-center transition-colors hover:border-amber-500 hover:bg-amber-500/5"
                >
                  {uploadingCover ? (
                    <div className="flex items-center gap-2 text-sm text-amber-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      <span>Đang upload ảnh bìa...</span>
                    </div>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nhấn để thay đổi ảnh bìa</span>
                      <span className="text-[11px] text-zinc-400 mt-0.5">Hỗ trợ JPG, PNG, WebP (Tỉ lệ 16:9)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://example.com/cover-image.jpg"
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-amber-500"
              />
            )}

            {/* Cover Preview */}
            {coverUrl && (
              <div className="relative mt-3 aspect-video max-w-md overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.08]">
                <img src={coverUrl} alt="Cover Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverUrl('')}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors text-xs"
                  title="Xóa ảnh bìa"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Options Switches */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Xuất bản bài viết</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">📌 Ghim bài viết lên đầu</span>
            </label>
          </div>
        </div>

        {/* 2-Tab Content Editor Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c0f] p-6 shadow-sm dark:shadow-none space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              Nội dung bài viết <span className="text-red-500">*</span>
            </h2>

            {/* 2 Tabs Toggle */}
            <div className="flex rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setEditorTab('write')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  editorTab === 'write'
                    ? 'bg-white dark:bg-[#1a1a1e] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <i className="fa-solid fa-pen" />
                <span>Soạn thảo</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorTab('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  editorTab === 'preview'
                    ? 'bg-white dark:bg-[#1a1a1e] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <i className="fa-solid fa-eye" />
                <span>Xem trước</span>
              </button>
            </div>
          </div>

          {editorTab === 'write' ? (
            <div>
              {/* Quick Formatting Toolbar */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-white/[0.02] p-1.5">
                <button
                  type="button"
                  onClick={() => insertFormatting('### ')}
                  className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                  title="Heading 3"
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**')}
                  className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                  title="In đậm"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*')}
                  className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] px-2.5 py-1 text-xs italic font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                  title="In nghiêng"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('> ')}
                  className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                  title="Trích dẫn"
                >
                  ” Quote
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('- ')}
                  className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                  title="Danh sách"
                >
                  • List
                </button>

                <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 mx-1" />

                {/* 🖼️ Insert Body Image Button */}
                <button
                  type="button"
                  onClick={() => setShowImageModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  <i className="fa-solid fa-image" />
                  <span>Chèn / Upload ảnh vào bài</span>
                </button>
              </div>

              {/* Markdown Editor Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung bài viết tin tức tại đây..."
                rows={16}
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] p-4 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                required
              />
            </div>
          ) : (
            /* Live Preview Mode */
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/30 dark:bg-white/[0.01] p-6 space-y-6">
              <div>
                <span className="inline-block rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-300 mb-3">
                  {categoryOptions.find((c) => c.value === category)?.label}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                  {title || 'Tiêu đề bài viết xem trước'}
                </h1>
                {excerpt && (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 italic">
                    {excerpt}
                  </p>
                )}
              </div>

              {coverUrl && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08]">
                  <img src={coverUrl} alt="Cover Preview" className="w-full aspect-video object-cover" />
                </div>
              )}

              <div>
                {content ? (
                  <NewsContentRenderer content={content} />
                ) : (
                  <span className="text-zinc-400 italic">Nội dung xem trước...</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Footer Action */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/studio/news"
            className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal: Insert Content Image */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#121216] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Chèn ảnh vào thân bài</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setContentImageMode('upload')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  contentImageMode === 'upload'
                    ? 'bg-amber-500 text-white'
                    : 'border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Upload từ máy
              </button>
              <button
                type="button"
                onClick={() => setContentImageMode('url')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  contentImageMode === 'url'
                    ? 'bg-amber-500 text-white'
                    : 'border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Nhập Link (URL)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Mô tả ảnh (Alt text)
              </label>
              <input
                type="text"
                value={contentImageAlt}
                onChange={(e) => setContentImageAlt(e.target.value)}
                placeholder="Ví dụ: Hình minh họa..."
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {contentImageMode === 'upload' ? (
              <div>
                <input
                  ref={contentFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleContentImageUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => contentFileInputRef.current?.click()}
                  disabled={uploadingContentImg}
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.1] bg-zinc-50 dark:bg-white/[0.01] p-5 text-center hover:border-amber-500"
                >
                  {uploadingContentImg ? (
                    <div className="flex items-center gap-2 text-xs text-amber-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      <span>Đang upload...</span>
                    </div>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up text-xl text-zinc-400 mb-1" />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Chọn hình ảnh để chèn</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  value={contentImageUrl}
                  onChange={(e) => setContentImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleInsertUrlImage}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Chèn ảnh
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
