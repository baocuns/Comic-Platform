'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  LayoutGrid,
  List,
  Lock,
  Search,
  Unlock,
  X,
} from 'lucide-react';
import type { ChapterSummary } from 'shared';
import { useReadingHistoryStore } from '@/stores/reading-history-store';

interface ChapterListProps {
  chapters: ChapterSummary[];
  comicId?: string;
  comicSlug?: string;
  lastChapterId?: string | null;
  readChapterIds?: string[];
  unlockedChapterIds?: string[];
  className?: string;
}

const CHAPTERS_PER_PAGE = 50;

function formatCompactDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;

  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours} giờ`;

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays} ngày`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function ChapterList({
  chapters,
  comicId,
  comicSlug,
  lastChapterId,
  readChapterIds = [],
  unlockedChapterIds = [],
  className = '',
}: ChapterListProps) {
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [chapterPageIndex, setChapterPageIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Local history fallback for guests or instant updates after reading
  const isHydrated = useReadingHistoryStore((s) => s.isHydrated);
  const hydrate = useReadingHistoryStore((s) => s.hydrate);
  const entries = useReadingHistoryStore((s) => s.entries);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const localRecord = useMemo(() => {
    if (!isHydrated) return undefined;
    if (comicId && entries[comicId]) return entries[comicId];
    if (comicSlug) {
      return Object.values(entries).find((e) => e.comicSlug === comicSlug);
    }
    return undefined;
  }, [isHydrated, entries, comicId, comicSlug]);

  const currentChapter = useMemo(() => {
    if (lastChapterId) {
      const serverMatch = chapters.find((c) => c.id === lastChapterId);
      if (serverMatch) return serverMatch;
    }
    if (localRecord) {
      const localMatch = chapters.find(
        (c) => c.id === localRecord.chapterId || c.number === localRecord.chapterNumber,
      );
      if (localMatch) return localMatch;
    }
    return undefined;
  }, [chapters, lastChapterId, localRecord]);

  const currentChapterId = currentChapter?.id ?? lastChapterId ?? localRecord?.chapterId ?? null;
  const currentChapterNumber = currentChapter?.number ?? localRecord?.chapterNumber ?? null;

  const getChapterState = useCallback(
    (ch: ChapterSummary) => {
      const isCurrent =
        Boolean(currentChapterId && ch.id === currentChapterId) ||
        (currentChapterNumber !== null && ch.number === currentChapterNumber);

      const isRead =
        isCurrent ||
        Boolean(ch.isRead) ||
        readChapterIds.includes(ch.id) ||
        (currentChapterNumber !== null && ch.number < currentChapterNumber);

      const isUnlocked =
        !ch.isPremium ||
        ch.priceCoins === 0 ||
        Boolean(ch.isUnlocked) ||
        unlockedChapterIds.includes(ch.id);

      return { isCurrent, isRead, isUnlocked };
    },
    [currentChapterId, currentChapterNumber, readChapterIds, unlockedChapterIds],
  );

  // Filtered & sorted chapters
  const sortedChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? chapters.filter(
          (ch) =>
            String(ch.number).includes(q) || (ch.title && ch.title.toLowerCase().includes(q)),
        )
      : chapters;

    return [...list].sort((a, b) => (sortDesc ? b.number - a.number : a.number - b.number));
  }, [chapters, search, sortDesc]);

  const totalChapterPages = Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE);
  const safePageIndex = Math.min(chapterPageIndex, Math.max(0, totalChapterPages - 1));

  const paginatedChapters = useMemo(() => {
    const start = safePageIndex * CHAPTERS_PER_PAGE;
    return sortedChapters.slice(start, start + CHAPTERS_PER_PAGE);
  }, [sortedChapters, safePageIndex]);

  const rangeButtons = useMemo(() => {
    if (totalChapterPages <= 1) return [];
    return Array.from({ length: totalChapterPages }, (_, i) => {
      const chunk = sortedChapters.slice(i * CHAPTERS_PER_PAGE, (i + 1) * CHAPTERS_PER_PAGE);
      if (chunk.length === 0) return null;
      const firstNum = chunk[0].number;
      const lastNum = chunk[chunk.length - 1].number;
      return {
        index: i,
        label: firstNum === lastNum ? `Ch.${firstNum}` : `${firstNum} - ${lastNum}`,
      };
    }).filter(Boolean) as Array<{ index: number; label: string }>;
  }, [sortedChapters, totalChapterPages]);

  const rangeContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = rangeContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const timer = setTimeout(checkScroll, 80);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, rangeButtons]);

  const scrollRange = (dir: 'left' | 'right') => {
    const el = rangeContainerRef.current;
    if (!el) return;
    const amount = Math.max(150, el.clientWidth * 0.6);
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleSelectRange = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    setChapterPageIndex(index);
    e.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  const handleToggleSort = () => {
    setSortDesc((prev) => !prev);
    setChapterPageIndex(0);
    if (rangeContainerRef.current) {
      rangeContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToCurrent = () => {
    if (currentChapterId === null && currentChapterNumber === null) return;
    setSearch('');
    const orderedAll = [...chapters].sort((a, b) =>
      sortDesc ? b.number - a.number : a.number - b.number,
    );
    const targetIdx = orderedAll.findIndex(
      (c) => c.id === currentChapterId || c.number === currentChapterNumber,
    );
    if (targetIdx !== -1) {
      setChapterPageIndex(Math.floor(targetIdx / CHAPTERS_PER_PAGE));
    }
  };

  if (!chapters || chapters.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)] ${className}`}>
        <BookOpen className="mb-2 h-7 w-7 opacity-60" />
        <p className="text-sm">Truyện hiện chưa có chương nào được xuất bản.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 p-3.5 sm:p-5 ${className}`}>
      {/* Compact single-row mobile-friendly toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
            <BookOpen className="h-4 w-4 text-[var(--accent-warm)]" />
            <strong className="font-bold text-[var(--text-primary)]">{chapters.length}</strong>
            <span>chương</span>
          </span>

          {currentChapterNumber !== null && (
            <button
              type="button"
              onClick={handleJumpToCurrent}
              className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[var(--accent-warm)]/30 bg-[var(--accent-warm-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-warm)] hover:opacity-90 cursor-pointer"
              title="Chuyển tới dải chương đang đọc"
            >
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">Ch.{currentChapterNumber}</span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              searchOpen || search.trim()
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
            }`}
            title="Tìm chương"
            aria-label="Tìm chương"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Grid / List toggle */}
          <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Xem dạng lưới"
              aria-label="Xem dạng lưới"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Xem dạng danh sách"
              aria-label="Xem dạng danh sách"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Sort toggle */}
          <button
            type="button"
            onClick={handleToggleSort}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            title={sortDesc ? 'Mới nhất trước (nhấn để đảo ngược)' : 'Từ chương đầu (nhấn để đảo ngược)'}
            aria-label={sortDesc ? 'Đang sắp xếp mới nhất trước' : 'Đang sắp xếp từ chương đầu'}
          >
            {sortDesc ? (
              <ArrowDownWideNarrow className="h-4 w-4" />
            ) : (
              <ArrowUpNarrowWide className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible search input */}
      {(searchOpen || search.trim().length > 0) && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setChapterPageIndex(0);
            }}
            placeholder="Tìm theo số chương hoặc tên chương..."
            className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] pl-9 pr-8 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setChapterPageIndex(0);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Xóa từ khóa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 50-chapter Range Pagination Strip */}
      {rangeButtons.length > 1 && (
        <div className="flex items-center gap-1.5">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollRange('left')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] cursor-pointer"
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}

          <div
            ref={rangeContainerRef}
            onScroll={checkScroll}
            className="flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar scroll-smooth"
          >
            {rangeButtons.map((btn) => (
              <button
                key={btn.index}
                type="button"
                onClick={(e) => handleSelectRange(btn.index, e)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  safePageIndex === btn.index
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollRange('right')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] cursor-pointer"
              aria-label="Cuộn sang phải"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Chapters Content */}
      {paginatedChapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-8 text-center text-xs text-[var(--text-muted)]">
          Không tìm thấy chương phù hợp với &ldquo;{search}&rdquo;.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-5">
          {paginatedChapters.map((ch) => {
            const { isCurrent, isRead, isUnlocked } = getChapterState(ch);
            const isVip = ch.isPremium && ch.priceCoins > 0;
            const isVipLocked = isVip && !isUnlocked;
            const isVipUnlocked = isVip && isUnlocked;

            return (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                prefetch={false}
                className={`group flex items-center justify-between gap-1.5 rounded-xl border px-3 py-2.5 text-xs transition-all hover:-translate-y-0.5 ${
                  isCurrent
                    ? 'border-[var(--accent-warm)]/60 bg-[var(--accent-warm-soft)] hover:border-[var(--accent-warm)]'
                    : isRead
                      ? 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 opacity-80 hover:opacity-100 hover:border-[var(--accent-primary)]/40'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary-soft)]/40'
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {isCurrent ? (
                    <Bookmark className="h-3 w-3 shrink-0 fill-current text-[var(--accent-warm)]" />
                  ) : isVipUnlocked ? (
                    <Unlock className="h-3 w-3 shrink-0 text-[var(--success)]" />
                  ) : isRead ? (
                    <Check className="h-3 w-3 shrink-0 text-[var(--success)]" />
                  ) : isVipLocked ? (
                    <Lock className="h-3 w-3 shrink-0 text-[var(--accent-warm)]" />
                  ) : null}

                  <span
                    className={`truncate ${
                      isCurrent
                        ? 'font-bold text-[var(--accent-warm)]'
                        : isRead
                          ? 'font-medium text-[var(--text-secondary)]'
                          : 'font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    Ch.{ch.number}
                  </span>
                </div>

                <div className="shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-warm)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-warm)]">
                      {isVipUnlocked && <Unlock className="h-2.5 w-2.5 text-[var(--success)]" />}
                      Đang đọc
                    </span>
                  ) : isVipLocked ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-warm-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-warm)]">
                      <Coins className="h-2.5 w-2.5" />
                      {ch.priceCoins}
                    </span>
                  ) : isVipUnlocked ? (
                    <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                      Đã mở
                    </span>
                  ) : ch.publishedAt ? (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatCompactDate(ch.publishedAt)}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          {paginatedChapters.map((ch) => {
            const { isCurrent, isRead, isUnlocked } = getChapterState(ch);
            const isVipLocked = ch.isPremium && ch.priceCoins > 0 && !isUnlocked;

            return (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                prefetch={false}
                className={`group flex items-center justify-between gap-3 px-3.5 py-3 text-sm transition-colors sm:px-4 ${
                  isCurrent
                    ? 'bg-[var(--accent-warm-soft)]/60 hover:bg-[var(--accent-warm-soft)]'
                    : isRead
                      ? 'opacity-75 hover:opacity-100 hover:bg-[var(--bg-subtle)]/60'
                      : 'hover:bg-[var(--bg-subtle)]/70'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {isCurrent ? (
                    <Bookmark className="h-3.5 w-3.5 shrink-0 fill-current text-[var(--accent-warm)]" />
                  ) : isRead ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  ) : null}

                  <span
                    className={`shrink-0 ${
                      isCurrent
                        ? 'font-bold text-[var(--accent-warm)]'
                        : isRead
                          ? 'font-medium text-[var(--text-secondary)]'
                          : 'font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    Chương {ch.number}
                  </span>

                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-[var(--accent-warm)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-warm)]">
                      Đang đọc
                    </span>
                  )}

                  {!isCurrent && isRead && (
                    <span className="hidden xs:inline-block sm:inline-block shrink-0 rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                      Đã đọc
                    </span>
                  )}

                  {ch.title && (
                    <span className="truncate text-xs sm:text-sm text-[var(--text-secondary)]">
                      {ch.title}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  {ch.isPremium && ch.priceCoins > 0 && (
                    isVipLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-warm-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-warm)]">
                        <Lock className="h-3 w-3" />
                        {ch.priceCoins} Xu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                        <Unlock className="h-3 w-3" />
                        Đã mở
                      </span>
                    )
                  )}

                  {ch.publishedAt && (
                    <span className="hidden sm:inline text-xs text-[var(--text-muted)]">
                      {formatCompactDate(ch.publishedAt)}
                    </span>
                  )}

                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-primary)]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
