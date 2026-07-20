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

interface HomepageData {
  trending: Comic[];
  latest: Comic[];
  topRated: Comic[];
}

interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export default function Home() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [search, setSearch] = useState('');

  // Typewriter effect variables and states
  const words = [
    'mọi lúc, mọi nơi',
    'mới nhất mỗi ngày',
    'hoàn toàn miễn phí',
    'sắc nét, mượt mà'
  ];
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleTyping = () => {
      const activeWord = words[wordIndex];
      if (!isDeleting) {
        if (displayedText === activeWord) {
          timer = setTimeout(() => setIsDeleting(true), 1500);
        } else {
          timer = setTimeout(() => {
            setDisplayedText(activeWord.substring(0, displayedText.length + 1));
          }, 100 + Math.random() * 50);
        }
      } else {
        if (displayedText === '') {
          timer = setTimeout(() => {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % words.length);
          }, 300);
        } else {
          timer = setTimeout(() => {
            setDisplayedText(activeWord.substring(0, displayedText.length - 1));
          }, 50);
        }
      }
    };

    handleTyping();
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, wordIndex]);

  useEffect(() => {
    api.get<{ data: HomepageData }>('/comics/homepage').then((r) => setData(r.data)).catch(() => { });
    api.get<{ data: Genre[] }>('/comics/genres').then((r) => setGenres(r.data)).catch(() => { });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/10 blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-fuchsia-600/8 blur-[120px]" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
          Comic Platform — Top 1 Việt Nam
        </div>
        <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl hidden">
          Đọc truyện tranh{' '}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              {displayedText}
            </span>
            <span className="ml-1 inline-block w-[3px] h-[0.9em] bg-pink-400 animate-cursor-blink align-middle" />
          </span>
        </h1>
        {/* <p className="mb-8 text-lg text-zinc-400">Nền tảng đọc truyện tranh online hỗ trợ tác giả Việt Nam</p> */}

        {/* Search */}
        <div className="mx-auto max-w-xl">
          <form
            onSubmit={(e) => { e.preventDefault(); if (search.trim()) window.location.href = `/comics?search=${encodeURIComponent(search)}`; }}
            className="flex gap-2"
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm truyện..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
            />
            <button type="submit" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25">
              Tìm kiếm
            </button>
          </form>
        </div>
      </section>

      {/* Genre Pills */}
      {genres.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-8">
          <div className="flex flex-wrap justify-center gap-2">
            {genres.map((g) => (
              <Link
                key={g.id}
                href={`/comics?genre=${g.slug}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
              >
                {g.icon} {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {data && data.trending.length > 0 && (
        <ComicSection title="🔥 Xu hướng" comics={data.trending} />
      )}

      {/* Latest */}
      {data && data.latest.length > 0 && (
        <ComicSection title="✨ Mới nhất" comics={data.latest} />
      )}

      {/* Top Rated */}
      {data && data.topRated.length > 0 && (
        <ComicSection title="⭐ Đánh giá cao" comics={data.topRated} />
      )}

      {/* Empty state */}
      {data && data.trending.length === 0 && data.latest.length === 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-zinc-500">Chưa có truyện nào. Hãy là người đầu tiên đăng truyện!</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
          >
            Bắt đầu sáng tác →
          </Link>
        </section>
      )}
    </div>
  );
}

function ComicSection({ title, comics }: { title: string; comics: Comic[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <Link href="/comics" className="text-sm text-violet-400 hover:text-violet-300">
          Xem tất cả →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {comics.map((comic) => (
          <Link key={comic.id} href={`/comics/${comic.slug}`} className="group">
            <div className="mb-2 aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-zinc-800 transition-all group-hover:border-violet-500/30 group-hover:shadow-lg group-hover:shadow-violet-500/10">
              {comic.coverUrl ? (
                <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-600">{comic.title[0]}</div>
              )}
            </div>
            <h3 className="line-clamp-2 text-sm font-medium text-zinc-200 group-hover:text-violet-300">{comic.title}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <span>📖 {comic.stats.totalChapters}</span>
              <span>👁️ {comic.stats.totalViews}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
