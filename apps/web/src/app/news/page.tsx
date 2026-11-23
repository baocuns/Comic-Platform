'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, Clock, Eye, Heart, Search } from 'lucide-react';
import { NewsCategory, type NewsItem, type PaginationMeta } from 'shared';
import { api } from '@/lib/api-client';
import { NEWS_CATEGORY_LABEL, formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (category) params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);

    api
      .get<{ data: NewsItem[]; meta: PaginationMeta }>(`/news?${params.toString()}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setArticles(res.data || []);
          setMeta(res.meta || null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setArticles([]);
          setMeta(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, category, debouncedSearch]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-1">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
          <Newspaper className="h-4 w-4" />
          Tạp Chí Biên Tập
        </p>
        <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Tin Tức & Sự Kiện</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Cập nhật nền tảng, phỏng vấn tác giả và những chuyên mục tuyển chọn hàng tuần.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCategory('');
              setPage(1);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
              category === ''
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            Tất cả
          </button>
          {Object.values(NewsCategory).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                category === cat
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {NEWS_CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm bài viết..."
            className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Card className="py-12 text-center text-sm text-[var(--text-muted)]">
          Chưa có bài viết nào trong chuyên mục này.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link key={article.id} href={`/news/${article.slug}`} className="group">
              <Card padded={false} interactive className="flex h-full flex-col overflow-hidden">
                <div className="aspect-video w-full overflow-hidden bg-[var(--bg-subtle)]">
                  {article.coverUrl && (
                    <img
                      src={article.coverUrl}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-warm)]">
                      {NEWS_CATEGORY_LABEL[article.category]}
                    </span>
                    <h2 className="mt-1 font-serif text-lg font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] line-clamp-2">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="mt-1.5 text-xs text-[var(--text-secondary)] line-clamp-2">
                        {article.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(article.publishedAt)} · {article.readTimeMinutes}p đọc
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {article.viewCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {article.likesCount}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
    </div>
  );
}
