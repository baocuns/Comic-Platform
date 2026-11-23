'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Clock, ArrowRight, Star, BookOpen, Trash2 } from 'lucide-react';
import type { ComicSummary } from 'shared';
import { api } from '@/lib/api-client';
import { useSearchStore } from '@/stores/search-store';
import { useAuthStore } from '@/stores/auth-store';
import { COMIC_TYPE_LABEL, formatCompactNumber } from '@/lib/format';

export function SearchModal() {
  const router = useRouter();
  const { isOpen, close, recentQueries, addRecent, clearRecent } = useSearchStore();
  const { accessToken } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComicSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useSearchStore.getState().toggle();
      } else if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: ComicSummary[] }>(
          `/comics/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setResults(res.data || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addRecent(trimmed);
    if (accessToken) {
      api.post('/comics/search/record', { query: trimmed }, { token: accessToken }).catch(() => {});
    }
    close();
    router.push(`/comics?search=${encodeURIComponent(trimmed)}`);
  };

  const handleQuickQuery = (q: string) => {
    setQuery(q);
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center bg-black/55 px-4 pt-16 sm:pt-24 backdrop-blur-sm animate-fade-in"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl animate-slide-up"
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5"
        >
          <Search className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm truyện, tác giả, từ khóa (hỗ trợ không dấu)..."
            className="w-full bg-transparent text-sm sm:text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            ESC
          </kbd>
        </form>

        <div className="max-h-[62vh] overflow-y-auto p-4">
          {query.trim().length < 2 ? (
            <div className="space-y-5">
              {recentQueries.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Tìm kiếm gần đây
                    </span>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Xóa
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentQueries.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleQuickQuery(q)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] cursor-pointer transition-colors"
                      >
                        <Clock className="h-3 w-3" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Lối tắt khám phá
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { label: 'Thịnh hành tuần', href: '/rankings?period=week' },
                    { label: 'Truyện Tu Tiên', href: '/comics?genre=tu-tien' },
                    { label: 'Truyện Việt gốc', href: '/comics?type=VIETNAM' },
                    { label: 'Đánh giá cao nhất', href: '/comics?sort=rating' },
                    { label: 'Đã hoàn thành', href: '/comics?status=COMPLETED' },
                    { label: 'Cổng Tu Luyện', href: '/cultivation' },
                  ].map((shortcut) => (
                    <Link
                      key={shortcut.href}
                      href={shortcut.href}
                      onClick={close}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                    >
                      <span>{shortcut.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">Đang tìm kiếm...</div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Thử từ khóa ngắn hơn hoặc tìm theo thể loại trong trang Khám phá.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.slice(0, 8).map((comic) => (
                <Link
                  key={comic.id}
                  href={`/comics/${comic.slug}`}
                  onClick={() => {
                    addRecent(query.trim());
                    close();
                  }}
                  className="flex items-center gap-3.5 rounded-xl p-2 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                    {comic.coverUrl ? (
                      <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                        {comic.title[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{comic.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
                      {comic.author?.displayName} · {COMIC_TYPE_LABEL[comic.type] || comic.type}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {comic.stats.totalChapters} chương
                      </span>
                      {comic.stats.avgRating > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--warning)] font-medium">
                          <Star className="h-3 w-3 fill-current" />
                          {comic.stats.avgRating.toFixed(1)}
                        </span>
                      )}
                      <span>{formatCompactNumber(comic.stats.totalViews)} lượt xem</span>
                    </div>
                  </div>
                </Link>
              ))}
              <button
                type="button"
                onClick={handleSubmit}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary-soft)] py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors cursor-pointer"
              >
                <span>Xem toàn bộ kết quả cho &ldquo;{query.trim()}&rdquo;</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
