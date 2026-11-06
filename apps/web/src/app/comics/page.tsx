'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { ElDropdown, ElMenu } from '@tailwindplus/elements/react';
import { ComicGrid, ComicCardSkeleton, type Comic } from '@/components/comic';

interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
  comicCount: number;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

const SORT_OPTIONS = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'latest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến' },
  { value: 'rating', label: 'Đánh giá cao' },
];

function ComicsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedGenre = searchParams.get('genre');
  const sort = searchParams.get('sort') || 'updated';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [comics, setComics] = useState<Comic[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load genres
  useEffect(() => {
    api
      .get<{ data: Genre[] }>('/comics/genres')
      .then((res) => setGenres(res.data))
      .catch(() => { })
      .finally(() => setGenresLoading(false));
  }, []);

  // Load comics whenever filter / sort / page changes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedGenre) params.set('genre', selectedGenre);
    params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '24');

    api
      .get<{ data: Comic[]; meta: Meta }>(`/comics?${params}`)
      .then((res) => {
        setComics(res.data || []);
        setMeta(res.meta || null);
      })
      .catch(() => {
        setComics([]);
        setMeta(null);
      })
      .finally(() => setLoading(false));
  }, [selectedGenre, sort, page]);

  const updateFilters = (newGenre?: string | null, newSort?: string, newPage?: number) => {
    const params = new URLSearchParams();
    const g = newGenre !== undefined ? newGenre : selectedGenre;
    const s = newSort !== undefined ? newSort : sort;
    const p = newPage !== undefined ? newPage : 1;

    if (g) params.set('genre', g);
    if (s && s !== 'updated') params.set('sort', s);
    if (p > 1) params.set('page', String(p));

    const qs = params.toString();
    router.push(qs ? `/comics?${qs}` : '/comics', { scroll: false });

    if (newPage !== undefined) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];
  const totalPages = meta?.totalPages ?? (meta ? Math.ceil(meta.total / (meta.limit || 24)) : 1);

  // Generate pagination items with ellipses
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );

  return (
    <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Khám phá truyện
          </h1>
          {meta && (
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Hiển thị {comics.length > 0 ? (page - 1) * 24 + 1 : 0} -{' '}
              {Math.min(page * 24, meta.total)} trên tổng số {meta.total} bộ truyện
            </p>
          )}
        </div>
      </div>

      {/* Filters: Sort & Genres */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Sort Dropdown */}
        <ElDropdown className="relative inline-block">
          <button
            type="button"
            popoverTarget="sort-menu"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300 outline-none transition-colors hover:bg-zinc-50 dark:hover:bg-white/10 cursor-pointer shadow-xs"
          >
            <span>{currentSortOption.label}</span>
            <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <ElMenu
            id="sort-menu"
            popover="auto"
            anchor="bottom start"
            className="z-20 mt-1 w-44 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-1.5 shadow-xl transition-opacity"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFilters(undefined, opt.value, 1)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${sort === opt.value
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </ElMenu>
        </ElDropdown>

        {/* Genre pills */}
        <button
          type="button"
          onClick={() => updateFilters(null, undefined, 1)}
          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${!selectedGenre
            ? 'bg-amber-500 text-white font-semibold shadow-sm shadow-amber-500/30'
            : 'border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:border-amber-300 dark:hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:shadow-xs'
            }`}
        >
          Tất cả
        </button>

        {genresLoading ? (
          ['w-16', 'w-20', 'w-14', 'w-24', 'w-18'].map((widthClass, i) => (
            <div
              key={i}
              className={`h-7 ${widthClass} animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-800/60`}
            />
          ))
        ) : (
          genres.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => updateFilters(g.slug, undefined, 1)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${selectedGenre === g.slug
                ? 'bg-amber-500 text-white font-semibold shadow-sm shadow-amber-500/30'
                : 'border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:border-amber-300 dark:hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:shadow-xs'
                }`}
            >
              {g.icon} {g.name}
            </button>
          ))
        )}
      </div>

      {/* Comics Grid (Using Shared Component) */}
      <ComicGrid
        comics={comics}
        isLoading={loading}
        skeletonCount={24}
        emptyMessage="Không tìm thấy bộ truyện nào phù hợp với bộ lọc."
      />

      {/* Pagination Controls */}
      {meta && totalPages > 1 && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Previous Page Button */}
            <button
              type="button"
              onClick={() => updateFilters(undefined, undefined, page - 1)}
              disabled={page <= 1}
              aria-label="Trang trước"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-sm text-zinc-600 dark:text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-amber-500/40 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <i className="fa-light fa-chevron-left text-xs" />
            </button>

            {/* Page Number Buttons */}
            {pageNumbers.map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-1.5 sm:px-2 text-zinc-400 dark:text-zinc-600 select-none">…</span>
                )}
                <button
                  type="button"
                  onClick={() => updateFilters(undefined, undefined, p)}
                  className={`flex h-9 min-w-9 sm:h-10 sm:min-w-10 px-2 sm:px-3 items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${p === page
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                    : 'border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-amber-500/40'
                    }`}
                >
                  {p}
                </button>
              </span>
            ))}

            {/* Next Page Button */}
            <button
              type="button"
              onClick={() => updateFilters(undefined, undefined, page + 1)}
              disabled={page >= totalPages || !meta.hasNext}
              aria-label="Trang sau"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-sm text-zinc-600 dark:text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-amber-500/40 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <i className="fa-light fa-chevron-right text-xs" />
            </button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Trang <span className="font-semibold text-zinc-700 dark:text-zinc-300">{page}</span> / {totalPages}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComicsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8">
          <div className="h-8 w-48 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse mb-6" />
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <ComicCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ComicsContent />
    </Suspense>
  );
}
