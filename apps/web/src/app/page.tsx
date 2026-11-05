'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { HeroSlider } from '@/components/home/hero-slider';
import { ComicGrid, type Comic } from '@/components/comic';

interface HomepageData {
  trending: Comic[];
  latest: Comic[];
  topRated: Comic[];
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

function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

export default function Home() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [isLoadingComics, setIsLoadingComics] = useState(true);
  const [newsData, setNewsData] = useState<FeaturedNewsData | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    api
      .get<{ data: HomepageData }>('/comics/homepage?limit=12')
      .then((r) => setData(r.data))
      .catch(() => { })
      .finally(() => setIsLoadingComics(false));

    api
      .get<{ data: FeaturedNewsData }>('/news/featured')
      .then((r) => setNewsData(r.data))
      .catch(() => { })
      .finally(() => setIsLoadingNews(false));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 1. Hero Slider (Truyện nổi bật) */}
      <HeroSlider
        comics={data?.trending || []}
        isLoading={isLoadingComics}
      />

      {/* 2. News (Tin tức) */}
      <section className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-8">
        <div className="flex items-center justify-between pb-4 md:pb-6 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase">
                Tin tức & Sự kiện
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Chuyện gì đang xảy ra vậy?
            </h2>
          </div>
          <Link
            href="/news"
            className="group flex items-center gap-1.5 text-sm sm:text-base font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors"
          >
            <span>Xem tất cả</span>
            <i className="fa-duotone fa-solid fa-chevrons-right text-base sm:text-lg transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="py-6">
          {isLoadingNews ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="md:col-span-3 aspect-[4/3] lg:aspect-auto h-[260px] md:h-[420px] rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-none md:grid-rows-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
                ))}
              </div>
            </div>
          ) : newsData && (newsData.featured || newsData.latest.length > 0) ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Featured large card */}
              {newsData.featured && (
                <div className="lg:col-span-3 relative group rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-white/10 shadow-lg transition-all duration-300 hover:shadow-2xl">
                  <div className="w-full h-full min-h-[260px] sm:min-h-[360px] md:min-h-[440px]">
                    {newsData.featured.coverUrl ? (
                      <img
                        src={newsData.featured.coverUrl}
                        alt={newsData.featured.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center min-h-[300px]">
                        <i className="fa-light fa-newspaper text-6xl text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <Link href={`/news/${newsData.featured.slug}`}>
                    <span aria-hidden="true" className="absolute inset-0" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/75 to-transparent px-6 sm:px-8 py-6 sm:py-8">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold uppercase mb-2">
                        {newsData.featured.category || 'Nổi bật'}
                      </span>
                      <h3 className="text-white font-black text-lg sm:text-2xl md:text-3xl leading-snug drop-shadow line-clamp-2 group-hover:text-amber-400 transition-colors">
                        {newsData.featured.title}
                      </h3>
                      {newsData.featured.excerpt && (
                        <p className="hidden sm:line-clamp-2 text-zinc-300 text-xs sm:text-sm mt-2 font-light">
                          {newsData.featured.excerpt}
                        </p>
                      )}
                    </div>
                  </Link>
                </div>
              )}

              {/* Side cards */}
              {newsData.latest.length > 0 && (
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-none lg:grid-rows-4 gap-4">
                  {newsData.latest.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex items-center gap-3.5 rounded-xl border border-zinc-200/70 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-amber-500/40"
                    >
                      <div className="relative h-20 w-24 sm:h-22 sm:w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <i className="fa-light fa-newspaper text-xl text-zinc-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-1">
                        <Link href={`/news/${item.slug}`}>
                          <span aria-hidden="true" className="absolute inset-0" />
                          <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {item.title}
                          </h4>
                        </Link>
                        {item.excerpt && (
                          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-light">
                            {item.excerpt}
                          </p>
                        )}
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
      </section>

      {/* 3. Latest (Truyện mới cập nhật) */}
      <section className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-8 pb-16">
        <div className="flex items-center justify-between pb-4 md:pb-6 border-b border-zinc-200 dark:border-white/10 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                Mới cập nhật
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              TRUYỆN MỚI CẬP NHẬT
            </h2>
          </div>
          <Link
            href="/comics"
            className="group flex items-center gap-1.5 text-sm sm:text-base font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors"
          >
            <span>Xem tất cả</span>
            <i className="fa-duotone fa-solid fa-chevrons-right text-base sm:text-lg transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Comics Grid */}
        <ComicGrid
          comics={data?.latest || []}
          isLoading={isLoadingComics}
          skeletonCount={12}
          emptyMessage="Chưa có truyện mới nào được cập nhật."
        />

        {data && data.latest.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Link
              href="/comics"
              className="group inline-flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:border-transparent px-8 py-3.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:text-white dark:hover:text-white shadow-sm hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <span>Khám phá thêm</span>
              <i className="fa-duotone fa-solid fa-arrow-right text-base transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
