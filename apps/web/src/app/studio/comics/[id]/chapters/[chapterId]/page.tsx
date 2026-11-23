'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Upload, Send, Trash2, Eye, GripVertical, Save } from 'lucide-react';
import type { ChapterDetail, PageItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { PagePreviewModal } from '@/components/studio/page-preview-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function SortablePageCard({
  page,
  index,
  onPreview,
  onDelete,
}: {
  page: PageItem;
  index: number;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs"
    >
      <div className="aspect-[3/4] overflow-hidden bg-[var(--bg-subtle)]">
        <img src={page.thumbnailUrl || page.imageUrl} alt={`Trang ${page.pageNumber}`} className="h-full w-full object-cover" />
      </div>

      <div className="flex items-center justify-between px-2.5 py-2 text-xs">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="inline-flex items-center gap-1 font-bold text-[var(--text-secondary)] cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
          Trang {index + 1}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPreview}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChapterEditorPage() {
  const params = useParams();
  const comicId = params?.id as string;
  const chapterId = params?.chapterId as string;

  const { accessToken } = useAuthStore();
  const { toast } = useToast();

  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [title, setTitle] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [priceCoins, setPriceCoins] = useState('15');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [deletingPage, setDeletingPage] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadChapter = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !chapterId) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: ChapterDetail }>(`/chapters/${chapterId}/manage`, {
        token: accessToken,
        signal,
      });
      if (signal?.aborted) return;
      setChapter(res.data);
      setPages(res.data.pages || []);
      setTitle(res.data.title || '');
      setIsPremium(res.data.isPremium);
      setPriceCoins(String(res.data.priceCoins || 15));
    } catch (err) {
      if (!signal?.aborted) {
        toast.error(err instanceof ApiError ? err.message : 'Không thể tải thông tin chương');
        setChapter(null);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accessToken, chapterId, toast]);

  useEffect(() => {
    const controller = new AbortController();
    loadChapter(controller.signal);
    return () => controller.abort();
  }, [loadChapter]);

  const handleUploadFiles = async (fileList: FileList | null, append: boolean) => {
    if (!fileList || fileList.length === 0 || !accessToken) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append('files', f));
      const endpoint = append
        ? `/uploads/chapters/${chapterId}/pages/append`
        : `/uploads/chapters/${chapterId}/pages`;
      await api.upload(endpoint, fd, { token: accessToken });
      toast.success(`Đã tải lên ${fileList.length} trang ảnh!`);
      await loadChapter();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Tải trang thất bại');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !accessToken) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(pages, oldIndex, newIndex).map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    setPages(reordered);

    try {
      await api.put(
        `/chapters/${chapterId}/pages/reorder`,
        {
          orders: reordered.map((p, idx) => ({ pageId: p.id, newOrder: idx + 1 })),
        },
        { token: accessToken },
      );
      toast.success('Đã lưu thứ tự trang mới');
    } catch {
      toast.error('Không thể lưu thứ tự trang');
      loadChapter();
    }
  };

  const handleDeletePage = async () => {
    if (!accessToken || !deletePageId) return;
    setDeletingPage(true);
    try {
      await api.delete(`/chapters/${chapterId}/pages/${deletePageId}`, { token: accessToken });
      toast.info('Đã xóa trang');
      setDeletePageId(null);
      await loadChapter();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xóa thất bại');
    } finally {
      setDeletingPage(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!accessToken || savingMeta) return;
    setSavingMeta(true);
    try {
      const parsedPrice = Math.max(1, Math.min(100000, Math.floor(Number(priceCoins) || 15)));
      await api.put(
        `/chapters/${chapterId}`,
        { title: title.trim() || undefined, isPremium, priceCoins: isPremium ? parsedPrice : 0 },
        { token: accessToken },
      );
      toast.success('Đã lưu thông tin chương');
      await loadChapter();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thông tin thất bại');
    } finally {
      setSavingMeta(false);
    }
  };

  const handlePublish = async () => {
    if (!accessToken || publishing) return;
    setPublishing(true);
    try {
      const res = await api.post<{ data: { autoApproved: boolean } }>(
        `/chapters/${chapterId}/publish`,
        {},
        { token: accessToken },
      );
      toast.success(res.data.autoApproved ? 'Chương đã được xuất bản!' : 'Đã gửi chương chờ duyệt!');
      await loadChapter();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xuất bản chương');
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !chapter) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/studio/comics/${comicId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
              Biên tập Chương {chapter.number}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              {chapter.comic.title} · {pages.length} trang ảnh
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/read/${chapterId}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" /> Xem trước
            </Button>
          </Link>
          {chapter.approvalStatus !== 'APPROVED' && (
            <Button variant="warm" size="sm" isLoading={publishing} onClick={handlePublish}>
              <Send className="h-4 w-4" /> Xuất bản chương
            </Button>
          )}
        </div>
      </div>

      {/* Chapter Meta & Pricing */}
      <Card className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
        <div className="md:col-span-5">
          <Input label="Tiêu đề chương" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên chương..." />
        </div>
        <div className="md:col-span-3 flex items-center gap-2 pb-2.5">
          <input
            id="vip-toggle"
            type="checkbox"
            checked={isPremium}
            onChange={(e) => setIsPremium(e.target.checked)}
            className="accent-[var(--accent-warm)]"
          />
          <label htmlFor="vip-toggle" className="text-sm font-medium text-[var(--text-primary)] cursor-pointer">
            Chương VIP trả Xu
          </label>
        </div>
        <div className="md:col-span-2">
          {isPremium && (
            <Input
              label="Giá Xu"
              type="number"
              min={1}
              max={100000}
              value={priceCoins}
              onChange={(e) => setPriceCoins(e.target.value)}
            />
          )}
        </div>
        <div className="md:col-span-2">
          <Button className="w-full" size="md" isLoading={savingMeta} onClick={handleSaveMeta}>
            <Save className="h-4 w-4" /> Lưu
          </Button>
        </div>
      </Card>

      {/* Bulk Upload Box */}
      <Card className="border-dashed text-center py-8 space-y-3">
        <Upload className="mx-auto h-7 w-7 text-[var(--accent-primary)]" />
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Tải lên hàng loạt trang truyện (JPG, PNG, WebP)
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Hệ thống tự động nén WebP và tối ưu kích thước 1280px. Kéo thả thẻ bên dưới để đổi thứ tự.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="primary"
            isLoading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {pages.length > 0 ? 'Thêm trang vào cuối' : 'Chọn ảnh tải lên'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files, pages.length > 0)}
          />
        </div>
      </Card>

      {/* Sortable Pages Grid */}
      {pages.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {pages.map((p, idx) => (
                <SortablePageCard
                  key={p.id}
                  page={p}
                  index={idx}
                  onPreview={() => setPreviewIdx(idx)}
                  onDelete={() => setDeletePageId(p.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {previewIdx !== null && (
        <PagePreviewModal
          pages={pages}
          currentIndex={previewIdx}
          onChangeIndex={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      )}

      <ConfirmDialog
        open={!!deletePageId}
        onClose={() => setDeletePageId(null)}
        onConfirm={handleDeletePage}
        title="Xóa trang ảnh?"
        description="Trang ảnh này sẽ bị xóa vĩnh viễn và các trang còn lại sẽ được đánh số lại."
        confirmLabel="Xóa trang"
        isLoading={deletingPage}
      />
    </div>
  );
}
