'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { CommentSection, CommentData } from '@/components/comments';
import { ChapterList } from '@/components/comic';
import { trackComicView, getGuestRecentGenres } from '@/lib/recommendation-tracker';

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

interface RelatedComic {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  genres: { id: string; name: string; slug: string; icon: string | null }[];
  stats: { totalViews: number; avgRating: number };
  recommendReason?: string;
}

interface RatingItem {
  id: string;
  score: number;
  review: string | null;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null; username: string };
}

const statusLabel: Record<string, string> = { DRAFT: 'NHÁP', ONGOING: 'ĐANG RA', COMPLETED: 'HOÀN THÀNH', HIATUS: 'TẠM DỪNG' };
const statusColor: Record<string, string> = {
  ONGOING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  COMPLETED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  HIATUS: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  DRAFT: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400',
};

export default function ComicDetailPage() {
  const params = useParams();
  const { user, accessToken } = useAuthStore();
  const [comic, setComic] = useState<Comic | null>(null);
  const [loading, setLoading] = useState(true);

  // Description expand
  const [descExpanded, setDescExpanded] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'chapters' | 'ratings'>('chapters');

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
  const [comicComments, setComicComments] = useState<CommentData[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  // Related comics
  const [relatedComics, setRelatedComics] = useState<RelatedComic[]>([]);
  const [recommendReason, setRecommendReason] = useState<string>('Có thể bạn thích');

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

    // Track comic view for recommendation affinity
    trackComicView(comic);

    // Load personalized recommendations
    const guestGenres = getGuestRecentGenres();
    const queryParams = new URLSearchParams({
      comicId: comic.id,
      limit: '5',
      ...(guestGenres.length > 0 && { genres: guestGenres.join(',') }),
    });

    api.get<{ data: RelatedComic[]; reason?: string }>(
      `/comics/recommendations?${queryParams.toString()}`,
      accessToken ? { token: accessToken } : undefined,
    )
      .then((r) => {
        if (r.data) {
          setRelatedComics(r.data.filter((c) => c.id !== comic.id).slice(0, 5));
          if (r.reason) setRecommendReason(r.reason);
        }
      })
      .catch(() => {
        // Fallback: load popular from same genre
        if (comic.genres.length > 0) {
          const genreSlug = comic.genres[0].slug;
          api.get<{ data: RelatedComic[] }>(`/comics?genre=${genreSlug}&limit=5&sort=popular`)
            .then((r) => {
              setRelatedComics(r.data.filter((c) => c.id !== comic.id).slice(0, 5));
            })
            .catch(() => { });
        }
      });

    // Load comments (public, page 1)
    setLoadingComments(true);
    api.get<{ data: CommentData[]; meta: { total: number; hasNext: boolean } }>(`/comments/comic/${comic.id}?page=1`)
      .then((r) => {
        setComicComments(r.data);
        setCommentHasNext(r.meta.hasNext);
        setCommentTotal(r.meta.total);
        setCommentPage(1);
      })
      .catch(() => { })
      .finally(() => setLoadingComments(false));

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

  const handleLoadMoreComments = async () => {
    if (!comic || loadingMoreComments || !commentHasNext) return;
    setLoadingMoreComments(true);
    try {
      const nextPage = commentPage + 1;
      const r = await api.get<{ data: CommentData[]; meta: { total: number; hasNext: boolean } }>(
        `/comments/comic/${comic.id}?page=${nextPage}`
      );
      setComicComments((prev) => [...prev, ...r.data]);
      setCommentHasNext(r.meta.hasNext);
      setCommentTotal(r.meta.total);
      setCommentPage(nextPage);
    } catch { }
    setLoadingMoreComments(false);
  };

  const handleDeleteComment = async (commentId: string, parentId?: string | null) => {
    if (!accessToken || !confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    try {
      await api.delete(`/comments/${commentId}`, { token: accessToken });
      if (parentId) {
        setComicComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? {
                  ...c,
                  replies: c.replies?.filter((r) => r.id !== commentId),
                  _count: c._count ? { replies: Math.max(0, c._count.replies - 1) } : undefined,
                }
              : c
          )
        );
      } else {
        setComicComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentTotal((prev) => Math.max(0, prev - 1));
      }
    } catch { }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-500" />
    </div>
  );
  if (!comic) return <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">Truyện không tồn tại</div>;

  const firstChapter = comic.chapters && comic.chapters.length > 0
    ? [...comic.chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number))[0]
    : null;

  const descriptionTruncated = comic.description && comic.description.length > 200;
  const displayDescription = descExpanded ? comic.description : comic.description?.slice(0, 200);

  return (
    <>
      {/* Banner */}
      <div className="relative h-56 overflow-hidden sm:h-72 z-10">
        {comic.bannerUrl || comic.coverUrl ? (
          <>
            <img
              src={comic.bannerUrl || comic.coverUrl!}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#0a0a0a] dark:via-[#0a0a0a]/40 dark:to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-amber-200/40 via-orange-100/20 to-yellow-100/30 dark:from-amber-900/20 dark:via-amber-800/10 dark:to-amber-700/5" />
        )}
      </div>

      <div className="px-4 sm:px-8 md:px-12 lg:px-16 relative z-20">
        {/* ═══ Hero Section ═══ */}
        <div className="relative -mt-28 sm:-mt-36 mb-8">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            {/* Cover Image */}
            <div className="mx-auto sm:mx-0 flex-shrink-0">
              <div className="h-56 w-40 sm:h-64 sm:w-44 overflow-hidden rounded-xl shadow-xl shadow-amber-900/10 dark:shadow-black/30 bg-zinc-100 dark:bg-zinc-800">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
                )}
              </div>
            </div>

            {/* Info Area */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-16">
              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-1.5 leading-tight">{comic.title}</h1>

              {/* Author */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                <Link href={`/@${comic.author.username}`} className="text-amber-600 dark:text-amber-400 hover:underline transition-colors">{comic.author.displayName}</Link>
              </p>

              {/* Micro Stats Row */}
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-eye text-amber-500/70"></i>
                  <span>{comic.stats.totalViews.toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-star text-amber-500"></i>
                  <span>{comic.stats.avgRating.toFixed(1)}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-thumbs-up text-amber-500/70"></i>
                  <span>{comic.stats.totalRatings}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-share-nodes text-amber-500/70"></i>
                  <span>{comic.stats.totalBookmarks}</span>
                </span>
              </div>

              {/* Description inline */}
              {comic.description && (
                <div className="mb-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {displayDescription}
                    {descriptionTruncated && !descExpanded && '...'}
                  </p>
                  {descriptionTruncated && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {descExpanded ? 'Thu gọn' : 'Xem thêm'}
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {firstChapter && (
                  <Link
                    href={`/read/${firstChapter.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition-all hover:shadow-lg hover:shadow-amber-500/30 hover:brightness-110 active:scale-[0.97]"
                  >
                    <i className="fa-solid fa-book-open text-xs"></i>
                    <span>Đọc từ đầu</span>
                  </Link>
                )}

                {/* Bookmark Button */}
                {user && (
                  <button
                    onClick={toggleBookmark}
                    disabled={togglingBookmark}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97] cursor-pointer border ${isBookmarked
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-amber-300 hover:text-amber-600 dark:bg-white/5 dark:text-zinc-400 dark:border-white/10 dark:hover:border-amber-500/30 dark:hover:text-amber-400'
                      }`}
                  >
                    <i className={`fa-${isBookmarked ? 'solid' : 'regular'} fa-heart text-xs`}></i>
                    <span>{isBookmarked ? 'Đã theo dõi' : 'Theo dõi'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Main Content Layout ═══ */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          {/* Left: Tabs Area */}
          <div className="flex-1 min-w-0">
            {/* Tab Header */}
            <div className="flex items-center rounded-t-xl border border-zinc-200 dark:border-white/10 mb-0">
              <button
                onClick={() => setActiveTab('chapters')}
                className={`relative px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${activeTab === 'chapters'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-list"></i>
                  Danh sách chương
                </span>
                {activeTab === 'chapters' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('ratings')}
                className={`relative px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${activeTab === 'ratings'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-star"></i>
                  Đánh giá ({comic.stats.totalRatings})
                </span>
                {activeTab === 'ratings' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="rounded-b-xl border border-t-0 border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/60 mb-6">
              {/* ── Chapters Tab ── */}
              {activeTab === 'chapters' && (
                <ChapterList
                  chapters={comic.chapters}
                  comicStatus={comic.status}
                  comicId={comic.id}
                  comicSlug={comic.slug}
                />
              )}

              {/* ── Ratings Tab ── */}
              {activeTab === 'ratings' && (
                <div className="p-5">
                  {/* Rating overview */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">{comic.stats.avgRating.toFixed(1)}</span>
                      <div>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <i key={s} className={`fa-star text-sm ${s <= Math.round(comic.stats.avgRating) ? 'fa-solid' : 'fa-regular'}`}></i>
                          ))}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{comic.stats.totalRatings} đánh giá</span>
                      </div>
                    </div>

                    <div className="ml-auto">
                      {user && !hasRated && !showRatingForm && (
                        <button
                          onClick={() => setShowRatingForm(true)}
                          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/20 hover:shadow-md hover:brightness-110 transition-all cursor-pointer"
                        >
                          <i className="fa-regular fa-star mr-1.5"></i>
                          Đánh giá
                        </button>
                      )}
                      {user && hasRated && !showRatingForm && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <i className="fa-solid fa-circle-check"></i>
                          Đã đánh giá {myScore}/5
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating Form */}
                  {showRatingForm && user && (
                    <div className="mb-6 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-4">
                      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{hasRated ? 'Cập nhật đánh giá của bạn' : 'Đánh giá truyện này'}</p>

                      {/* Star selector */}
                      <div className="mb-3 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverStar(star)}
                            onMouseLeave={() => setHoverStar(0)}
                            onClick={() => setMyScore(star)}
                            className="text-2xl transition-transform hover:scale-125 cursor-pointer"
                          >
                            <i className={`fa-star ${star <= (hoverStar || myScore) ? 'fa-solid text-amber-400' : 'fa-regular text-zinc-300 dark:text-zinc-600'}`}></i>
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
                        className="mb-3 w-full resize-none rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 transition-all"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={submitRating}
                          disabled={myScore === 0 || submittingRating}
                          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition-all hover:brightness-110"
                        >
                          {submittingRating ? 'Đang gửi...' : hasRated ? 'Cập nhật' : 'Gửi đánh giá'}
                        </button>
                        <button onClick={() => setShowRatingForm(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors">
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ratings list */}
                  {ratings.length > 0 ? (
                    <div className="space-y-3">
                      {ratings.map((r) => (
                        <div key={r.id} className="rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-4 transition-colors hover:border-amber-200/60 dark:hover:border-amber-500/15">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/@${r.user.username}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-sm font-bold text-amber-700 dark:text-amber-300 transition-opacity hover:opacity-85"
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
                                  className="text-sm font-medium text-zinc-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors"
                                >
                                  {r.user.displayName}
                                </Link>
                                <span className="flex items-center gap-0.5 text-amber-400">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <i key={s} className={`fa-star text-[10px] ${s <= r.score ? 'fa-solid' : 'fa-regular text-zinc-300 dark:text-zinc-600'}`}></i>
                                  ))}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                          {r.review && <p className="mt-2.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{r.review}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      <i className="fa-light fa-star text-3xl mb-3 block text-zinc-300 dark:text-zinc-600"></i>
                      Chưa có đánh giá nào.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══ Comments Section (Below Tabs) ═══ */}
            <div className="mb-8">
              <CommentSection
                comments={comicComments}
                totalCount={commentTotal}
                currentUser={
                  user
                    ? {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl,
                      }
                    : null
                }
                readOnly={true}
                readOnlyMessage="Bình luận được hiển thị từ tất cả các chương. Để gửi bình luận, hãy chọn đọc một chương bất kỳ bên trên."
                onDeleteComment={handleDeleteComment}
                hasNext={commentHasNext}
                isLoading={loadingComments}
                isLoadingMore={loadingMoreComments}
                onLoadMore={handleLoadMoreComments}
                accentColor="amber"
              />
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-5">
            {/* Comic Info Card */}
            <div className="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-5">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                <i className="fa-regular fa-circle-info text-amber-500"></i>
                Thông tin truyện
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Tình trạng</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[comic.status] || statusColor.DRAFT}`}>
                    {statusLabel[comic.status] || comic.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Số chương</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">{comic.stats.totalChapters}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Lượt xem</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">{comic.stats.totalViews.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Đánh giá</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{comic.stats.avgRating.toFixed(1)} / 5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Theo dõi</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">{comic.stats.totalBookmarks.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Phân loại</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">{comic.contentRating}</span>
                </div>
              </div>
            </div>

            {/* Genres Card */}
            {comic.genres.length > 0 && (
              <div className="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-5">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                  <i className="fa-regular fa-tags text-amber-500"></i>
                  Thể loại
                </h3>
                <div className="flex flex-wrap gap-2">
                  {comic.genres.map((g) => (
                    <span key={g.id} className="rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300 font-medium transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/15">
                      {g.icon} {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Comics Card */}
            {relatedComics.length > 0 && (
              <div className="rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <i className="fa-solid fa-sparkles text-amber-500"></i>
                    Có thể bạn thích
                  </h3>
                  {recommendReason && (
                    <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90 mt-0.5 line-clamp-1 font-medium flex items-center gap-1">
                      <span>✨</span>
                      <span>{recommendReason}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {relatedComics.map((rc, idx) => (
                    <Link
                      key={rc.id}
                      href={`/comics/${rc.slug}`}
                      className="group flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-500/5"
                    >
                      {/* Ranking number */}
                      <span className="mt-1 text-lg font-bold text-amber-500/70 dark:text-amber-500/50 w-5 text-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      {/* Cover */}
                      <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                        {rc.coverUrl ? (
                          <img src={rc.coverUrl} alt={rc.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-bold text-zinc-400 dark:text-zinc-600">{rc.title[0]}</div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                          {rc.title}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rc.genres.slice(0, 2).map((g) => (
                            <span key={g.id} className="text-[10px] text-zinc-500 dark:text-zinc-500">
                              {g.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span className="flex items-center gap-0.5">
                            <i className="fa-solid fa-eye"></i>
                            {rc.stats.totalViews.toLocaleString()} lượt xem
                          </span>
                          {rc.stats.avgRating > 0 && (
                            <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                              ★ {Number(rc.stats.avgRating).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
