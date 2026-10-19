'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ElDropdown, ElMenu } from '@tailwindplus/elements/react';

interface Comic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  author: { displayName: string };
  genres: { id: string; name: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number; totalChapters: number };
}

interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
  comicCount: number;
}

const SORT_OPTIONS = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'latest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến' },
  { value: 'rating', label: 'Đánh giá cao' },
];

export default function ComicsPage() {
  return <Suspense fallback={<div className="p-8" role="status">Đang mở thế giới truyện…</div>}><ComicsCatalog /></Suspense>;
}

function ComicsCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comics, setComics] = useState<Comic[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const selectedGenre = searchParams.get('genre');
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'updated';
  const setFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/comics${params.size ? `?${params}` : ''}`, { scroll: false });
  };
  const requestKey = JSON.stringify([selectedGenre, sort, search]);
  const [completedRequest, setCompletedRequest] = useState<string | null>(null);
  const loading = completedRequest !== requestKey;

  useEffect(() => {
    api.get<{ data: Genre[] }>('/comics/genres')
      .then((res) => setGenres(res.data))
      .catch(() => { })
      .finally(() => setGenresLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedGenre) params.set('genre', selectedGenre);
    if (search) params.set('search', search);
    params.set('sort', sort);
    params.set('limit', '20');

    api.get<{ data: Comic[]; meta: unknown }>(`/comics?${params}`)
      .then((res) => { if (!cancelled) setComics(res.data); })
      .catch(() => { })
      .finally(() => { if (!cancelled) setCompletedRequest(requestKey); });
    return () => { cancelled = true; };
  }, [selectedGenre, sort, search, requestKey]);

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];

  return (
    <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Khám phá truyện</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Sort Dropdown */}
        <ElDropdown className="relative inline-block">
          <button
            type="button"
            popoverTarget="sort-menu"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300 outline-none transition-colors hover:bg-zinc-50 dark:hover:bg-white/10 cursor-pointer"
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
                onClick={() => setFilter('sort', opt.value)}
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
          onClick={() => setFilter('genre', null)}
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
              onClick={() => setFilter('genre', g.slug)}
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

      {/* Comics Grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-2 aspect-[3/4] rounded border border-zinc-200/60 dark:border-white/5 bg-zinc-200/60 dark:bg-zinc-800/60" />
              <div className="h-4 w-5/6 rounded bg-zinc-200/60 dark:bg-zinc-800/60 mb-1.5" />
              <div className="h-3 w-1/2 rounded bg-zinc-200/40 dark:bg-zinc-800/40 mb-1.5" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-1/4 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
                <div className="h-3 w-1/4 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
              </div>
            </div>
          ))}
        </div>
      ) : comics.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">Chưa có truyện nào</div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {comics.map((comic) => (
            <Link key={comic.id} href={`/comics/${comic.slug}`} className="group">
              <div className="mb-2 aspect-[3/4] overflow-hidden rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 transition-all group-hover:border-amber-500/40 group-hover:shadow-lg group-hover:shadow-amber-500/10">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-500 ease-in-out" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
                )}
              </div>
              <h3 className="line-clamp-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{comic.title}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{comic.author.displayName}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-500">
                <span><i className="fa-light fa-image"></i> {comic.stats.totalChapters}</span>
                <span><i className="fa-light fa-eye"></i> {comic.stats.totalViews}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
