'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

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

export default function ComicsPage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<string>('updated');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Genre[] }>('/comics/genres').then((res) => setGenres(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedGenre) params.set('genre', selectedGenre);
    params.set('sort', sort);
    params.set('limit', '20');

    api.get<{ data: Comic[]; meta: unknown }>(`/comics?${params}`)
      .then((res) => setComics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedGenre, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Khám phá truyện</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300 outline-none transition-colors"
        >
          <option value="updated">Mới cập nhật</option>
          <option value="latest">Mới nhất</option>
          <option value="popular">Phổ biến</option>
          <option value="rating">Đánh giá cao</option>
        </select>

        {/* Genre pills */}
        <button
          onClick={() => setSelectedGenre(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            !selectedGenre ? 'bg-violet-600 text-white' : 'border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          Tất cả
        </button>
        {genres.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGenre(g.slug)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              selectedGenre === g.slug ? 'bg-violet-600 text-white' : 'border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {g.icon} {g.name}
          </button>
        ))}
      </div>

      {/* Comics Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>
      ) : comics.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">Chưa có truyện nào</div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {comics.map((comic) => (
            <Link key={comic.id} href={`/comics/${comic.slug}`} className="group">
              <div className="mb-2 aspect-[3/4] overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 transition-all group-hover:border-violet-500/30 group-hover:shadow-lg group-hover:shadow-violet-500/5 dark:group-hover:shadow-violet-500/10">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
                )}
              </div>
              <h3 className="line-clamp-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-violet-600 dark:group-hover:text-violet-300">{comic.title}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{comic.author.displayName}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-500">
                <span>📖 {comic.stats.totalChapters}</span>
                <span>👁️ {comic.stats.totalViews}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
