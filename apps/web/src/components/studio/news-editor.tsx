'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Save, Send } from 'lucide-react';
import { NewsCategory, type NewsItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { NEWS_CATEGORY_LABEL } from '@/lib/format';
import { NewsContentRenderer } from '@/components/news/news-content-renderer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';

export function NewsEditor({ initialArticle }: { initialArticle?: NewsItem }) {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  const [title, setTitle] = useState(initialArticle?.title || '');
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || '');
  const [content, setContent] = useState(initialArticle?.content || '');
  const [coverUrl, setCoverUrl] = useState(initialArticle?.coverUrl || '');
  const [category, setCategory] = useState<NewsCategory>(initialArticle?.category || NewsCategory.ANNOUNCEMENT);
  const [tagsRaw, setTagsRaw] = useState((initialArticle?.tags || []).join(', '));
  const [isPinned, setIsPinned] = useState(initialArticle?.isPinned || false);
  const [saving, setSaving] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCover = async (file?: File) => {
    if (!file || !accessToken) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload<{ data: { url: string } }>('/uploads/news/cover', fd, {
        token: accessToken,
      });
      setCoverUrl(res.data.url);
      toast.success('Đã tải ảnh bìa bài viết');
    } catch {
      toast.error('Tải ảnh bìa thất bại');
    }
  };

  const handleSave = async (publishNow: boolean) => {
    if (!accessToken || saving || !title.trim() || !content.trim()) {
      if (!saving) toast.error('Vui lòng nhập tiêu đề và nội dung bài viết');
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      excerpt: excerpt.trim() || undefined,
      content,
      coverUrl: coverUrl || undefined,
      category: !isStaff && category === NewsCategory.FEATURED ? NewsCategory.ANNOUNCEMENT : category,
      tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
      ...(isStaff ? { isPinned } : {}),
      isPublished: publishNow,
    };

    try {
      if (initialArticle) {
        await api.put(`/news/${initialArticle.id}`, payload, { token: accessToken });
        toast.success('Đã cập nhật bài viết!');
      } else {
        await api.post('/news', payload, { token: accessToken });
        toast.success(publishNow ? 'Đã xuất bản / gửi duyệt bài viết!' : 'Đã lưu bản nháp!');
      }
      router.push('/studio/news');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu bài viết thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/studio/news">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
            {initialArticle ? 'Chỉnh sửa bài viết' : 'Soạn bài viết mới'}
          </h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" isLoading={saving} onClick={() => handleSave(false)}>
            <Save className="h-4 w-4" /> Lưu nháp
          </Button>
          <Button variant="warm" size="sm" isLoading={saving} onClick={() => handleSave(true)}>
            <Send className="h-4 w-4" /> Xuất bản
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Input label="Tiêu đề bài viết *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Tóm tắt ngắn" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Chuyên mục</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory)}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
              >
                {Object.values(NewsCategory)
                  .filter((c) => isStaff || c !== NewsCategory.FEATURED)
                  .map((c) => (
                    <option key={c} value={c}>{NEWS_CATEGORY_LABEL[c]}</option>
                  ))}
              </select>
            </div>
            <Input label="Thẻ (phân tách dấu phẩy)" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="OWOC, Cập nhật" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {coverUrl ? 'Đổi ảnh bìa' : 'Tải ảnh bìa 16:9'}
            </Button>
            {isStaff && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
                <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                Ghim lên Tiêu điểm
              </label>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUploadCover(e.target.files?.[0])}
            />
          </div>

          <Textarea
            label="Nội dung (Hỗ trợ Markdown ##, **đậm**, *nghiêng*, > trích dẫn, danh sách -)"
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Card>

        <Card className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Xem trước bài viết</p>
          {coverUrl && <img src={coverUrl} alt="Preview" className="aspect-video w-full rounded-2xl object-cover" />}
          <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">{title || 'Tiêu đề bài viết'}</h2>
          <NewsContentRenderer content={content || 'Nội dung xem trước sẽ hiển thị tại đây...'} />
        </Card>
      </div>
    </div>
  );
}
