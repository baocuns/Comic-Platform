'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { CommentSection } from '@/components/comments';

interface Comic {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  status: string;
  contentRating: string;
  author: { id: string; displayName: string; avatarUrl: string | null; username: string };
  genres: { id: string; name: string; slug: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number; totalRatings: number; totalBookmarks: number; totalChapters: number };
  chapters?: { id: string; number: string; title: string | null; totalPages: number; publishedAt: string | null }[];
}

interface CommentUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  username: string;
}

interface ComicComment {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  chapter?: { number: string; title: string | null };
  replies?: ComicComment[];
  _count?: { replies: number };
}

interface RatingItem {
  id: string;
  score: number;
  review: string | null;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null; username: string };
}

const statusLabel: Record<string, string> = { DRAFT: 'Nháp', ONGOING: 'Đang ra', COMPLETED: 'Hoàn thành', HIATUS: 'Tạm dừng' };
const statusColor: Record<string, string> = { ONGOING: 'bg-emerald-500/20 text-emerald-300', COMPLETED: 'bg-violet-500/20 text-violet-300', HIATUS: 'bg-amber-500/20 text-amber-300', DRAFT: 'bg-zinc-500/20 text-zinc-300' };

export default function ComicDetailPage() {
  const params = useParams();
  const { user, accessToken } = useAuthStore();
  const [comic, setComic] = useState<Comic | null>(null);
  const [loading, setLoading] = useState(true);

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState(false);

  // Rating state
  const [myScore, setMyScore] = useState(0);
  const [myReview, setMyReview] = useState('');
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [showRatingForm, setShowRatingForm] = useState(false);

  // Comment state
  const [comicComments, setComicComments] = useState<ComicComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  useEffect(() => {
    if (!params.slug) return;
    api.get<{ data: Comic }>(`/comics/${params.slug}`)
      .then((res) => setComic(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [params.slug]);

  // Load bookmark status, ratings, and comments when comic loads
  useEffect(() => {
    if (!comic) return;

    // Load ratings (public)
    api.get<{ data: RatingItem[] }>(`/ratings/comics/${comic.id}`)
      .then((r) => setRatings(r.data))
      .catch(() => { });

    // Load comments (public, page 1)
    api.get<{ data: ComicComment[]; meta: { total: number; hasNext: boolean } }>(`/comments/comic/${comic.id}?page=1`)
      .then((r) => {
        setComicComments(r.data);
        setCommentHasNext(r.meta.hasNext);
        setCommentTotal(r.meta.total);
        setCommentPage(1);
      })
      .catch(() => { });

    if (!accessToken) return;

    // Check bookmark
    api.get<{ data: { bookmarked: boolean } }>(`/bookmarks/check/${comic.id}`, { token: accessToken })
      .then((r) => setIsBookmarked(r.data.bookmarked))
      .catch(() => { });

    // Check my rating
    api.get<{ data: RatingItem | null }>(`/ratings/comics/${comic.id}/mine`, { token: accessToken })
      .then((r) => {
        if (r.data) {
          setMyScore(r.data.score);
          setMyReview(r.data.review || '');
          setHasRated(true);
        }
      })
      .catch(() => { });
  }, [comic, accessToken]);

  const toggleBookmark = async () => {
    if (!accessToken || !comic || togglingBookmark) return;
    setTogglingBookmark(true);
    try {
      const res = await api.post<{ data: { bookmarked: boolean } }>(`/bookmarks/toggle/${comic.id}`, {}, { token: accessToken });
      setIsBookmarked(res.data.bookmarked);
      setComic((prev) => prev ? {
        ...prev,
        stats: { ...prev.stats, totalBookmarks: prev.stats.totalBookmarks + (res.data.bookmarked ? 1 : -1) },
      } : prev);
    } catch { }
    setTogglingBookmark(false);
  };

  const submitRating = async () => {
    if (!accessToken || !comic || myScore === 0 || submittingRating) return;
    setSubmittingRating(true);
    try {
      const res = await api.post<{ data: RatingItem }>(`/ratings/comics/${comic.id}`, { score: myScore, review: myReview || undefined }, { token: accessToken });
      setHasRated(true);
      setShowRatingForm(false);

      // Refresh ratings list
      const ratingsRes = await api.get<{ data: RatingItem[] }>(`/ratings/comics/${comic.id}`);
      setRatings(ratingsRes.data);

      // Refresh comic to get new avg
      const comicRes = await api.get<{ data: Comic }>(`/comics/${params.slug}`);
      setComic(comicRes.data);
    } catch { }
    setSubmittingRating(false);
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>;
  if (!comic) return <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">Truyện không tồn tại</div>;

  return (
    <>
      {/* Banner */}
      <div className="relative -mt-16 h-64 overflow-hidden sm:h-80 z-10">
        {comic.bannerUrl ? (
          <>
            <img
              src={comic.bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-white dark:to-[#0a0a0a]" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-indigo-600/10" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-[#0a0a0a] to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 relative z-20">
        {/* Hero */}
        <div className="relative mb-8 -mt-36 overflow-hidden sm:-mt-48">
          <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
            {/* Cover */}
            <div className="mx-auto h-72 w-48 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 shadow-2xl sm:mx-0">
              {comic.coverUrl ? (
                <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
              )}
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[comic.status] || statusColor.DRAFT}`}>
                  {statusLabel[comic.status] || comic.status}
                </span>
                <span className="text-xs text-zinc-500">{comic.contentRating}</span>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">{comic.title}</h1>
              <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                bởi <Link href={`/@${comic.author.username}`} className="text-violet-600 dark:text-violet-400 hover:underline">{comic.author.displayName}</Link>
              </p>

              {/* Genres */}
              <div className="mb-4 flex flex-wrap gap-2">
                {comic.genres.map((g) => (
                  <span key={g.id} className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {g.icon} {g.name}
                  </span>
                ))}
              </div>

              {/* Stats + Bookmark */}
              <div className="mt-auto flex items-center gap-3">
                <div className="flex-1 grid grid-cols-4 gap-4 rounded-xl bg-zinc-100/50 dark:bg-white/[0.03] p-3">
                  <StatItem icon="👁️" value={comic.stats.totalViews} label="Lượt đọc" />
                  <StatItem icon="⭐" value={comic.stats.avgRating.toFixed(1)} label="Đánh giá" />
                  <StatItem icon="📖" value={comic.stats.totalChapters} label="Chương" />
                  <StatItem icon="🔖" value={comic.stats.totalBookmarks} label="Theo dõi" />
                </div>

                {/* Bookmark Button */}
                {user && (
                  <button
                    onClick={toggleBookmark}
                    disabled={togglingBookmark}
                    className={`flex h-full flex-col items-center justify-center rounded-xl px-4 py-3 text-sm transition-all ${isBookmarked
                      ? 'bg-violet-600/20 text-violet-600 dark:text-violet-300 border border-violet-500/30'
                      : 'bg-zinc-100/50 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-300'
                      }`}
                  >
                    <span className="text-lg">{isBookmarked ? '🔖' : '📑'}</span>
                    <span className="mt-0.5 text-[10px]">{isBookmarked ? 'Đã lưu' : 'Lưu'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {comic.description && (
          <div className="mb-8 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white">Giới thiệu</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{comic.description}</p>
          </div>
        )}

        {/* Rating Section */}
        <div className="mb-8 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              ⭐ Đánh giá ({comic.stats.totalRatings})
              {comic.stats.avgRating > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  Trung bình: <span className="text-amber-500 dark:text-amber-400 font-medium">{comic.stats.avgRating.toFixed(1)}/5</span>
                </span>
              )}
            </h2>
            {user && !hasRated && !showRatingForm && (
              <button
                onClick={() => setShowRatingForm(true)}
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
              >
                ⭐ Đánh giá
              </button>
            )}
            {user && hasRated && !showRatingForm && (
              <span className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-sm text-emerald-300">
                ✅ Bạn đã đánh giá {myScore}/5
              </span>
            )}
          </div>

          {/* Rating Form */}
          {showRatingForm && user && (
            <div className="mb-6 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="mb-3 text-sm text-zinc-300">{hasRated ? 'Cập nhật đánh giá của bạn' : 'Đánh giá truyện này'}</p>

              {/* Star selector */}
              <div className="mb-3 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverStar(star)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => setMyScore(star)}
                    className="text-2xl transition-transform hover:scale-125"
                  >
                    {star <= (hoverStar || myScore) ? '⭐' : '☆'}
                  </button>
                ))}
                {myScore > 0 && <span className="ml-2 text-sm text-zinc-400">{myScore}/5</span>}
              </div>

              {/* Review textarea */}
              <textarea
                value={myReview}
                onChange={(e) => setMyReview(e.target.value)}
                placeholder="Viết nhận xét (tùy chọn)..."
                rows={3}
                className="mb-3 w-full resize-none rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />

              <div className="flex gap-2">
                <button
                  onClick={submitRating}
                  disabled={myScore === 0 || submittingRating}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submittingRating ? 'Đang gửi...' : hasRated ? 'Cập nhật' : 'Gửi đánh giá'}
                </button>
                <button onClick={() => setShowRatingForm(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Ratings list */}
          {ratings.length > 0 ? (
            <div className="space-y-3">
              {ratings.map((r) => (
                <div key={r.id} className="rounded-lg border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/@${r.user.username}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-600 dark:text-violet-300 transition-opacity hover:opacity-85"
                    >
                      {r.user.avatarUrl ? (
                        <img src={r.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        r.user.displayName[0]
                      )}
                    </Link>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/@${r.user.username}`}
                          className="text-sm font-medium text-zinc-800 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 hover:underline transition-colors"
                        >
                          {r.user.displayName}
                        </Link>
                        <span className="text-xs text-amber-400">{'⭐'.repeat(r.score)}</span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-600">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  {r.review && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{r.review}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Chưa có đánh giá nào.</p>
          )}
        </div>

        {/* Chapter List */}
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Danh sách chương ({comic.chapters?.length || 0})
          </h2>
          {comic.chapters && comic.chapters.length > 0 ? (
            <div className="space-y-2">
              {comic.chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/read/${ch.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-white/5 bg-white dark:bg-white/[0.02] px-4 py-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-800 dark:text-white">Chương {ch.number}</span>
                    {ch.title && <span className="text-sm text-zinc-500 dark:text-zinc-400">— {ch.title}</span>}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-600">
                    {ch.publishedAt ? new Date(ch.publishedAt).toLocaleDateString('vi-VN') : 'Chưa phát hành'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Chưa có chương nào</p>
          )}
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <CommentSection
            comments={comicComments}
            totalCount={commentTotal}
            readOnly
            readOnlyMessage="Bình luận được hiển thị từ tất cả các chương. Để gửi bình luận, hãy chọn đọc một chương bất kỳ bên trên."
            hasNext={commentHasNext}
            isLoadingMore={loadingMoreComments}
            onLoadMore={async () => {
              if (!comic || loadingMoreComments) return;
              setLoadingMoreComments(true);
              const nextPage = commentPage + 1;
              try {
                const r = await api.get<{ data: ComicComment[]; meta: { hasNext: boolean } }>(`/comments/comic/${comic.id}?page=${nextPage}`);
                setComicComments((prev) => [...prev, ...r.data]);
                setCommentHasNext(r.meta.hasNext);
                setCommentPage(nextPage);
              } catch { }
              setLoadingMoreComments(false);
            }}
          />
        </div>
      </div>
    </>
  );
}

function StatItem({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-sm">{icon}</div>
      <div className="text-sm font-semibold text-zinc-900 dark:text-white">{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}
