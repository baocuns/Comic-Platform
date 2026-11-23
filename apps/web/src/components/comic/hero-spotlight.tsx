'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, BookOpen, Star, Eye, Sparkles } from 'lucide-react';
import type { ComicSummary } from 'shared';
import { COMIC_TYPE_LABEL, formatCompactNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface HeroSpotlightProps {
  comics: ComicSummary[];
  isLoading?: boolean;
}

export function HeroSpotlight({ comics, isLoading }: HeroSpotlightProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [comics?.length]);

  useEffect(() => {
    if (!comics || comics.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % comics.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [comics]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Skeleton className="h-[340px] w-full rounded-3xl sm:h-[400px]" />
      </div>
    );
  }

  if (!comics || comics.length === 0) return null;

  const current = comics[index % comics.length];
  const bgImage = current.bannerUrl || current.coverUrl;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[#181B22] text-white shadow-lg">
        {/* Atmospheric background */}
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-all duration-700"
            style={{ objectPosition: `center ${current.bannerPosition ?? 50}%` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#111318] via-[#111318]/85 to-[#111318]/40" />

        <div className="relative z-10 grid grid-cols-1 items-center gap-6 p-6 sm:p-9 md:grid-cols-[1fr_200px] lg:grid-cols-[1fr_230px] lg:p-11">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-warm)] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                <Sparkles className="h-3 w-3" />
                Tiêu điểm biên tập
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                {COMIC_TYPE_LABEL[current.type] || current.type}
              </span>
              {current.genres.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/85"
                >
                  {g.name}
                </span>
              ))}
            </div>

            <h1 className="font-serif text-2xl font-bold leading-tight text-white sm:text-4xl lg:text-[42px] line-clamp-2">
              {current.title}
            </h1>

            {current.description && (
              <p className="max-w-2xl text-sm leading-relaxed text-white/80 line-clamp-2 sm:line-clamp-3">
                {current.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-white/75">
              <span className="font-semibold text-white">{current.author?.displayName}</span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-amber-300" />
                {current.stats.totalChapters} chương
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCompactNumber(current.stats.totalViews)} lượt xem
              </span>
              {current.stats.avgRating > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {current.stats.avgRating.toFixed(1)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/comics/${current.slug}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-warm)] px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-warm-hover)] active:scale-[0.98]"
              >
                <BookOpen className="h-4 w-4" />
                <span>Đọc ngay</span>
              </Link>
              <Link
                href="/rankings"
                className="inline-flex h-10 items-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                Bảng xếp hạng
              </Link>
            </div>
          </div>

          {/* Right Poster */}
          <Link
            href={`/comics/${current.slug}`}
            className="hidden md:block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl transition-transform duration-300 hover:scale-[1.03]"
          >
            {current.coverUrl ? (
              <img src={current.coverUrl} alt={current.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-white/10 text-3xl font-bold">
                {current.title[0]}
              </div>
            )}
          </Link>
        </div>

        {/* Navigation controls */}
        {comics.length > 1 && (
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/25 px-6 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              {comics.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  aria-label={`Xem truyện ${c.title}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === index % comics.length ? 'w-7 bg-[var(--accent-warm)]' : 'w-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev - 1 + comics.length) % comics.length)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                aria-label="Slide trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev + 1) % comics.length)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                aria-label="Slide kế tiếp"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
