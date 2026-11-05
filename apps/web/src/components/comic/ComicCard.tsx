'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useReadingHistoryStore } from '@/stores/reading-history-store';

export interface Comic {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverUrl: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number;
  status: string;
  author: { displayName: string; avatarUrl?: string | null; username?: string };
  genres: { id: string; name: string; icon: string | null; slug?: string }[];
  stats: {
    totalViews: number;
    avgRating: number;
    totalChapters: number;
    totalBookmarks?: number;
  };
}

export function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

/**
 * Hook to access instant local reading history map.
 */
export function useReadHistory(): Record<string, string> {
  const isHydrated = useReadingHistoryStore((s) => s.isHydrated);
  const hydrate = useReadingHistoryStore((s) => s.hydrate);
  const history = useReadingHistoryStore((s) => s.history);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return isHydrated ? history : {};
}

export interface ComicCardProps {
  comic: Comic;
  lastReadChapter?: string;
  className?: string;
}

export function ComicCard({ comic, lastReadChapter: propLastReadChapter, className = '' }: ComicCardProps) {
  const isHydrated = useReadingHistoryStore((s) => s.isHydrated);
  const hydrate = useReadingHistoryStore((s) => s.hydrate);
  const storeLastRead = useReadingHistoryStore((s) => s.getChapter(comic.id, comic.slug));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Priority: explicitly passed prop -> localStorage reading history
  const lastReadChapter = propLastReadChapter ?? (isHydrated ? storeLastRead : undefined);

  return (
    <Link href={`/comics/${comic.slug}`} className={`group block ${className}`}>
      <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 transition-all duration-300 group-hover:border-amber-500/50 group-hover:shadow-xl group-hover:shadow-amber-500/10 group-hover:-translate-y-1">
        {comic.coverUrl ? (
          <img
            src={comic.coverUrl}
            alt={comic.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-bold text-zinc-400 dark:text-zinc-600">
            {comic.title[0]}
          </div>
        )}

        {/* Chapter badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white">
          <i className="fa-light fa-book-open text-amber-400 text-[10px]" />
          <span>C.{comic.stats.totalChapters}</span>
        </div>

        {/* Rating if available */}
        {comic.stats.avgRating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[11px] font-bold text-amber-400">
            <i className="fa-solid fa-star text-[9px]" />
            <span>{comic.stats.avgRating.toFixed(1)}</span>
          </div>
        )}

        {/* Title overlay with bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/75 to-transparent p-2.5 pt-8">
          <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors drop-shadow-sm leading-snug">
            {comic.title}
          </h3>
        </div>
      </div>

      {/* Info: Author, Views, and Reading Progress */}
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="truncate max-w-[65%] hover:text-zinc-700 dark:hover:text-zinc-300">
            {comic.author?.displayName || 'Tác giả'}
          </span>
          <span className="flex items-center gap-1 text-[11px] shrink-0">
            <i className="fa-light fa-eye text-zinc-400" />
            {formatNumber(comic.stats.totalViews)}
          </span>
        </div>

        {lastReadChapter && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <i className="fa-light fa-clock-rotate-left text-[10px] shrink-0" />
            <span className="truncate">Đã đọc đến chap {lastReadChapter}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ComicCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-2 aspect-[3/4] rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-1/2 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
        <div className="h-3 w-1/4 rounded bg-zinc-200/50 dark:bg-zinc-800/50" />
      </div>
    </div>
  );
}

export interface ComicGridProps {
  comics: Comic[];
  readHistoryMap?: Record<string, string>;
  isLoading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  emptyIcon?: string;
  className?: string;
}

export function ComicGrid({
  comics,
  readHistoryMap,
  isLoading = false,
  skeletonCount = 12,
  emptyMessage = 'Chưa có truyện nào.',
  emptyIcon = '📚',
  className = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
}: ComicGridProps) {
  if (isLoading) {
    return (
      <div className={className}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ComicCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!comics || comics.length === 0) {
    return (
      <div className="py-16 text-center text-zinc-500 dark:text-zinc-400">
        <div className="text-4xl mb-3">{emptyIcon}</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {comics.map((comic) => (
        <ComicCard
          key={comic.id}
          comic={comic}
          lastReadChapter={readHistoryMap ? (readHistoryMap[comic.id] || readHistoryMap[comic.slug]) : undefined}
        />
      ))}
    </div>
  );
}
