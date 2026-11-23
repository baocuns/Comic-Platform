'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, RotateCcw, Check, Ban } from 'lucide-react';
import { ComicStatus, ComicType, ContentRating, type ComicSummary, type GenreItem, type PaginationMeta } from 'shared';
import { api } from '@/lib/api-client';
import { COMIC_STATUS_LABEL, COMIC_TYPE_LABEL, CONTENT_RATING_LABEL } from '@/lib/format';
import { ComicGrid } from '@/components/comic';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Card } from '@/components/ui/card';

const SORT_OPTIONS = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'weekly', label: 'Hot trong tuần' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'bookmarks', label: 'Nhiều theo dõi' },
  { value: 'newest', label: 'Mới phát hành' },
] as const;

function DiscoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [comics, setComics] = useState<ComicSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [includeGenres, setIncludeGenres] = useState<string[]>(() => {
    const g = searchParams.get('genre');
    const gs = searchParams.get('genres');
    return Array.from(new Set([...(g ? [g] : []), ...(gs ? gs.split(',').filter(Boolean) : [])]));
  });
  const [excludeGenres, setExcludeGenres] = useState<string[]>(() =>
    searchParams.get('excludeGenres')?.split(',').filter(Boolean) || [],
  );
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [selectedRating, setSelectedRating] = useState(searchParams.get('contentRating') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'updated');
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ data: GenreItem[] }>('/genres', { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setGenres(r.data || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const apiParams = new URLSearchParams();
    apiParams.set('page', String(page));
    apiParams.set('limit', '24');
    apiParams.set('sort', sort);
    if (debouncedSearch) apiParams.set('search', debouncedSearch);
    if (includeGenres.length > 0) apiParams.set('genres', includeGenres.join(','));
    if (excludeGenres.length > 0) apiParams.set('excludeGenres', excludeGenres.join(','));
    if (selectedType) apiParams.set('type', selectedType);
    if (selectedStatus) apiParams.set('status', selectedStatus);
    if (selectedRating) apiParams.set('contentRating', selectedRating);

    const urlParams = new URLSearchParams();
    if (page > 1) urlParams.set('page', String(page));
    if (sort !== 'updated') urlParams.set('sort', sort);
    if (debouncedSearch) urlParams.set('search', debouncedSearch);
    if (includeGenres.length > 0) urlParams.set('genres', includeGenres.join(','));
    if (excludeGenres.length > 0) urlParams.set('excludeGenres', excludeGenres.join(','));
    if (selectedType) urlParams.set('type', selectedType);
    if (selectedStatus) urlParams.set('status', selectedStatus);
    if (selectedRating) urlParams.set('contentRating', selectedRating);
    const qs = urlParams.toString();
    router.replace(qs ? `/comics?${qs}` : '/comics', { scroll: false });

    api
      .get<{ data: ComicSummary[]; meta: PaginationMeta }>(`/comics?${apiParams.toString()}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setComics(res.data || []);
          setMeta(res.meta || null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setComics([]);
          setMeta(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, sort, debouncedSearch, includeGenres, excludeGenres, selectedType, selectedStatus, selectedRating, router]);

  // Tri-state genre click: neutral -> include -> exclude -> neutral
  const cycleGenre = (slug: string) => {
    setPage(1);
    if (includeGenres.includes(slug)) {
      setIncludeGenres((prev) => prev.filter((s) => s !== slug));
      setExcludeGenres((prev) => [...prev, slug]);
    } else if (excludeGenres.includes(slug)) {
      setExcludeGenres((prev) => prev.filter((s) => s !== slug));
    } else {
      setIncludeGenres((prev) => [...prev, slug]);
    }
  };

  const resetAll = () => {
    setSearchInput('');
    setIncludeGenres([]);
    setExcludeGenres([]);
    setSelectedType('');
    setSelectedStatus('');
    setSelectedRating('');
    setSort('updated');
    setPage(1);
    router.replace('/comics');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Khám phá Kho Truyện</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Lọc thông minh theo thể loại (nhấn 1 lần để chọn, nhấn lần 2 để loại trừ), định dạng và đánh giá.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            <span>{showFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}</span>
          </Button>
          {(includeGenres.length > 0 || excludeGenres.length > 0 || selectedType || selectedStatus || selectedRating || searchInput) && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Đặt lại</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search + Sort Bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên truyện, tên gốc, thẻ, tác giả..."
            className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sắp xếp: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filters Panel */}
      <Card className={`space-y-4 ${showFilters ? '' : 'hidden sm:block'}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">Thể loại</span>
            <span className="text-[var(--text-muted)]">Nhấn 1 lần: Bao gồm · Lần 2: Loại trừ</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => {
              const isInc = includeGenres.includes(g.slug);
              const isExc = excludeGenres.includes(g.slug);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => cycleGenre(g.slug)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                    isInc
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : isExc
                        ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] line-through'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {isInc && <Check className="h-3 w-3" />}
                  {isExc && <Ban className="h-3 w-3" />}
                  <span>{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Định dạng</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--text-primary)]"
            >
              <option value="">Tất cả định dạng</option>
              {Object.values(ComicType).map((t) => (
                <option key={t} value={t}>
                  {COMIC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Tình trạng</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--text-primary)]"
            >
              <option value="">Tất cả tình trạng</option>
              {[ComicStatus.ONGOING, ComicStatus.COMPLETED, ComicStatus.HIATUS].map((s) => (
                <option key={s} value={s}>
                  {COMIC_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Độ tuổi</label>
            <select
              value={selectedRating}
              onChange={(e) => {
                setSelectedRating(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--text-primary)]"
            >
              <option value="">Tất cả độ tuổi</option>
              {Object.values(ContentRating).map((r) => (
                <option key={r} value={r}>
                  {CONTENT_RATING_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Results summary */}
      {meta && (
        <p className="text-xs font-medium text-[var(--text-muted)]">
          Hiển thị {comics.length} trên tổng số {meta.total} tác phẩm phù hợp
        </p>
      )}

      {/* Grid */}
      <ComicGrid
        comics={comics}
        isLoading={loading}
        skeletonCount={12}
        emptyMessage="Không tìm thấy bộ truyện nào khớp với bộ lọc hiện tại."
      />

      {meta && (
        <div className="pt-4">
          <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => setPage(p)} />
        </div>
      )}
    </div>
  );
}

export default function ComicsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 text-sm text-[var(--text-muted)]">
          Đang tải kho truyện...
        </div>
      }
    >
      <DiscoveryContent />
    </Suspense>
  );
}
