'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { NewsContentRenderer } from '@/components/news/news-content-renderer';

const categoryOptions = [
  { value: 'ANNOUNCEMENT', label: 'Thông báo' },
  { value: 'EVENT', label: 'Sự kiện' },
  { value: 'UPDATE', label: 'Cập nhật' },
  { value: 'COMMUNITY', label: 'Cộng đồng' },
  { value: 'FEATURED', label: 'Nổi bật' },
];

export default function CreateNewsPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('ANNOUNCEMENT');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

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

  // Submit form
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
      await api.post(
        '/news',
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
      console.error('Failed to create article:', err);
      setErrorMsg('Tạo bài viết thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/studio/news"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>Quay lại Quản lý tin tức</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          Tạo bài viết tin tức mới
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Soạn thảo thông báo, tin tức hoặc sự kiện mới hiển thị tới độc giả trên hệ thống
        </p>
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
              className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
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
              placeholder="Mô tả ngắn gọn nội dung bài viết (hiển thị trên card bản tin)..."
              rows={2}
              className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
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
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white outline-none cursor-pointer focus:border-violet-500 [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white"
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
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-300"
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
                    ? 'bg-violet-600 text-white'
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
                    ? 'bg-violet-600 text-white'
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
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.1] bg-zinc-50/50 dark:bg-white/[0.01] p-6 text-center transition-colors hover:border-violet-500 hover:bg-violet-500/5"
                >
                  {uploadingCover ? (
                    <div className="flex items-center gap-2 text-sm text-violet-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                      <span>Đang upload ảnh bìa...</span>
                    </div>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nhấn để chọn file ảnh bìa</span>
                      <span className="text-[11px] text-zinc-400 mt-0.5">Hỗ trợ JPG, PNG, WebP (Khuyến nghị tỉ lệ 16:9)</span>
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
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-violet-500"
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
                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Xuất bản ngay</span>
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
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 transition-colors"
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
                placeholder="Nhập nội dung bài viết tin tức tại đây... Hỗ trợ cú pháp Markdown hoặc HTML."
                rows={16}
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.02] p-4 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                required
              />
            </div>
          ) : (
            /* Live Preview Mode */
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/30 dark:bg-white/[0.01] p-6 space-y-6">
              {/* Preview Header */}
              <div>
                <span className="inline-block rounded-md bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-300 mb-3">
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

              {/* Cover image in preview */}
              {coverUrl && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08]">
                  <img src={coverUrl} alt="Cover Preview" className="w-full aspect-video object-cover" />
                </div>
              )}

              {/* Body Content preview */}
              <div>
                {content ? (
                  <NewsContentRenderer content={content} />
                ) : (
                  <span className="text-zinc-400 italic">Nội dung xem trước sẽ hiển thị ở đây...</span>
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
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Đang lưu bài viết...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check" />
                <span>{isPublished ? 'Tạo & Xuất bản' : 'Lưu bản nháp'}</span>
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
                    ? 'bg-violet-600 text-white'
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
                    ? 'bg-violet-600 text-white'
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
                placeholder="Ví dụ: Hình minh họa sự kiện..."
                className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-violet-500"
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
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.1] bg-zinc-50 dark:bg-white/[0.01] p-5 text-center hover:border-violet-500"
                >
                  {uploadingContentImg ? (
                    <div className="flex items-center gap-2 text-xs text-violet-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
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
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={handleInsertUrlImage}
                  className="w-full rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
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
