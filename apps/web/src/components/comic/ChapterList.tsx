'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useReadingHistoryStore } from '@/stores/reading-history-store';

export interface ChapterItem {
  id: string;
  number: string;
  title: string | null;
  totalPages?: number;
  publishedAt: string | null;
}

export interface ChapterListProps {
  chapters?: ChapterItem[];
  comicStatus?: string;
  comicId?: string;
  comicSlug?: string;
  className?: string;
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ONGOING: 'Đang cập nhật',
  COMPLETED: 'Hoàn thành',
  HIATUS: 'Tạm dừng',
};

const statusColor: Record<string, string> = {
  ONGOING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  COMPLETED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  HIATUS: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  DRAFT: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400',
};

const CHAPTERS_PER_PAGE = 50;

function formatChapterDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `${diffMins} phút trước`;
    }
    if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    }
    if (diffDays < 7) {
      return `${diffDays} ngày trước`;
    }
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function ChapterList({
  chapters = [],
  comicStatus = 'ONGOING',
  comicId,
  comicSlug,
  className = '',
}: ChapterListProps) {
  // 1. Default to descending (giảm dần) so latest chapters are shown first
  const [isAsc, setIsAsc] = useState(false);
  // 2. View mode: 'grid' vs 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // 3. Range pagination index
  const [chapterPageIndex, setChapterPageIndex] = useState(0);

  // Reading history integration
  const isHydrated = useReadingHistoryStore((s) => s.isHydrated);
  const hydrate = useReadingHistoryStore((s) => s.hydrate);
  const records = useReadingHistoryStore((s) => s.records);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const readRecord = useMemo(() => {
    if (!isHydrated) return undefined;
    if (comicId && records[comicId]) return records[comicId];
    if (comicSlug) {
      return Object.values(records).find((r) => r.comicSlug === comicSlug);
    }
    return undefined;
  }, [isHydrated, records, comicId, comicSlug]);

  const getChapterReadStatus = useCallback(
    (ch: ChapterItem) => {
      if (!readRecord) return { isRead: false, isCurrent: false };

      const isCurrent =
        ch.id === readRecord.chapterId ||
        String(ch.number) === String(readRecord.chapterNumber);

      let isRead = isCurrent;
      if (!isRead && readRecord.readChapterIds && readRecord.readChapterIds.includes(ch.id)) {
        isRead = true;
      }
      if (!isRead) {
        const chNum = parseFloat(ch.number);
        const recNum = parseFloat(readRecord.chapterNumber);
        if (!isNaN(chNum) && !isNaN(recNum) && chNum <= recNum) {
          isRead = true;
        }
      }

      return { isRead, isCurrent };
    },
    [readRecord]
  );

  // Horizontal scroll state for range pagination
  const rangeContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = rangeContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // Sorted chapters
  const sortedChapters = useMemo(() => {
    if (!chapters || chapters.length === 0) return [];
    return [...chapters].sort((a, b) => {
      const numA = parseFloat(a.number) || 0;
      const numB = parseFloat(b.number) || 0;
      return isAsc ? numA - numB : numB - numA;
    });
  }, [chapters, isAsc]);

  const totalChapterPages = Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE);

  // Paginated chapters for current chunk
  const paginatedChapters = useMemo(() => {
    const start = chapterPageIndex * CHAPTERS_PER_PAGE;
    return sortedChapters.slice(start, start + CHAPTERS_PER_PAGE);
  }, [sortedChapters, chapterPageIndex]);

  // Range buttons dynamically derived from actual sorted chapters in each chunk
  const rangeButtons = useMemo(() => {
    if (totalChapterPages <= 1) return [];
    return Array.from({ length: totalChapterPages }, (_, i) => {
      const chunk = sortedChapters.slice(i * CHAPTERS_PER_PAGE, (i + 1) * CHAPTERS_PER_PAGE);
      if (chunk.length === 0) return null;
      const firstNum = chunk[0].number;
      const lastNum = chunk[chunk.length - 1].number;
      const label = firstNum === lastNum ? `Chương ${firstNum}` : `${firstNum} - ${lastNum}`;
      return { index: i, label };
    }).filter(Boolean) as { index: number; label: string }[];
  }, [sortedChapters, totalChapterPages]);

  useEffect(() => {
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, rangeButtons]);

  const scrollRange = (direction: 'left' | 'right') => {
    const el = rangeContainerRef.current;
    if (!el) return;
    const amount = Math.max(160, el.clientWidth * 0.6);
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
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
    setIsAsc((prev) => !prev);
    // Reset to first chunk of the new sort order
    setChapterPageIndex(0);
    if (rangeContainerRef.current) {
      rangeContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToLastRead = () => {
    if (!readRecord?.chapterNumber) return;
    const targetIdx = sortedChapters.findIndex(
      (c) => c.id === readRecord.chapterId || String(c.number) === String(readRecord.chapterNumber)
    );
    if (targetIdx !== -1) {
      const targetPage = Math.floor(targetIdx / CHAPTERS_PER_PAGE);
      setChapterPageIndex(targetPage);
    }
  };

  return (
    <div className={`p-4 sm:p-5 ${className}`}>
      {/* Chapter header toolbar */}
      <div className="flex flex-row justify-between gap-3 pb-4 mb-4 border-b border-zinc-100 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span><strong className="font-semibold text-zinc-800 dark:text-zinc-200">{chapters.length}</strong><i className="ms-2 fa-light fa-book-open text-amber-500"></i></span>

          {readRecord?.chapterNumber && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={handleJumpToLastRead}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer shadow-2xs"
                title="Bấm để chuyển tới dải chương này"
              >
                <i className="fa-solid fa-clock-rotate-left text-[11px] text-amber-500" />
                <span><strong>Chương {readRecord.chapterNumber}</strong></span>
              </button>
            </>
          )}
        </div>

        {/* Actions: View Mode toggle & Sort order button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View mode toggle: Grid vs List */}
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors cursor-pointer ${viewMode === 'grid'
                ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              title="Xem dạng lưới"
              aria-label="Xem dạng lưới"
            >
              <i className="fa-light fa-grid-2 text-sm" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors cursor-pointer ${viewMode === 'list'
                ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              title="Xem dạng danh sách"
              aria-label="Xem dạng danh sách"
            >
              <i className="fa-light fa-list text-sm" />
            </button>
          </div>

          {/* Sort direction toggle button */}
          {chapters.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSort}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-amber-400 dark:hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer shadow-2xs"
              title={isAsc ? 'Chuyển sang mới nhất trước' : 'Chuyển sang cũ nhất trước'}
            >
              <i className={`fa-light ${isAsc ? 'fa-arrow-up-1-9' : 'fa-arrow-down-9-1'} text-amber-500`} />
            </button>
          )}
        </div>
      </div>

      {/* Chapter range pagination horizontal scroll */}
      {rangeButtons.length > 1 && (
        <div className="relative mb-4 flex items-center gap-1.5">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollRange('left')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shadow-xs hover:text-amber-500 hover:border-amber-400 transition-colors cursor-pointer"
              title="Cuộn sang trái"
              aria-label="Cuộn sang trái"
            >
              <i className="fa-light fa-chevron-left text-xs" />
            </button>
          )}

          <div
            ref={rangeContainerRef}
            onScroll={checkScroll}
            className="flex items-center gap-2 overflow-x-auto py-1 scroll-smooth no-scrollbar flex-1"
          >
            {rangeButtons.map((btn) => (
              <button
                key={btn.index}
                type="button"
                onClick={(e) => handleSelectRange(btn.index, e)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${chapterPageIndex === btn.index
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-500/30 dark:hover:text-amber-400 bg-white/50 dark:bg-white/[0.02]'
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
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shadow-xs hover:text-amber-500 hover:border-amber-400 transition-colors cursor-pointer"
              title="Cuộn sang phải"
              aria-label="Cuộn sang phải"
            >
              <i className="fa-light fa-chevron-right text-xs" />
            </button>
          )}
        </div>
      )}

      {/* Chapter Content: Grid vs List View */}
      {paginatedChapters.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
          <i className="fa-light fa-book-open text-3xl mb-3 block text-zinc-300 dark:text-zinc-600" />
          Chưa có chương nào
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View: title hidden, update date shown ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {paginatedChapters.map((ch) => {
            const { isRead, isCurrent } = getChapterReadStatus(ch);

            return (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                className={`group relative flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-xs transition-all hover:-translate-y-0.5 shadow-2xs ${isCurrent
                  ? 'border-amber-400/80 dark:border-amber-500/50 bg-amber-50/70 dark:bg-amber-500/10 hover:border-amber-500 hover:bg-amber-100/60 dark:hover:bg-amber-500/15'
                  : isRead
                    ? 'border-zinc-200/50 dark:border-white/5 bg-zinc-100/50 dark:bg-white/[0.015] hover:border-amber-300 hover:bg-zinc-100/80 dark:hover:border-amber-500/20 dark:hover:bg-white/[0.03]'
                    : 'border-zinc-200/80 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] hover:border-amber-400/60 hover:bg-amber-50/60 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/5'
                  }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  {isCurrent ? (
                    <i className="fa-solid fa-bookmark text-amber-500 text-[10px] shrink-0" title="Chương đang đọc" />
                  ) : isRead ? (
                    <i className="fa-solid fa-check text-emerald-500 dark:text-emerald-400 text-[10px] shrink-0" title="Đã đọc" />
                  ) : null}

                  <span
                    className={`truncate font-medium transition-colors ${isCurrent
                      ? 'font-bold text-amber-700 dark:text-amber-300 group-hover:text-amber-600'
                      : isRead
                        ? 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                        : 'font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                      }`}
                  >
                    {ch.number}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isCurrent ? (
                    <span className="rounded bg-amber-200/60 dark:bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                      Đang đọc
                    </span>
                  ) : ch.publishedAt ? (
                    <span
                      className={`text-[11px] font-normal shrink-0 ${isRead ? 'text-zinc-400/70 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                    >
                      {formatChapterDate(ch.publishedAt)}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── List View: title & update date shown ── */
        <div className="divide-y divide-zinc-100 dark:divide-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] shadow-2xs">
          {paginatedChapters.map((ch) => {
            const { isRead, isCurrent } = getChapterReadStatus(ch);

            return (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                className={`group flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 transition-colors text-sm ${isCurrent
                  ? 'bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100/60 dark:hover:bg-amber-500/15'
                  : isRead
                    ? 'hover:bg-zinc-50 dark:hover:bg-white/[0.02]'
                    : 'hover:bg-amber-50/60 dark:hover:bg-amber-500/5'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrent ? (
                      <i className="fa-solid fa-bookmark text-amber-500 text-xs shrink-0" title="Chương đang đọc" />
                    ) : isRead ? (
                      <i className="fa-solid fa-check text-emerald-500 dark:text-emerald-400 text-xs shrink-0" title="Đã đọc" />
                    ) : null}

                    <span
                      className={`transition-colors shrink-0 ${isCurrent
                        ? 'font-bold text-amber-600 dark:text-amber-400'
                        : isRead
                          ? 'font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                          : 'font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                        }`}
                    >
                      Chương {ch.number}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                      Đang đọc
                    </span>
                  )}

                  {!isCurrent && isRead && (
                    <span className="rounded bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 text-[10px] font-normal shrink-0">
                      Đã đọc
                    </span>
                  )}

                  {ch.title && (
                    <span
                      className={`text-xs sm:text-sm truncate font-normal ${isCurrent
                        ? 'text-amber-800/80 dark:text-amber-200/80'
                        : isRead
                          ? 'text-zinc-400/80 dark:text-zinc-500'
                          : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                    >
                      {ch.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {ch.publishedAt && (
                    <span className="hidden xs:inline-block sm:inline-block">
                      {formatChapterDate(ch.publishedAt)}
                    </span>
                  )}
                  <i
                    className={`fa-light fa-chevron-right text-xs transition-transform group-hover:translate-x-1 ${isCurrent
                      ? 'text-amber-500'
                      : isRead
                        ? 'text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500'
                        : 'group-hover:text-amber-500'
                      }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

