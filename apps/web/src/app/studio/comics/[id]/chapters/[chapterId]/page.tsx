'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PagePreviewModal } from '@/components/studio/page-preview-modal';

interface PageData {
  id: string;
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

interface ChapterInfo {
  id: string;
  number: string;
  title: string | null;
  totalPages: number;
  comic: { id: string; title: string; slug: string };
}

interface ChapterItem {
  id: string;
  number: string;
  title: string | null;
}

type ViewMode = 'grid' | 'column';

// ── Sortable Page Thumbnail ──
function SortablePageThumb({
  page,
  isSelected,
  onSelect,
  onPreview,
  onDelete,
  zoom,
  viewMode,
}: {
  page: PageData;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  zoom: number;
  viewMode: ViewMode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(viewMode === 'grid'
      ? { width: `${Math.round(120 * zoom)}px` }
      : { width: `${Math.round(280 * zoom)}px`, margin: '0 auto' }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex-shrink-0 cursor-grab select-none overflow-hidden rounded-xl border-2 transition-all duration-200 active:cursor-grabbing ${
        isSelected
          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
          : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-white/[0.15]'
      }`}
      onClick={(e) => onSelect(page.id, e.ctrlKey || e.metaKey)}
      {...attributes}
      {...listeners}
    >
      {/* Image */}
      <div className={`relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${viewMode === 'grid' ? 'aspect-[3/4]' : ''}`}>
        <img
          src={page.imageUrl}
          alt={`Trang ${page.pageNumber}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          draggable={false}
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(page.id); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            title="Xem chi tiết"
          >
            🔍
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-sm text-red-300 backdrop-blur-sm transition-colors hover:bg-red-500/40"
            title="Xóa trang"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Page number badge */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        <span className="text-[11px] font-semibold text-white drop-shadow-lg">{page.pageNumber}</span>
      </div>

      {/* Selection check */}
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white shadow-lg">
          ✓
        </div>
      )}

      {/* Drag handle indicator */}
      <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[8px] text-white/50 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        ⠿
      </div>
    </div>
  );
}

