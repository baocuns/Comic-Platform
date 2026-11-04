'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export interface Comic {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverUrl: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number;
  status: string;
  author: { displayName: string; avatarUrl?: string | null };
  genres: { id: string; name: string; icon: string | null; slug?: string }[];
  stats: {
    totalViews: number;
    avgRating: number;
    totalChapters: number;
    totalBookmarks?: number;
  };
}

const statusLabel: Record<string, string> = {
  ONGOING: 'Đang tiến hành',
  COMPLETED: 'Hoàn thành',
  HIATUS: 'Tạm dừng',
  DRAFT: 'Bản nháp',
};

const statusColor: Record<string, string> = {
  ONGOING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  COMPLETED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  HIATUS: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  DRAFT: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

interface HeroSliderProps {
  comics: Comic[];
  isLoading?: boolean;
}

const SLIDE_DURATION = 6000; // 6 seconds

export function HeroSlider({ comics, isLoading = false }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const totalSlides = comics.length;

  const nextSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Auto-advance timer
  useEffect(() => {
    if (isLoading || totalSlides <= 1 || isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION);

    return () => clearInterval(timer);
  }, [isLoading, totalSlides, isPaused, nextSlide, currentIndex]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
  };

  if (isLoading) {
    return (
      <section className="relative w-full select-none">
        <div className="relative w-full h-[540px] sm:h-[600px] md:h-[640px] lg:h-[700px] overflow-hidden bg-zinc-950 animate-pulse border-b border-zinc-200/80 dark:border-white/10">
          <div className="mx-auto max-w-7xl h-full px-4 sm:px-8 md:px-12 lg:px-16 py-8 sm:py-10 md:py-12 flex flex-col justify-between">
            <div className="flex gap-2">
              <div className="h-6 w-32 rounded-full bg-zinc-800" />
              <div className="h-6 w-24 rounded-full bg-zinc-800" />
            </div>
            <div className="max-w-2xl space-y-4 my-auto">
              <div className="h-10 sm:h-14 w-4/5 rounded-xl bg-zinc-800" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-zinc-800" />
                <div className="h-6 w-24 rounded-full bg-zinc-800" />
              </div>
              <div className="h-16 w-full rounded-lg bg-zinc-800" />
              <div className="flex gap-4 pt-2">
                <div className="h-11 w-32 rounded-xl bg-zinc-800" />
                <div className="h-11 w-28 rounded-xl bg-zinc-800" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="h-2 w-28 rounded-full bg-zinc-800" />
              <div className="h-9 w-20 rounded-full bg-zinc-800" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (totalSlides === 0) {
    return null;
  }

  const currentComic = comics[currentIndex];

  return (
    <section
      className="relative w-full select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Truyện tranh nổi bật"
      role="region"
    >
      <div className="relative w-full h-[540px] sm:h-[600px] md:h-[640px] lg:h-[700px] overflow-hidden border-b border-zinc-200/80 dark:border-white/10 bg-zinc-950">
        {/* Dynamic Backgrounds with Crossfade */}
        {comics.map((comic, idx) => {
          const slideBg = comic.bannerUrl || comic.coverUrl;
          const isActive = idx === currentIndex;
          return (
            <div
              key={comic.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${
                isActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'
              }`}
            >
              {slideBg ? (
                <img
                  src={slideBg}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover scale-105 transition-transform duration-7000 ease-out"
                  style={{
                    objectPosition: `center ${comic.bannerPosition ?? 50}%`,
                  }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-amber-900/40 via-zinc-900 to-black" />
              )}
            </div>
          );
        })}

        {/* Ambient Dark Gradients & Lighting */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/30 lg:bg-gradient-to-r lg:from-zinc-950 lg:via-zinc-950/85 lg:to-transparent/30 z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 z-10" />

        {/* Slide Main Content - Max Width Container for Clean Alignment */}
        <div className="relative z-20 mx-auto max-w-7xl h-full w-full px-4 sm:px-8 md:px-12 lg:px-16 py-8 sm:py-10 md:py-12 flex flex-col justify-between">
          {/* Top Bar inside Slider: Ranking & Pagination indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/40 backdrop-blur-md shadow-xs shadow-amber-500/20">
                <i className="fa-solid fa-fire text-amber-400 animate-pulse text-[11px]" />
                NỔI BẬT #{currentIndex + 1}
              </span>
              <span
                className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border backdrop-blur-md ${
                  statusColor[currentComic.status] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
                }`}
              >
                {statusLabel[currentComic.status] || currentComic.status}
              </span>
            </div>

            {/* Slide Counter */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-black/40 border border-white/10 px-3 py-1 rounded-full backdrop-blur-md">
              <span className="text-amber-400 font-bold">{String(currentIndex + 1).padStart(2, '0')}</span>
              <span className="text-zinc-500">/</span>
              <span>{String(totalSlides).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Middle Body: Text on Left, Floating Poster Card on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">
            {/* Left Column: Comic Details */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-5 max-w-3xl">
              {/* Title */}
              <Link href={`/comics/${currentComic.slug}`} className="group inline-block">
                <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight group-hover:text-amber-400 transition-colors drop-shadow-md line-clamp-2">
                  {currentComic.title}
                </h1>
              </Link>

              {/* Genres */}
              {currentComic.genres && currentComic.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {currentComic.genres.slice(0, 5).map((g) => (
                    <Link
                      key={g.id}
                      href={`/comics?genre=${g.slug || g.name}`}
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1 text-xs font-medium text-zinc-200 transition-colors backdrop-blur-md"
                    >
                      {g.icon && <span>{g.icon}</span>}
                      <span>{g.name}</span>
                    </Link>
                  ))}
                  {currentComic.genres.length > 5 && (
                    <span className="text-xs text-zinc-400 px-1">
                      +{currentComic.genres.length - 5} thể loại
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              <p className="text-xs sm:text-sm md:text-base text-zinc-300 line-clamp-2 sm:line-clamp-3 leading-relaxed font-light drop-shadow">
                {currentComic.description || 'Khám phá câu chuyện hấp dẫn và lôi cuốn với những tình tiết đặc sắc đang chờ đón bạn.'}
              </p>

              {/* Stats Bar */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-zinc-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <i className="fa-light fa-user-pen text-amber-400 text-sm" />
                  <span className="font-medium text-white">{currentComic.author.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-light fa-book-open text-amber-400 text-sm" />
                  <span>{currentComic.stats.totalChapters} Chương</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-light fa-eye text-amber-400 text-sm" />
                  <span>{formatNumber(currentComic.stats.totalViews)} lượt xem</span>
                </div>
                {currentComic.stats.avgRating > 0 && (
                  <div className="flex items-center gap-1 text-amber-400 font-semibold">
                    <i className="fa-solid fa-star text-xs" />
                    <span>{currentComic.stats.avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Call to Actions */}
              <div className="flex items-center gap-3 pt-2 sm:pt-4">
                <Link
                  href={`/comics/${currentComic.slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-6 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <i className="fa-solid fa-play text-xs" />
                  <span>Đọc ngay</span>
                </Link>

                <Link
                  href={`/comics/${currentComic.slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-md hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <i className="fa-light fa-circle-info text-sm" />
                  <span>Chi tiết</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Floating Poster Card (hidden on small screens, gorgeous on lg) */}
            <div className="hidden lg:flex lg:col-span-4 justify-center items-center">
              <Link
                href={`/comics/${currentComic.slug}`}
                className="group relative block w-[230px] xl:w-[260px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border-2 border-white/20 hover:border-amber-400/60 transition-all duration-500 hover:scale-105 hover:-rotate-1"
              >
                {currentComic.coverUrl ? (
                  <img
                    src={currentComic.coverUrl}
                    alt={currentComic.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-zinc-800 flex items-center justify-center text-4xl font-bold text-zinc-500">
                    {currentComic.title[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-xs text-white font-medium flex items-center gap-1.5">
                    <i className="fa-solid fa-book-open text-amber-400" /> Xem thông tin truyện
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Bottom Bar: Indicators & Controls */}
          <div className="flex items-center justify-between pt-4">
            {/* Pill/Dot Indicators */}
            <div className="flex items-center gap-2">
              {comics.map((_, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-8 bg-amber-500 shadow-sm shadow-amber-500/50'
                        : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                    aria-label={`Chuyển tới truyện ${idx + 1}`}
                  />
                );
              })}
            </div>

            {/* Next / Prev Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevSlide}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-amber-500 text-white hover:text-white border border-white/15 backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                title="Truyện trước"
                aria-label="Truyện trước"
              >
                <i className="fa-light fa-chevron-left text-base" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-amber-500 text-white hover:text-white border border-white/15 backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                title="Truyện kế tiếp"
                aria-label="Truyện kế tiếp"
              >
                <i className="fa-light fa-chevron-right text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
