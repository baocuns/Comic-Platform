'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface NewsAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  username: string;
}

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  publishedAt: string;
  author: NewsAuthor;
}

interface NewsResponse {
  data: NewsArticle[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'ANNOUNCEMENT', label: '📢 Thông báo' },
  { value: 'EVENT', label: '🎉 Sự kiện' },
  { value: 'UPDATE', label: '🔄 Cập nhật' },
  { value: 'COMMUNITY', label: '👥 Cộng đồng' },
  { value: 'FEATURED', label: '⭐ Nổi bật' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatViews(count: number) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function getCategoryInfo(cat: string) {
  const found = CATEGORIES.find((c) => c.value === cat);
  return found || { value: cat, label: cat };
}

export default function NewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category') || '';
  const currentPage = Number(searchParams.get('page')) || 1;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [featured, setFeatured] = useState<NewsArticle | null>(null);
  const [meta, setMeta] = useState<NewsResponse['meta'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (currentCategory) params.set('category', currentCategory);
    params.set('page', String(currentPage));
    params.set('limit', '9');

    api
      .get<{ data: NewsArticle[]; meta: NewsResponse['meta'] }>(`/news?${params}`)
      .then((r) => {
        setArticles(r.data);
        setMeta(r.meta);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [currentCategory, currentPage]);

  // Fetch featured for hero (only on first page with no category filter)
  useEffect(() => {
    if (currentPage === 1 && !currentCategory) {
      api
        .get<{ data: { featured: NewsArticle | null } }>('/news/featured')
        .then((r) => setFeatured(r.data.featured))
        .catch(() => {});
    } else {
      setFeatured(null);
    }
  }, [currentPage, currentCategory]);

  const handleCategoryChange = (cat: string) => {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    router.push(`/news${params.toString() ? `?${params}` : ''}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    if (currentCategory) params.set('category', currentCategory);
    if (page > 1) params.set('page', String(page));
    router.push(`/news${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/5 dark:bg-emerald-600/10 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-teal-500/5 dark:bg-teal-600/8 blur-[120px]" />
      </div>

      {/* Page Header */}
      <section className="relative mx-auto max-w-6xl px-4 pt-12 pb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-600 dark:text-emerald-300">
          <i className="fa-light fa-newspaper" />
          Tin tức
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
          Chuyện gì đang xảy ra vậy?
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 max-w-xl">
          Cập nhật tin tức mới nhất về nền tảng, sự kiện, và cộng đồng OWOC.
        </p>
      </section>

      {/* Hero Featured Article */}
      {featured && currentPage === 1 && !currentCategory && (
        <section className="mx-auto max-w-6xl px-4 pb-8">
          <Link
            href={`/news/${featured.slug}`}
            className="group relative block overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10"
          >
            <div className="aspect-[21/9] sm:aspect-[21/8] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              {featured.coverUrl ? (
                <img
                  src={featured.coverUrl}
                  alt={featured.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <i className="fa-light fa-newspaper text-6xl text-zinc-300 dark:text-zinc-600" />
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 backdrop-blur-sm px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30 mb-3">
                {getCategoryInfo(featured.category).label}
              </span>
              <h2 className="text-xl sm:text-3xl font-bold text-white leading-tight line-clamp-2 mb-2">
                {featured.title}
              </h2>
              {featured.excerpt && (
                <p className="text-sm sm:text-base text-white/70 line-clamp-2 max-w-2xl mb-4">
                  {featured.excerpt}
                </p>
              )}
              <div className="flex items-center gap-3 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-bold text-white">
                    {featured.author.avatarUrl ? (
                      <img src={featured.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      featured.author.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>{featured.author.displayName}</span>
                </div>
                <span>·</span>
                <span>{formatDate(featured.publishedAt)}</span>
                <span>·</span>
                <span><i className="fa-light fa-eye mr-1" />{formatViews(featured.viewCount)}</span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Category Filter */}
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={`rounded-full border px-4 py-1.5 text-xs transition-all cursor-pointer ${
                currentCategory === cat.value
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-medium'
                  : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Articles Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-zinc-200/60 dark:border-white/5 overflow-hidden">
                <div className="aspect-video bg-zinc-200/60 dark:bg-zinc-800/60" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-20 rounded-full bg-zinc-200/60 dark:bg-zinc-800/60" />
                  <div className="h-5 w-full rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
                  <div className="h-5 w-3/4 rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
                  <div className="h-4 w-full rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
                  <div className="h-4 w-1/2 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📰</div>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">Chưa có tin tức nào.</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">Hãy quay lại sau nhé!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/news/${article.slug}`}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:shadow-emerald-500/10"
                >
                  {/* Cover Image */}
                  <div className="aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {article.coverUrl ? (
                      <img
                        src={article.coverUrl}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                        <i className="fa-light fa-newspaper text-3xl text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    {/* Category + Pinned */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300 uppercase tracking-wider">
                        {getCategoryInfo(article.category).label}
                      </span>
                      {article.isPinned && (
                        <span className="text-amber-500 text-xs"><i className="fa-solid fa-thumbtack" /></span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white line-clamp-2 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                      {article.title}
                    </h3>

                    {/* Excerpt */}
                    {article.excerpt && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 mb-4 leading-relaxed">
                        {article.excerpt}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[8px] font-bold text-white">
                          {article.author.avatarUrl ? (
                            <img src={article.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            article.author.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">{article.author.displayName}</span>
                      </div>
                      <span>{formatDate(article.publishedAt)}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-white/5 text-xs text-zinc-400 dark:text-zinc-500">
                      <span><i className="fa-light fa-eye mr-1" />{formatViews(article.viewCount)}</span>
                      <span><i className="fa-light fa-heart mr-1" />{article.likesCount}</span>
                      <span><i className="fa-light fa-comment mr-1" />{article.commentsCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-sm text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <i className="fa-light fa-chevron-left" />
                </button>

                {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="mx-1 text-zinc-400 dark:text-zinc-600">…</span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
                          p === currentPage
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-medium'
                            : 'border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!meta.hasNext}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-sm text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <i className="fa-light fa-chevron-right" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
