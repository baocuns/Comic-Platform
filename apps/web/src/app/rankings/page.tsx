'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Eye, Star, Bookmark, Sparkles } from 'lucide-react';
import type { ComicSummary } from 'shared';
import { ComicType } from 'shared';
import { api } from '@/lib/api-client';
import { COMIC_TYPE_LABEL, formatCompactNumber } from '@/lib/format';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface RankedComic extends ComicSummary {
  rank: number;
}

const VALID_PERIODS = ['day', 'week', 'month', 'all'] as const;
const VALID_METRICS = ['views', 'rating', 'bookmarks', 'newest'] as const;

export default function RankingsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [metric, setMetric] = useState<'views' | 'rating' | 'bookmarks' | 'newest'>('views');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [urlReady, setUrlReady] = useState(false);
  const [items, setItems] = useState<RankedComic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get('period');
    const m = sp.get('metric');
    const t = sp.get('type');
    if (p && (VALID_PERIODS as readonly string[]).includes(p)) {
      setPeriod(p as (typeof VALID_PERIODS)[number]);
    }
    if (m && (VALID_METRICS as readonly string[]).includes(m)) {
      setMetric(m as (typeof VALID_METRICS)[number]);
    }
    if (t && (Object.values(ComicType) as string[]).includes(t)) {
      setTypeFilter(t);
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ period, metric, limit: '20' });
    if (typeFilter) params.set('type', typeFilter);

    const urlParams = new URLSearchParams();
    if (metric !== 'views') urlParams.set('metric', metric);
    if (period !== 'week') urlParams.set('period', period);
    if (typeFilter) urlParams.set('type', typeFilter);
    const qs = urlParams.toString();
    router.replace(qs ? `/rankings?${qs}` : '/rankings', { scroll: false });

    api
      .get<{ data: RankedComic[] }>(`/comics/rankings?${params.toString()}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!controller.signal.aborted) setItems(res.data || []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [period, metric, typeFilter, urlReady, router]);

  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-warm)]">
          <Trophy className="h-4 w-4" />
          Bảng Vàng Tác Phẩm
        </p>
        <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Bảng Xếp Hạng Truyện Tranh</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Cập nhật liên tục theo lượt đọc thực tế, điểm đánh giá cộng đồng và lượt yêu thích.
        </p>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={metric}
          onChange={setMetric}
          items={[
            { value: 'views', label: 'Lượt xem', icon: <Eye className="h-3.5 w-3.5" /> },
            { value: 'rating', label: 'Đánh giá cao', icon: <Star className="h-3.5 w-3.5" /> },
            { value: 'bookmarks', label: 'Yêu thích', icon: <Bookmark className="h-3.5 w-3.5" /> },
            { value: 'newest', label: 'Mới nổi', icon: <Sparkles className="h-3.5 w-3.5" /> },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          {metric === 'views' && (
            <Tabs
              value={period}
              onChange={setPeriod}
              items={[
                { value: 'day', label: 'Ngày' },
                { value: 'week', label: 'Tuần' },
                { value: 'month', label: 'Tháng' },
                { value: 'all', label: 'Tất cả' },
              ]}
            />
          )}

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)]"
          >
            <option value="">Tất cả định dạng</option>
            {Object.values(ComicType).map((t) => (
              <option key={t} value={t}>
                {COMIC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-60 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {top3.map((comic, idx) => (
              <Link key={comic.id} href={`/comics/${comic.slug}`} className="group">
                <Card
                  interactive
                  className={`relative h-full overflow-hidden ${
                    idx === 0
                      ? 'border-[var(--accent-warm)]/40 bg-gradient-to-br from-[var(--accent-warm-soft)]/50 to-[var(--bg-surface)]'
                      : ''
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="relative h-36 w-26 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                      {comic.coverUrl && (
                        <img
                          src={comic.coverUrl}
                          alt={comic.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      <span
                        className={`absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white shadow-md ${
                          idx === 0
                            ? 'bg-[var(--accent-warm)]'
                            : idx === 1
                              ? 'bg-[var(--accent-primary)]'
                              : 'bg-amber-600'
                        }`}
                      >
                        #{comic.rank}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                          {COMIC_TYPE_LABEL[comic.type]}
                        </span>
                        <h3 className="mt-1 line-clamp-2 text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                          {comic.title}
                        </h3>
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                          {comic.author?.displayName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {formatCompactNumber(comic.stats.totalViews)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[var(--warning)] font-semibold">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {comic.stats.avgRating.toFixed(1)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="h-3.5 w-3.5" />
                          {formatCompactNumber(comic.stats.totalBookmarks)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Remaining List */}
          {rest.length > 0 && (
            <Card padded={false} className="overflow-hidden divide-y divide-[var(--border-subtle)]">
              {rest.map((comic) => (
                <Link
                  key={comic.id}
                  href={`/comics/${comic.slug}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--bg-subtle)]/60"
                >
                  <span className="w-8 text-center text-sm font-bold text-[var(--text-muted)]">
                    #{comic.rank}
                  </span>
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
                    {comic.coverUrl && (
                      <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-[var(--text-primary)]">{comic.title}</h4>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                      {comic.author?.displayName} · {comic.genres.slice(0, 3).map((g) => g.name).join(', ')}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-xs font-medium text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      {formatCompactNumber(comic.stats.totalViews)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[var(--warning)] font-semibold">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {comic.stats.avgRating.toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bookmark className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      {formatCompactNumber(comic.stats.totalBookmarks)}
                    </span>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