// ── Drag Overlay Thumbnail ──
function DragOverlayThumb({ page, zoom, viewMode }: { page: PageData; zoom: number; viewMode: ViewMode }) {
  const w = viewMode === 'grid' ? Math.round(120 * zoom) : Math.round(280 * zoom);
  return (
    <div
      className="overflow-hidden rounded-xl border-2 border-amber-500 bg-amber-500/10 shadow-2xl shadow-amber-500/30"
      style={{ width: `${w}px` }}
    >
      <div className={`w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${viewMode === 'grid' ? 'aspect-[3/4]' : ''}`}>
        <img src={page.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      </div>
      <div className="bg-black/60 px-2 py-1 text-center text-[11px] font-semibold text-white">{page.pageNumber}</div>
    </div>
  );
}

// ── Main Canvas Editor Page ──
export default function CanvasEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, refreshToken } = useAuthStore();

  const comicId = params.id as string;
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<ChapterInfo | null>(null);
  const [allChapters, setAllChapters] = useState<ChapterItem[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Helper: API call with token refresh retry ──
  const apiWithRetry = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new Error('Not authenticated');
    try {
      return await fn(token);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken;
          if (newToken) return await fn(newToken);
        }
      }
      throw err;
    }
  }, [refreshToken]);

  // ── Load Data ──
  useEffect(() => {
    if (!accessToken || !chapterId) return;
    setLoading(true);

    api
      .get<{ data: ChapterInfo & { pages: PageData[] } }>(`/chapters/${chapterId}`)
      .then((res) => {
        setChapter({
          id: res.data.id,
          number: res.data.number,
          title: res.data.title,
          totalPages: res.data.totalPages,
          comic: res.data.comic,
        });
        setPages((res.data.pages || []).sort((a, b) => a.pageNumber - b.pageNumber));

        const targetComicId = res.data.comic?.id || comicId;
        if (targetComicId) {
          api
            .get<{ data: ChapterItem[] }>(`/comics/${targetComicId}/chapters`)
            .then((chRes) => {
              const sorted = (chRes.data || []).sort(
                (a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0)
              );
              setAllChapters(sorted);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, chapterId, comicId]);

  // ── Chapter Navigation ──
  const navigateToChapter = (targetChapterId: string) => {
    if (targetChapterId === chapterId) return;
    if (hasChanges && !confirm('Bạn có thay đổi chưa lưu thứ tự trang. Bạn có muốn tiếp tục chuyển chương?')) {
      return;
    }
    const targetComicId = chapter?.comic?.id || comicId;
    router.push(`/studio/comics/${targetComicId}/chapters/${targetChapterId}`);
  };

  const chaptersList = allChapters.length > 0
    ? allChapters
    : (chapter ? [{ id: chapter.id, number: chapter.number, title: chapter.title }] : []);

  const currentIndex = chaptersList.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chaptersList[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

  // ── Selection ──
  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (multi) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (next.has(id) && next.size === 1) next.clear();
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(pages.map((p) => p.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // ── Drag & Drop (reorder) ──
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
      });
      setHasChanges(true);
    }
  };

  // ── Save Order ──
  const handleSaveOrder = async () => {
    if (pages.length === 0) return;
    setSavingOrder(true);
    setErrorMsg(null);
    try {
      const orders = pages.map((p, idx) => ({ pageId: p.id, newOrder: idx + 1 }));
      await apiWithRetry((token) =>
        api.put(`/chapters/${chapterId}/pages/reorder`, { orders }, { token })
      );
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save order:', err);
      setErrorMsg('Không thể lưu thứ tự trang. Vui lòng thử lại.');
    }
    setSavingOrder(false);
  };

  // ── Upload Pages ──
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...fileArray]);

    const newPreviews = fileArray.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeUploadFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearUploadFiles = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviews([]);
  };

  const handleUploadPages = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(10);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('files', file));

      setUploadProgress(30);

      await apiWithRetry((token) =>
        api.upload(`/upload/chapters/${chapterId}/pages/append`, formData, { token })
      );

      setUploadProgress(80);

      const res = await api.get<{ data: ChapterInfo & { pages: PageData[] } }>(`/chapters/${chapterId}`);
      if (res.data?.pages) {
        setPages(res.data.pages.sort((a, b) => a.pageNumber - b.pageNumber));
        if (chapter) {
          setChapter((prev) => (prev ? { ...prev, totalPages: res.data.pages.length } : null));
        }
      }

      setUploadProgress(100);
      clearUploadFiles();
    } catch (err) {
      console.error('Failed to upload pages:', err);
      setErrorMsg('Tải ảnh lên thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // ── Delete Pages ──
  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Bạn có chắc muốn xóa trang này?')) return;
    setErrorMsg(null);
    try {
      await apiWithRetry((token) =>
        api.delete(`/chapters/${chapterId}/pages/${pageId}`, { token })
      );
      setPages((prev) =>
        prev
          .filter((p) => p.id !== pageId)
          .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
      if (chapter) {
        setChapter((prev) => (prev ? { ...prev, totalPages: Math.max(0, prev.totalPages - 1) } : null));
      }
    } catch (err) {
      console.error('Failed to delete page:', err);
      setErrorMsg('Không thể xóa trang. Vui lòng thử lại.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} trang đã chọn?`)) return;
    setErrorMsg(null);
    try {
      const idsArray = Array.from(selectedIds);
      await Promise.all(
        idsArray.map((pageId) =>
          apiWithRetry((token) => api.delete(`/chapters/${chapterId}/pages/${pageId}`, { token }))
        )
      );
      setPages((prev) =>
        prev
          .filter((p) => !selectedIds.has(p.id))
          .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
      );
      if (chapter) {
        setChapter((prev) =>
          prev ? { ...prev, totalPages: Math.max(0, prev.totalPages - selectedIds.size) } : null
        );
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete selected pages:', err);
      setErrorMsg('Không thể xóa một số trang. Vui lòng thử lại.');
    }
  };

  // ── Drag file into page handler ──
  const handlePageDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // ── Preview modal helper ──
  const handlePreview = (pageId: string) => {
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx !== -1) setPreviewIndex(idx);
  };

  const activePage = activeId ? pages.find((p) => p.id === activeId) : null;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" /></div>;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col" onDragOver={handlePageDragOver} onDragLeave={handlePageDragLeave} onDrop={handlePageDrop}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {/* ── Toolbar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0c0c0f]/60 px-4 py-2 backdrop-blur-xl transition-colors duration-200">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/studio/comics/${comicId}`}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-white"
            title="Quay lại chi tiết truyện"
          >
            ← Quay lại
          </Link>

          <div className="h-4 w-px bg-zinc-200 dark:bg-white/10" />

          {/* Chapter Navigation: Trước, Select Dropdown, Sau */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => prevChapter && navigateToChapter(prevChapter.id)}
              disabled={!prevChapter}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
              title={prevChapter ? `Chương ${prevChapter.number}` : 'Không có chương trước'}
            >
              <i className="fa-solid fa-chevron-left text-[10px]" />
              <span className="hidden sm:inline">Trước</span>
            </button>

            {/* Chapter Select Dropdown */}
            <select
              value={chapterId}
              onChange={(e) => navigateToChapter(e.target.value)}
              className="max-w-[150px] sm:max-w-[220px] truncate rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] py-1.5 px-2.5 text-xs font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer transition-colors hover:bg-zinc-200 dark:hover:bg-white/[0.08] [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white"
              title="Danh sách chương"
            >
              {chaptersList.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Chương {ch.number}{ch.title ? `: ${ch.title}` : ''}
                </option>
              ))}
            </select>

            <button
              onClick={() => nextChapter && navigateToChapter(nextChapter.id)}
              disabled={!nextChapter}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
              title={nextChapter ? `Chương ${nextChapter.number}` : 'Không có chương sau'}
            >
              <span className="hidden sm:inline">Sau</span>
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
          </div>

          <span className="hidden md:inline-block rounded-full bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-500">
            {pages.length} trang
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-l-lg px-2.5 py-1 text-xs transition-colors ${viewMode === 'grid' ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-bold' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
              title="Lưới ngang"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('column')}
              className={`rounded-r-lg px-2.5 py-1 text-xs transition-colors ${viewMode === 'column' ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-bold' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
              title="Dọc liền mạch"
            >
              ☰
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-1">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" disabled={zoom <= 0.5}>−</button>
            <span className="min-w-[3rem] text-center text-xs text-zinc-600 dark:text-zinc-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.25))} className="rounded px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" disabled={zoom >= 2}>+</button>
          </div>

          {/* Select all */}
          {pages.length > 0 && (
            <button onClick={selectedIds.size === pages.length ? clearSelection : selectAll} className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
              {selectedIds.size === pages.length ? 'Bỏ chọn' : 'Chọn tất cả'}
            </button>
          )}

          {/* Delete selected */}
          {selectedIds.size > 0 && (
            <button onClick={handleDeleteSelected} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/25">
              🗑️ Xóa {selectedIds.size} trang
            </button>
          )}

          {/* Save order */}
          {hasChanges && (
            <button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              {savingOrder ? 'Đang lưu...' : '💾 Lưu thứ tự'}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-4 py-2">
          <span className="text-xs text-red-600 dark:text-red-300">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200">✕</button>
        </div>
      )}

      {/* ── Canvas Area ── */}
      <div className="flex-1 overflow-auto p-6">
        {pages.length === 0 && selectedFiles.length === 0 ? (
          /* Empty state */
          <div className="flex h-full items-center justify-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-transparent p-16 text-center shadow-sm dark:shadow-none transition-all hover:border-amber-500/50 hover:bg-amber-500/[0.03]"
            >
              <div className="mb-4 text-5xl">🎨</div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bắt đầu với Canvas Editor</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Kéo thả ảnh vào đây hoặc <span className="text-amber-600 dark:text-amber-400 underline font-medium">click để chọn</span></p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">JPEG, PNG, WebP, GIF — tối đa 10MB/ảnh</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sortable pages */}
            {pages.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pages.map((p) => p.id)}
                  strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                >
                  <div className={
                    viewMode === 'grid'
                      ? 'flex flex-wrap gap-3'
                      : 'flex flex-col gap-3'
                  }>
                    {pages.map((page) => (
                      <SortablePageThumb
                        key={page.id}
                        page={page}
                        isSelected={selectedIds.has(page.id)}
                        onSelect={handleSelect}
                        onPreview={handlePreview}
                        onDelete={handleDeletePage}
                        zoom={zoom}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activePage ? <DragOverlayThumb page={activePage} zoom={zoom} viewMode={viewMode} /> : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Upload zone */}
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none">
              <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                📤 Thêm trang mới
              </h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-zinc-300 dark:border-white/[0.08] bg-zinc-50 dark:bg-transparent p-8 text-center transition-all hover:border-amber-500/50 hover:bg-amber-500/[0.03]"
              >
                <div className="text-3xl">🖼️</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Kéo thả ảnh hoặc <span className="text-amber-600 dark:text-amber-400 underline font-medium">click để chọn</span></p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">Ảnh mới sẽ được thêm vào sau các trang hiện có</p>
              </div>

              {/* Upload previews */}
              {selectedFiles.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Đã chọn {selectedFiles.length} ảnh mới</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
                      >
                        + Thêm ảnh
                      </button>
                      <button
                        onClick={clearUploadFiles}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previews.map((url, i) => (
                      <div key={`${url}-${i}`} className="group relative overflow-hidden rounded-lg border border-zinc-200 dark:border-white/[0.06]" style={{ width: `${Math.round(90 * zoom)}px` }}>
                        <div className="aspect-[3/4]">
                          <img src={url} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="bg-black/60 py-0.5 text-center text-[10px] text-zinc-300">{pages.length + i + 1}</div>
                        <button
                          onClick={() => removeUploadFile(i)}
                          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600/80 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleUploadPages}
                      disabled={uploading}
                      className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50"
                    >
                      {uploading ? 'Đang upload...' : `Upload ${selectedFiles.length} trang`}
                    </button>
                    {uploadProgress > 0 && (
                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}
                    {uploadProgress === 100 && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✅ Hoàn tất!</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Full-page drag overlay ── */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-amber-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-amber-400/50 bg-amber-500/10 p-16 text-center">
            <div className="text-5xl">📂</div>
            <p className="mt-3 text-lg font-semibold text-amber-700 dark:text-amber-300">Thả ảnh vào đây để thêm trang</p>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewIndex !== null && (
        <PagePreviewModal
          pages={pages}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
