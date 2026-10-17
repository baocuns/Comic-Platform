'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface Comic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  author: { displayName: string };
  genres: { id: string; name: string; slug: string; icon: string | null }[];
  stats: {
    totalViews: number;
    avgRating: number;
    totalRatings: number;
    totalBookmarks: number;
    totalChapters: number;
    totalComments: number;
  };
}

import { useSearchStore } from '@/stores/search-store';
import { useAuthStore } from '@/stores/auth-store';
import { trackSearch, trackComicView, getRecentSearches, clearRecentSearches } from '@/lib/recommendation-tracker';

export function SearchModal() {
  const { isOpen, close: onClose } = useSearchStore();
  const { accessToken } = useAuthStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input and load recent searches when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Debounce input value
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    let active = true;

    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    api.get<{ data: Comic[] }>(`/comics/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (active) {
          setResults(res.data || []);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Search error:', err);
          setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-[#0a0a0a]/85 backdrop-blur-md px-4 pt-[12vh] pb-4 overflow-y-auto animate-fade-in"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-white/10 px-4 py-3.5">
          <i className="fa-light fa-magnifying-glass text-zinc-400 text-lg mr-3 flex-shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm truyện tranh, tác giả, thể loại..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-base pr-12"
          />

          <div className="absolute right-4 flex items-center gap-2">
            {/* Loading Indicator */}
            {loading && (
              <svg className="animate-spin h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}

            {/* Clear Button */}
            {!loading && query && (
              <button
                onClick={handleClear}
                className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Xóa tìm kiếm"
              >
                <i className="fa-light fa-xmark text-sm" />
              </button>
            )}

            {/* Close ESC Badge */}
            <span className="hidden sm:inline-block rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 select-none">
              ESC
            </span>
          </div>
        </div>

        {/* Recent searches section (when query is empty) */}
        {!query.trim() && recentSearches.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-light fa-clock-rotate-left text-xs" />
                Tìm kiếm gần đây
              </span>
              <button
                onClick={() => {
                  clearRecentSearches();
                  setRecentSearches([]);
                }}
                className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
              >
                Xóa lịch sử
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(term)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <i className="fa-light fa-magnifying-glass text-[10px] text-zinc-500" />
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results / Empty / Error Section */}
        {query.trim().length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-white/5">
            {loading && results.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Đang tìm kiếm...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-sm text-red-400">
                <i className="fa-light fa-circle-exclamation mr-2" />
                {error}
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Kết quả tìm kiếm ({results.length})
                </div>

                {results.map((comic) => (
                  <Link
                    key={comic.id}
                    href={`/comics/${comic.slug}`}
                    onClick={() => {
                      trackSearch(query, accessToken || undefined);
                      trackComicView(comic);
                      onClose();
                    }}
                    className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
                  >
                    {/* Cover image */}
                    <div className="w-12 aspect-[3/4] overflow-hidden rounded-lg bg-zinc-800 border border-white/10 flex-shrink-0">
                      {comic.coverUrl ? (
                        <img
                          src={comic.coverUrl}
                          alt={comic.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-zinc-600 text-sm">
                          {comic.title[0]}
                        </div>
                      )}
                    </div>

                    {/* Comic details */}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-zinc-200 group-hover:text-amber-400 transition-colors line-clamp-1">
                        {comic.title}
                      </div>

                      <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <span>Tác giả: {comic.author?.displayName || 'Ẩn danh'}</span>
                        {comic.status === 'COMPLETED' && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-emerald-400 font-medium">Hoàn thành</span>
                          </>
                        )}
                      </div>

                      {/* Stats & Genres */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
                        <div className="flex items-center gap-2.5 text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <i className="fa-light fa-book-open text-[10px]" />
                            {comic.stats?.totalChapters || 0} chương
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="fa-light fa-eye text-[10px]" />
                            {comic.stats?.totalViews?.toLocaleString('vi-VN') || 0}
                          </span>
                          {comic.stats?.avgRating > 0 && (
                            <span className="flex items-center gap-1 text-amber-500 font-medium">
                              ★ {comic.stats.avgRating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Genres */}
                        {comic.genres && comic.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {comic.genres.slice(0, 3).map((g) => (
                              <span
                                key={g.id}
                                className="px-1.5 py-0.5 rounded-full text-[9px] bg-white/5 border border-white/5 text-zinc-400"
                              >
                                {g.icon} {g.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow action */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex-shrink-0 text-zinc-500 group-hover:text-amber-400">
                      <i className="fa-light fa-chevron-right text-sm" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              // Query is non-empty but 0 results
              <div className="p-10 text-center text-sm text-zinc-500">
                <i className="fa-light fa-magnifying-glass-minus text-2xl mb-2.5 block text-zinc-600" />
                Không tìm thấy truyện nào phù hợp với từ khóa &ldquo;<span className="text-zinc-300 font-medium">{debouncedQuery}</span>&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Help footer */}
        <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex justify-between items-center text-[10px] text-zinc-600 select-none">
          <span>Tìm kiếm bất cứ truyện nào bạn muốn</span>
          <span className="hidden sm:inline">Nhấn <kbd className="text-zinc-500 font-mono">Esc</kbd> để đóng</span>
        </div>
      </div>
    </div>
  );
}
