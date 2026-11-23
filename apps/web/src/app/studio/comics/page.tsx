'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, Eye, Trash2, Edit3, Send } from 'lucide-react';
import { ComicType, ContentRating, type ComicSummary, type GenreItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { APPROVAL_STATUS_LABEL, COMIC_TYPE_LABEL, CONTENT_RATING_LABEL, formatCompactNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function StudioComicsPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { toast } = useToast();

  const [comics, setComics] = useState<ComicSummary[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ComicType>(ComicType.VIETNAM);
  const [contentRating, setContentRating] = useState<ContentRating>(ContentRating.EVERYONE);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadComics = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [cRes, gRes] = await Promise.all([
        api.get<{ data: ComicSummary[] }>('/comics/mine', { token: accessToken }),
        api.get<{ data: GenreItem[] }>('/genres'),
      ]);
      setComics(cRes.data || []);
      setGenres(gRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadComics();
  }, [loadComics]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setCreating(true);
    try {
      const res = await api.post<{ data: ComicSummary }>(
        '/comics',
        {
          title,
          description,
          type,
          contentRating,
          genreIds: selectedGenres,
        },
        { token: accessToken },
      );
      toast.success('Đã tạo bộ truyện mới!');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setSelectedGenres([]);
      router.push(`/studio/comics/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tạo truyện');
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (comicId: string) => {
    if (!accessToken) return;
    try {
      const res = await api.post<{ data: { autoApproved: boolean } }>(
        `/comics/${comicId}/publish`,
        {},
        { token: accessToken },
      );
      toast.success(
        res.data.autoApproved ? 'Truyện đã được tự động xuất bản!' : 'Đã gửi truyện lên hàng đợi duyệt!',
      );
      loadComics();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi duyệt');
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !deleteId) return;
    try {
      await api.delete(`/comics/${deleteId}`, { token: accessToken });
      toast.info('Đã xóa bộ truyện');
      setDeleteId(null);
      loadComics();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Quản lý Truyện tranh</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Tạo mới, cập nhật ảnh bìa, thêm chương và gửi kiểm duyệt xuất bản.
          </p>
        </div>
        <Button variant="warm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo truyện mới
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : comics.length === 0 ? (
        <Card className="py-12 text-center space-y-3">
          <BookOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">Bạn chưa sáng tác bộ truyện nào.</p>
          <Button onClick={() => setCreateOpen(true)}>Tạo bộ truyện đầu tiên</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {comics.map((comic) => (
            <Card key={comic.id} className="flex gap-4 p-4">
              <div className="h-32 w-23 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-bold text-[var(--text-muted)]">
                    {comic.title[0]}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={
                        comic.approvalStatus === 'APPROVED'
                          ? 'success'
                          : comic.approvalStatus === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {APPROVAL_STATUS_LABEL[comic.approvalStatus]}
                    </Badge>
                    <Badge variant="outline">{COMIC_TYPE_LABEL[comic.type]}</Badge>
                  </div>
                  <h3 className="mt-1.5 truncate text-base font-bold text-[var(--text-primary)]">
                    {comic.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {comic.stats.totalChapters} chương ·{' '}
                    <Eye className="inline h-3 w-3" /> {formatCompactNumber(comic.stats.totalViews)}
                  </p>
                  {comic.rejectionReason && (
                    <p className="mt-1 text-xs text-[var(--danger)]">Lý do từ chối: {comic.rejectionReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-3">
                  <Link href={`/studio/comics/${comic.id}`}>
                    <Button size="xs" variant="secondary">
                      <Edit3 className="h-3.5 w-3.5" />
                      Chi tiết & Chương
                    </Button>
                  </Link>
                  {comic.approvalStatus !== 'APPROVED' && (
                    <Button size="xs" variant="primary" onClick={() => handlePublish(comic.id)}>
                      <Send className="h-3.5 w-3.5" />
                      Gửi duyệt
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => setDeleteId(comic.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-[var(--danger)]" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo bộ truyện mới" maxWidthClass="max-w-xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Tên truyện *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Vân Sơn Kiếm Lộ"
            required
          />
          <Textarea
            label="Tóm tắt nội dung"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Giới thiệu bối cảnh và nhân vật chính..."
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Định dạng</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ComicType)}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
              >
                {Object.values(ComicType).map((t) => (
                  <option key={t} value={t}>
                    {COMIC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Độ tuổi</label>
              <select
                value={contentRating}
                onChange={(e) => setContentRating(e.target.value as ContentRating)}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
              >
                {Object.values(ContentRating).map((r) => (
                  <option key={r} value={r}>
                    {CONTENT_RATING_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">Thể loại</label>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => {
                const active = selectedGenres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGenres((prev) =>
                        active ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium cursor-pointer ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="warm" isLoading={creating}>
              Tạo truyện
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa bộ truyện này?"
        description="Truyện sẽ bị ẩn khỏi hệ thống."
        confirmLabel="Xóa truyện"
      />
    </div>
  );
}
