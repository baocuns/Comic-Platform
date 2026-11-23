'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Plus, Send, Edit3, Trash2, Lock, Save } from 'lucide-react';
import {
  ComicStatus,
  ComicType,
  ContentRating,
  type ChapterSummary,
  type ComicDetail,
  type GenreItem,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { APPROVAL_STATUS_LABEL, COMIC_STATUS_LABEL, COMIC_TYPE_LABEL, CONTENT_RATING_LABEL } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function StudioComicDetailPage() {
  const params = useParams();
  const comicId = params?.id as string;
  const { accessToken } = useAuthStore();
  const { toast } = useToast();

  const [comic, setComic] = useState<ComicDetail | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [title, setTitle] = useState('');
  const [alternativeTitlesText, setAlternativeTitlesText] = useState('');
  const [description, setDescription] = useState('');
  const [artistName, setArtistName] = useState('');
  const [originalAuthor, setOriginalAuthor] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [bannerPosition, setBannerPosition] = useState(50);
  const [status, setStatus] = useState<ComicStatus>(ComicStatus.ONGOING);
  const [type, setType] = useState<ComicType>(ComicType.VIETNAM);
  const [contentRating, setContentRating] = useState<ContentRating>(ContentRating.EVERYONE);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Chapter modal
  const [newChapOpen, setNewChapOpen] = useState(false);
  const [chapNumber, setChapNumber] = useState('1');
  const [chapTitle, setChapTitle] = useState('');
  const [chapPremium, setChapPremium] = useState(false);
  const [chapCoins, setChapCoins] = useState('15');
  const [creatingChap, setCreatingChap] = useState(false);
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [deletingChapter, setDeletingChapter] = useState(false);

  const coverRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!accessToken || !comicId) return;
    setLoading(true);
    try {
      const [cRes, chRes, gRes] = await Promise.all([
        api.get<{ data: ComicDetail }>(`/comics/id/${comicId}`, { token: accessToken }),
        api.get<{ data: ChapterSummary[] }>(`/comics/${comicId}/chapters/manage`, { token: accessToken }),
        api.get<{ data: GenreItem[] }>('/genres'),
      ]);
      const c = cRes.data;
      setComic(c);
      setTitle(c.title);
      setAlternativeTitlesText((c.alternativeTitles || []).join(', '));
      setDescription(c.description || '');
      setArtistName(c.artistName || '');
      setOriginalAuthor(c.originalAuthor || '');
      setReleaseYear(c.releaseYear ? String(c.releaseYear) : '');
      setTagsText((c.tags || []).join(', '));
      setBannerPosition(typeof c.bannerPosition === 'number' ? c.bannerPosition : 50);
      setStatus(c.status);
      setType(c.type);
      setContentRating(c.contentRating);
      setSelectedGenres(c.genres.map((g) => g.id));
      setChapters(chRes.data || []);
      setGenres(gRes.data || []);
      const maxNum = (chRes.data || []).reduce((m, x) => Math.max(m, x.number), 0);
      setChapNumber(String(Math.floor(maxNum) + 1));
    } finally {
      setLoading(false);
    }
  }, [accessToken, comicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !comic) return;
    setSaving(true);
    try {
      const alternativeTitles = alternativeTitlesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedYear = Number.parseInt(releaseYear.trim(), 10);
      const validReleaseYear =
        Number.isFinite(parsedYear) && parsedYear >= 1950 && parsedYear <= 2100
          ? parsedYear
          : undefined;

      await api.put(
        `/comics/${comic.id}`,
        {
          title,
          alternativeTitles,
          description,
          artistName: artistName.trim() || undefined,
          originalAuthor: originalAuthor.trim() || undefined,
          releaseYear: validReleaseYear,
          tags,
          bannerPosition,
          status,
          type,
          contentRating,
          genreIds: selectedGenres,
        },
        { token: accessToken },
      );
      toast.success('Đã lưu thay đổi thông tin truyện');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (kind: 'cover' | 'banner', file?: File) => {
    if (!file || !accessToken || !comic) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(`/uploads/comics/${comic.id}/${kind}`, fd, { token: accessToken });
      toast.success(kind === 'cover' ? 'Đã cập nhật ảnh bìa dọc' : 'Đã cập nhật banner ngang');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Tải ảnh thất bại');
    }
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !comic) return;
    setCreatingChap(true);
    try {
      await api.post(
        `/comics/${comic.id}/chapters`,
        {
          number: Number(chapNumber),
          title: chapTitle.trim() || undefined,
          isPremium: chapPremium,
          priceCoins: chapPremium ? Number(chapCoins) || 10 : 0,
        },
        { token: accessToken },
      );
      toast.success(`Đã tạo Chương ${chapNumber}!`);
      setNewChapOpen(false);
      setChapTitle('');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tạo chương');
    } finally {
      setCreatingChap(false);
    }
  };

  const handleSubmitComic = async () => {
    if (!accessToken || !comic) return;
    try {
      const res = await api.post<{ data: { autoApproved: boolean } }>(
        `/comics/${comic.id}/publish`,
        {},
        { token: accessToken },
      );
      toast.success(
        res.data.autoApproved ? 'Truyện đã được xuất bản!' : 'Đã gửi truyện chờ kiểm duyệt!',
      );
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gửi duyệt thất bại');
    }
  };

  const handlePublishChapter = async (chapterId: string) => {
    if (!accessToken) return;
    try {
      const res = await api.post<{ data: { autoApproved: boolean } }>(
        `/chapters/${chapterId}/publish`,
        {},
        { token: accessToken },
      );
      toast.success(res.data.autoApproved ? 'Chương đã được xuất bản!' : 'Đã gửi chương chờ duyệt!');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  const handleDeleteChapter = async () => {
    if (!accessToken || !deleteChapterId) return;
    setDeletingChapter(true);
    try {
      await api.delete(`/chapters/${deleteChapterId}`, { token: accessToken });
      toast.info('Đã xóa chương');
      setDeleteChapterId(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xóa chương');
    } finally {
      setDeletingChapter(false);
    }
  };

  if (loading || !comic) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/studio/comics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">{comic.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={comic.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                {APPROVAL_STATUS_LABEL[comic.approvalStatus]}
              </Badge>
              {comic.approvalStatus === 'APPROVED' && (
                <Link href={`/comics/${comic.slug}`} className="text-xs font-semibold text-[var(--accent-primary)] hover:underline">
                  Xem trang công khai →
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {comic.approvalStatus !== 'APPROVED' && (
            <Button variant="primary" size="sm" onClick={handleSubmitComic}>
              <Send className="h-4 w-4" />
              Gửi duyệt truyện
            </Button>
          )}
          <Button variant="warm" size="sm" onClick={() => setNewChapOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm chương mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Cover + Banner */}
        <Card className="lg:col-span-4 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Ảnh bìa (3:4)
            </label>
            <div className="aspect-[3/4] w-44 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              {comic.coverUrl && <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Đổi ảnh bìa
            </Button>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUploadImage('cover', e.target.files?.[0])}
            />
          </div>

          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Banner ngang
            </label>
            <div className="aspect-[16/6] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              {comic.bannerUrl && (
                <img
                  src={comic.bannerUrl}
                  alt="Banner"
                  style={{ objectPosition: `50% ${bannerPosition}%` }}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => bannerRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Đổi banner
            </Button>
            {comic.bannerUrl && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="font-medium">Vị trí hiển thị banner (dọc)</span>
                  <span className="font-mono">{bannerPosition}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={bannerPosition}
                  onChange={(e) => setBannerPosition(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] cursor-pointer"
                />
              </div>
            )}
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUploadImage('banner', e.target.files?.[0])}
            />
          </div>
        </Card>

        {/* Right: Metadata Form */}
        <Card className="lg:col-span-8">
          <form onSubmit={handleSaveComic} className="space-y-4">
            <Input label="Tên truyện" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input
              label="Tên khác (phân tách bằng dấu phẩy)"
              value={alternativeTitlesText}
              onChange={(e) => setAlternativeTitlesText(e.target.value)}
              placeholder="Ví dụ: Van Son Kiem Lo, Cloud Sword Path"
            />
            <Textarea label="Mô tả" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Họa sĩ"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Tên họa sĩ minh họa"
              />
              <Input
                label="Tác giả gốc"
                value={originalAuthor}
                onChange={(e) => setOriginalAuthor(e.target.value)}
                placeholder="Tác giả nguyên tác (nếu chuyển thể)"
              />
              <Input
                label="Năm phát hành"
                type="number"
                min={1950}
                max={2100}
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                placeholder="2026"
              />
              <Input
                label="Thẻ từ khóa (phân tách bằng dấu phẩy)"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="tiên hiệp, kiếm đạo, cổ trang"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Định dạng</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ComicType)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  {Object.values(ComicType).map((t) => (
                    <option key={t} value={t}>{COMIC_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Trạng thái</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ComicStatus)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  {Object.values(ComicStatus).map((s) => (
                    <option key={s} value={s}>{COMIC_STATUS_LABEL[s]}</option>
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
                    <option key={r} value={r}>{CONTENT_RATING_LABEL[r]}</option>
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
                      className={`rounded-full border px-3 py-1 text-xs font-medium cursor-pointer ${active
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

            <div className="flex justify-end">
              <Button type="submit" isLoading={saving}>
                <Save className="h-4 w-4" />
                Lưu thông tin truyện
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Chapters Management */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Danh sách chương ({chapters.length})</h2>
          <Button size="xs" variant="warm" onClick={() => setNewChapOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Chương mới
          </Button>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {chapters.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              Chưa có chương nào. Hãy tạo chương đầu tiên và tải lên trang ảnh!
            </div>
          ) : (
            chapters.map((ch) => (
              <div key={ch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Chương {ch.number}{ch.title ? ` — ${ch.title}` : ''}
                    </span>
                    <Badge variant={ch.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                      {APPROVAL_STATUS_LABEL[ch.approvalStatus]}
                    </Badge>
                    {ch.isPremium && (
                      <Badge variant="warm">
                        <Lock className="h-3 w-3" /> {ch.priceCoins} Xu
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {ch.totalPages} trang · {ch.views} lượt xem
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/studio/comics/${comic.id}/chapters/${ch.id}`}>
                    <Button size="xs" variant="secondary">
                      <Edit3 className="h-3.5 w-3.5" />
                      Biên tập trang
                    </Button>
                  </Link>
                  {ch.approvalStatus !== 'APPROVED' && (
                    <Button size="xs" variant="primary" onClick={() => handlePublishChapter(ch.id)}>
                      <Send className="h-3.5 w-3.5" />
                      Xuất bản
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => setDeleteChapterId(ch.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-[var(--danger)]" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={newChapOpen} onClose={() => setNewChapOpen(false)} title="Thêm chương mới">
        <form onSubmit={handleCreateChapter} className="space-y-4">
          <Input
            label="Số chương *"
            type="number"
            step="0.1"
            value={chapNumber}
            onChange={(e) => setChapNumber(e.target.value)}
            required
          />
          <Input
            label="Tên chương (tùy chọn)"
            value={chapTitle}
            onChange={(e) => setChapTitle(e.target.value)}
            placeholder="Ví dụ: Đêm Đèn Lồng"
          />
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={chapPremium}
              onChange={(e) => setChapPremium(e.target.checked)}
              className="accent-[var(--accent-warm)]"
            />
            <span>Đặt làm Chương VIP (độc giả mở khóa bằng Xu)</span>
          </label>
          {chapPremium && (
            <Input
              label="Giá mở khóa (Xu)"
              type="number"
              min={1}
              value={chapCoins}
              onChange={(e) => setChapCoins(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setNewChapOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="warm" isLoading={creatingChap}>
              Tạo chương
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteChapterId}
        onClose={() => setDeleteChapterId(null)}
        onConfirm={handleDeleteChapter}
        title="Xóa chương truyện?"
        description="Chương và các trang ảnh bên trong sẽ bị ẩn vĩnh viễn khỏi độc giả."
        confirmLabel="Xóa chương"
        isLoading={deletingChapter}
      />
    </div>
  );
}
