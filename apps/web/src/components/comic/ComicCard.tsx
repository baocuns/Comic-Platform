'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Eye, Star, Clock, Sparkles } from 'lucide-react';
import type { ComicSummary } from 'shared';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import { COMIC_TYPE_LABEL, formatCompactNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

export interface ComicCardProps {
  comic: ComicSummary;
  className?: string;
}

export function ComicCard({ comic, className = '' }: ComicCardProps) {
  const isHydrated = useReadingHistoryStore((s) => s.isHydrated);
  const hydrate = useReadingHistoryStore((s) => s.hydrate);
  const historyEntry = useReadingHistoryStore((s) => s.getByComic(comic.id, comic.slug));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const latestChap = comic.latestChapters?.[0];

  return (
    <Link href={`/comics/${comic.slug}`} className={`group block ${className}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[var(--accent-primary)]/40 group-hover:shadow-lg">
        {comic.coverUrl ? (
          <img
            src={comic.coverUrl}
            alt={comic.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-3xl font-bold text-[var(--text-muted)]">
            {comic.title[0]}
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            {COMIC_TYPE_LABEL[comic.type] || comic.type}
          </span>
          {comic.stats.avgRating > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
              <Star className="h-3 w-3 fill-current" />
              {comic.stats.avgRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Bottom editorial gradient */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 pt-10">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white transition-colors group-hover:text-amber-200">
            {comic.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/80">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-amber-300" />
              {latestChap ? `Ch.${latestChap.number}` : `${comic.stats.totalChapters} chương`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompactNumber(comic.stats.totalViews)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
          {comic.author?.displayName || 'Tác giả'}
        </p>
        {isHydrated && historyEntry && (
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)]">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Đọc dở Ch.{historyEntry.chapterNumber}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export function ComicCardHorizontal({
  comic,
  rank,
  subtitle,
}: {
  comic: ComicSummary;
  rank?: number;
  subtitle?: string;
}) {
  return (
    <Link
      href={`/comics/${comic.slug}`}
      className="group flex items-center gap-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-sm"
    >
      {rank !== undefined && (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
            rank === 1
              ? 'bg-[var(--accent-warm)] text-white'
              : rank === 2
                ? 'bg-[var(--accent-primary)] text-white'
                : rank === 3
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
          }`}
        >
          {rank}
        </span>
      )}
      <div className="h-18 w-13 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
        {comic.coverUrl ? (
          <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
            {comic.title[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
          {comic.title}
        </h4>
        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
          {subtitle || comic.genres.slice(0, 2).map((g) => g.name).join(' · ') || comic.author?.displayName}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCompactNumber(comic.stats.totalViews)}
          </span>
          {comic.stats.avgRating > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--warning)] font-semibold">
              <Star className="h-3 w-3 fill-current" />
              {comic.stats.avgRating.toFixed(1)}
            </span>
          )}
          <span>{comic.stats.totalChapters} ch.</span>
        </div>
      </div>
    </Link>
  );
}

export function ComicCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
      <Skeleton className="h-3.5 w-3/4" />
    </div>
  );
}

export function ComicGrid({
  comics,
  isLoading = false,
  skeletonCount = 12,
  emptyMessage = 'Chưa có truyện nào.',
  className = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
}: {
  comics: ComicSummary[];
  isLoading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={className}>
        {Array.from({ length: skeletonCount }).map((_, idx) => (
          <ComicCardSkeleton key={idx} />
        ))}
      </div>
    );
  }

  if (!comics || comics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-14 text-center">
        <Sparkles className="mb-2 h-7 w-7 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-secondary)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {comics.map((comic) => (
        <ComicCard key={comic.id} comic={comic} />
      ))}
    </div>
  );
}
