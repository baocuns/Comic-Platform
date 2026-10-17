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

interface FeaturedNews {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string;
  publishedAt: string;
  author: { displayName: string; avatarUrl: string | null };
}

interface FeaturedNewsData {
  featured: FeaturedNews | null;
  latest: FeaturedNews[];
}

export default function Home() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);
  const [search, setSearch] = useState('');
  const [newsData, setNewsData] = useState<FeaturedNewsData | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  // Search placeholder typewriter effect
  const searchPlaceholders = [
    'Người trên vạn người',
    'Đại quản gia là ma hoàng',
    'Đấu la đại lục',
    'Chàng rể mạnh nhất lịch sử'
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isPlaceholderDeleting, setIsPlaceholderDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleTyping = () => {
      const activeWord = searchPlaceholders[placeholderIndex];
      if (!isPlaceholderDeleting) {
        if (displayedPlaceholder === activeWord) {
          timer = setTimeout(() => setIsPlaceholderDeleting(true), 2000);
        } else {
          timer = setTimeout(() => {
            setDisplayedPlaceholder(activeWord.substring(0, displayedPlaceholder.length + 1));
          }, 80 + Math.random() * 40);
        }
      } else {
        if (displayedPlaceholder === '') {
          timer = setTimeout(() => {
            setIsPlaceholderDeleting(false);
            setPlaceholderIndex((prev) => (prev + 1) % searchPlaceholders.length);
          }, 300);
        } else {
          timer = setTimeout(() => {
            setDisplayedPlaceholder(activeWord.substring(0, displayedPlaceholder.length - 1));
          }, 40);
        }
      }
    };

    handleTyping();
    return () => clearTimeout(timer);
  }, [displayedPlaceholder, isPlaceholderDeleting, placeholderIndex]);

  useEffect(() => {
    api.get<{ data: HomepageData }>('/comics/homepage').then((r) => setData(r.data)).catch(() => { });
    api.get<{ data: Genre[] }>('/comics/genres')
      .then((r) => setGenres(r.data))
      .catch(() => { })
      .finally(() => setIsLoadingGenres(false));
    api.get<{ data: FeaturedNewsData }>('/news/featured')
      .then((r) => setNewsData(r.data))
      .catch(() => { })
      .finally(() => setIsLoadingNews(false));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 dark:bg-amber-400" />
          O W O C — Beta 1.0
        </div>

        {/* Search */}
        <div className="mx-auto max-w-xl">
          <form
            onSubmit={(e) => { e.preventDefault(); if (search.trim()) window.location.href = `/comics?search=${encodeURIComponent(search)}`; }}
            className="relative flex items-center"
          >
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={displayedPlaceholder}
                className="w-full rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 pl-5 pr-14 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors"
              >
                <i className="fa-light fa-magnifying-glass text-base" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Genre Pills */}
      {(isLoadingGenres || genres.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 pb-8">
          <div className="flex flex-wrap justify-center gap-2">
            {isLoadingGenres
              ? Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-7 rounded-full bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse border border-zinc-200/30 dark:border-white/5 ${i % 5 === 0 ? 'w-20' : i % 5 === 1 ? 'w-28' : i % 5 === 2 ? 'w-24' : i % 5 === 3 ? 'w-32' : 'w-16'
                    }`}
                />
              ))
              : genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/comics?genre=${g.slug}`}
                  className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 font-medium"
                >
                  {g.icon} {g.name}
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* news */}
      <section>
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 pb-10">
          <div className="flex justify-between pb-3 md:py-6">
            <h2 className="text-3xl lg:text-5xl font-bold dark:text-white">
              Chuyện gì đang xảy ra vậy?
            </h2>
            <Link href="/news" className="hidden lg:block text-3xl text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors">
              <i className="fa-duotone fa-solid fa-chevrons-right"></i>
            </Link>
          </div>
          <div className="py-6">
            {isLoadingNews ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="md:col-span-3 aspect-[4/3] lg:aspect-auto rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-none md:grid-rows-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              </div>
            ) : newsData && (newsData.featured || newsData.latest.length > 0) ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Featured large card */}
                {newsData.featured && (
                  <div className="md:col-span-3 relative transition duration-500 ease-in-out hover:scale-105 z-10">
                    <div className="w-full h-full">
                      {newsData.featured.coverUrl ? (
                        <img src={newsData.featured.coverUrl} alt={newsData.featured.title} className="h-[201px] md:h-[496px] w-full rounded object-cover" />
                      ) : (
                        <div className="h-full w-full rounded bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center min-h-[300px]">
                          <i className="fa-light fa-newspaper text-6xl text-zinc-300 dark:text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <Link href={`/news/${newsData.featured.slug}`}>
                      <span aria-hidden="true" className="absolute inset-0"></span>
                      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black to-transparent px-6 md:px-12 py-5 md:py-10 rounded-b">
                        <p className="text-white font-bold text-sm md:text-3xl">{newsData.featured.title}</p>
                      </div>
                    </Link>
                  </div>
                )}
                {/* Side cards */}
                {newsData.latest.length > 0 && (
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-none md:grid-rows-4 gap-4">
                    {newsData.latest.map((item) => (
                      <div key={item.id} className="grid grid-cols-3 gap-4 relative transition duration-500 ease-in-out hover:scale-105 shadow rounded dark:shadow-gray-700">
                        <div style={{ clipPath: "polygon(0 0,100% 0,85% 100%,0 100%)" }}>
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt={item.title} className="h-[88px] md:h-[112px] w-full rounded-l object-cover" />
                          ) : (
                            <div className="h-full w-full rounded-l bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
                              <i className="fa-light fa-newspaper text-xl text-zinc-300 dark:text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 p-2">
                          <Link href={`/news/${item.slug}`}>
                            <span aria-hidden="true" className="absolute inset-0"></span>
                            <p className="font-bold line-clamp-1 md:line-clamp-2 dark:text-white">{item.title}</p>
                          </Link>
                          <div>
                            <p className="line-clamp-2 font-light dark:text-white">{item.excerpt || ''}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📰</div>
                <p className="text-zinc-500 dark:text-zinc-400">Chưa có tin tức nào.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trending */}
      {data && data.trending.length > 0 && (
        <ComicSection title="TRUYỆN ĐANG THỊNH HÀNH" comics={data.trending} />
      )}

      {/* Latest */}
      {data && data.latest.length > 0 && (
        <ComicSection title="TRUYỆN MỚI CẬP NHẬT" comics={data.latest} />
      )}

      {/* Top Rated */}
      {data && data.topRated.length > 0 && (
        <ComicSection title="TRUYỆN ĐƯỢC YÊU THÍCH" comics={data.topRated} />
      )}

      {/* Empty state */}
      {data && data.trending.length === 0 && data.latest.length === 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-zinc-500">Chưa có truyện nào. Hãy là người đầu tiên đăng truyện!</p>
          <Link
            href="/studio"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:brightness-110 transition-all"
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
    <section className="px-4 sm:px-8 md:px-12 lg:px-16 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h2>
        <Link href="/comics" className="text-3xl text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors">
          <i className="fa-duotone fa-solid fa-chevrons-right"></i>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {comics.map((comic) => (
          <Link key={comic.id} href={`/comics/${comic.slug}`} className="group">
            <div className="mb-2 aspect-[3/4] overflow-hidden rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 transition-all group-hover:border-amber-500/40 group-hover:shadow-lg group-hover:shadow-amber-500/10">
              {comic.coverUrl ? (
                <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-500 ease-in-out" />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
              )}
            </div>
            <h3 className="line-clamp-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{comic.title}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span><i className="fa-light fa-image"></i> {comic.stats.totalChapters}</span>
              <span><i className="fa-light fa-eye"></i> {comic.stats.totalViews}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
