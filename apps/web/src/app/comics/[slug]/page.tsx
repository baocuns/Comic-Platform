'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { CommentSection } from '@/components/comments';
import { trackComicView, getGuestRecentGenres } from '@/lib/recommendation-tracker';
import styles from '../comics.module.css';

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

const CHAPTERS_PER_PAGE = 50;
const COMMENTS_PER_PAGE = 10;

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
  const [comicComments, setComicComments] = useState<ComicComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  // Chapter pagination state
  const [chapterPageIndex, setChapterPageIndex] = useState(0);
  const [chapterSortAsc, setChapterSortAsc] = useState(true);

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
            .catch(() => {});
        }
      });

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

  // Sorted chapters
  const sortedChapters = useMemo(() => {
    if (!comic?.chapters) return [];
    return [...comic.chapters].sort((a, b) => {
      const numA = parseFloat(a.number) || 0;
      const numB = parseFloat(b.number) || 0;
      return chapterSortAsc ? numA - numB : numB - numA;
    });
  }, [comic?.chapters, chapterSortAsc]);

  // Chapter pagination
  const totalChapterPages = Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE);
  const paginatedChapters = sortedChapters.slice(
    chapterPageIndex * CHAPTERS_PER_PAGE,
    (chapterPageIndex + 1) * CHAPTERS_PER_PAGE
  );

  // Comment pagination (calculate total pages)
  const totalCommentPages = Math.ceil(commentTotal / COMMENTS_PER_PAGE);

  const loadCommentPage = async (page: number) => {
    if (!comic) return;
    setLoadingMoreComments(true);
    try {
      const r = await api.get<{ data: ComicComment[]; meta: { total: number; hasNext: boolean } }>(`/comments/comic/${comic.id}?page=${page}`);
      setComicComments(r.data);
      setCommentHasNext(r.meta.hasNext);
      setCommentTotal(r.meta.total);
      setCommentPage(page);
    } catch { }
    setLoadingMoreComments(false);
  };

  if (loading) return <p className={styles.loading} role="status">Đang mở hồ sơ truyện…</p>;
  if (!comic) return <div className={styles.loading}>Truyện không tồn tại</div>;

  const firstChapter = comic.chapters && comic.chapters.length > 0
    ? [...comic.chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number))[0]
    : null;

  const descriptionTruncated = comic.description && comic.description.length > 200;
  const displayDescription = descExpanded ? comic.description : comic.description?.slice(0, 200);

  return (
    <div className={styles.detail}>
      {/* Banner */}
      <div className={styles.detailBanner}>
        {comic.bannerUrl || comic.coverUrl ? (
          <>
            <img
              src={comic.bannerUrl || comic.coverUrl!}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }}
            />
            <div className={styles.bannerInk} />
          </>
        ) : (
          <div className={styles.bannerInk} />
        )}
      </div>

      <div className={styles.detailBody}>
        {/* ═══ Hero Section ═══ */}
        <div className={styles.dossier}>
          <div className={styles.dossierRow}>
            {/* Cover Image */}
            <div className="shrink-0">
              <div className={styles.dossierCover}>
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-600">{comic.title[0]}</div>
                )}
              </div>
            </div>

            {/* Info Area */}
            <div className={styles.dossierInfo}>
              <p className={styles.issueLabel}>HỒ SƠ TRUYỆN · OWOC</p>
              {/* Title */}
              <h1>{comic.title}</h1>

              {/* Author */}
              <p className={styles.authorLine}>
                Một câu chuyện của <Link href={`/@${comic.author.username}`}>{comic.author.displayName}</Link>
              </p>

              {/* Micro Stats Row */}
              <div className={styles.microStats}>
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
                  <p className={styles.description}>
                    {displayDescription}
                    {descriptionTruncated && !descExpanded && '...'}
                  </p>
                  {descriptionTruncated && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className={styles.expandDescription}
                      aria-expanded={descExpanded}
                    >
                      {descExpanded ? 'Thu gọn' : 'Xem thêm'}
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.actions}>
                {firstChapter && (
                  <Link
                    href={`/read/${firstChapter.id}`}
                    className={styles.primaryAction}
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
                    className={styles.secondaryAction}
                    aria-pressed={isBookmarked}
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
        <div className={styles.mainColumns}>
          {/* Left: Tabs Area */}
          <div className="flex-1 min-w-0">
            {/* Tab Header */}
            <div className={styles.tabHeader} aria-label="Nội dung truyện">
              <button
                onClick={() => setActiveTab('chapters')}
                className={styles.tabButton}
                aria-pressed={activeTab === 'chapters'}
              >
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-list"></i>
                  Danh sách chương
                </span>

              </button>
              <button
                onClick={() => setActiveTab('ratings')}
                className={styles.tabButton}
                aria-pressed={activeTab === 'ratings'}
              >
                <span className="flex items-center gap-2">
                  <i className="fa-regular fa-star"></i>
                  Đánh giá ({comic.stats.totalRatings})
                </span>

              </button>
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
              {/* ── Chapters Tab ── */}
              {activeTab === 'chapters' && (
                <div className="p-5">
                  {/* Chapter header bar */}
                  <div className={styles.chapterHeader}>
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {comic.status === 'ONGOING' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Đang cập nhật</span>
                        ) : (
                          <span className={`${statusColor[comic.status] || ''} rounded-full px-2 py-0.5 text-xs`}>
                            {statusLabel[comic.status] || comic.status}
                          </span>
                        )}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600">|</span>
                      <span>Tổng {sortedChapters.length} chương</span>
                    </div>

                    {sortedChapters.length > 0 && (
                      <button
                        onClick={() => setChapterSortAsc(!chapterSortAsc)}
                        className={styles.chapterSort}
                        title={chapterSortAsc ? 'Mới nhất trước' : 'Cũ nhất trước'}
                      >
                        <i className={`fa-light ${chapterSortAsc ? 'fa-arrow-up-1-9' : 'fa-arrow-down-9-1'}`}></i>
                        <span>{chapterSortAsc ? 'Tăng dần' : 'Giảm dần'}</span>
                      </button>
                    )}
                  </div>

                  {/* Chapter range pagination */}
                  {totalChapterPages > 1 && (
                    <div className={`${styles.pagination} mb-4`}>
                      {Array.from({ length: totalChapterPages }, (_, i) => {
                        const start = i * CHAPTERS_PER_PAGE + 1;
                        const end = Math.min((i + 1) * CHAPTERS_PER_PAGE, sortedChapters.length);
                        return (
                          <button
                            key={i}
                            onClick={() => setChapterPageIndex(i)}
                            className="px-3"
                            aria-current={chapterPageIndex === i ? 'page' : undefined}
                          >
                            {start} - {end}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Chapter Grid */}
                  {paginatedChapters.length > 0 ? (
                    <div className={styles.chapterGrid}>
                      {paginatedChapters.map((ch) => (
                        <Link
                          key={ch.id}
                          href={`/read/${ch.id}`}
                          className={styles.chapterLink}
                        >
                          <span className="truncate text-zinc-700 dark:text-zinc-300 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors font-medium text-xs">
                            Chương {ch.number}
                            {ch.title && <span className="font-normal text-zinc-500 dark:text-zinc-500"> {ch.title}</span>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      <i className="fa-light fa-book-open-cover text-3xl mb-3 block text-zinc-300 dark:text-zinc-600"></i>
                      Chưa có chương nào
                    </div>
                  )}
                </div>
              )}

              {/* ── Ratings Tab ── */}
              {activeTab === 'ratings' && (
                <div className="p-5">
                  {/* Rating overview */}
                  <div className="flex flex-wrap items-center gap-4 mb-5">
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
                          className={styles.primaryAction}
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
                    <div className={styles.ratingForm}>
                      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{hasRated ? 'Cập nhật đánh giá của bạn' : 'Đánh giá truyện này'}</p>

                      {/* Star selector */}
                      <div className="mb-3 flex flex-wrap items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverStar(star)}
                            onMouseLeave={() => setHoverStar(0)}
                            onClick={() => setMyScore(star)}
                            className={styles.starButton}
                            aria-label={`${star} sao`}
                            aria-pressed={myScore === star}
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
                        className={styles.reviewInput}
                        aria-label="Nhận xét của bạn (tùy chọn)"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={submitRating}
                          disabled={myScore === 0 || submittingRating}
                          className={`${styles.primaryAction} disabled:opacity-50`}
                        >
                          {submittingRating ? 'Đang gửi...' : hasRated ? 'Cập nhật' : 'Gửi đánh giá'}
                        </button>
                        <button onClick={() => setShowRatingForm(false)} className={styles.secondaryAction}>
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ratings list */}
                  {ratings.length > 0 ? (
                    <div className="space-y-3">
                      {ratings.map((r) => (
                        <div key={r.id} className={styles.discussionCard}>
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
              <div className={styles.panel}>
                {/* Comment Header */}
                <div className="mb-5 flex items-center gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
                    <i className="fa-regular fa-comments text-amber-500"></i>
                    Bình luận ({commentTotal})
                  </h2>
                </div>

                {/* Read-only notice */}
                <div className={styles.notice}>
                  <i className="fa-regular fa-circle-info mt-0.5"></i>
                  <span>Bình luận được hiển thị từ tất cả các chương. Để gửi bình luận, hãy chọn đọc một chương bất kỳ bên trên.</span>
                </div>

                {/* Comments List */}
                {loadingMoreComments ? (
                  <p className="py-10 text-center text-sm" role="status">Đang tải bình luận…</p>
                ) : comicComments.length > 0 ? (
                  <div className="space-y-4">
                    {comicComments.map((comment) => (
                      <div key={comment.id} className={styles.discussionCard}>
                        <div className="flex items-start gap-3">
                          <Link
                            href={`/@${comment.user.username}`}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-sm font-bold text-amber-700 dark:text-amber-300 transition-opacity hover:opacity-85"
                          >
                            {comment.user.avatarUrl ? (
                              <img src={comment.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              comment.user.displayName[0]
                            )}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/@${comment.user.username}`}
                                className="text-sm font-medium text-zinc-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              >
                                {comment.user.displayName}
                              </Link>
                              {comment.chapter && (
                                <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5">
                                  Ch.{comment.chapter.number}
                                </span>
                              )}
                              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed break-words">{comment.content}</p>

                            {/* Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="mt-3 ml-2 pl-3 border-l-2 border-amber-200/40 dark:border-amber-500/15 space-y-3">
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className="flex items-start gap-2.5">
                                    <Link
                                      href={`/@${reply.user.username}`}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300"
                                    >
                                      {reply.user.avatarUrl ? (
                                        <img src={reply.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                                      ) : (
                                        reply.user.displayName[0]
                                      )}
                                    </Link>
                                    <div>
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <Link href={`/@${reply.user.username}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                                          {reply.user.displayName}
                                        </Link>
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{new Date(reply.createdAt).toLocaleDateString('vi-VN')}</span>
                                      </div>
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{reply.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    <i className="fa-light fa-message-dots text-3xl mb-3 block text-zinc-300 dark:text-zinc-600"></i>
                    Chưa có bình luận nào.
                  </div>
                )}

                {/* Pagination */}
                {totalCommentPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      onClick={() => loadCommentPage(commentPage - 1)}
                      aria-label="Trang bình luận trước"
                      disabled={commentPage <= 1}
                      className="rounded-lg p-2 text-sm text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      <i className="fa-regular fa-chevron-left"></i>
                    </button>

                    {generatePageNumbers(commentPage, totalCommentPages).map((p, i) => (
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-zinc-400 text-sm">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => loadCommentPage(p as number)}
                          aria-current={commentPage === p ? 'page' : undefined}
                          aria-label={`Trang bình luận ${p}`}
                        >
                          {p}
                        </button>
                      )
                    ))}

                    <button
                      onClick={() => loadCommentPage(commentPage + 1)}
                      aria-label="Trang bình luận tiếp theo"
                      disabled={commentPage >= totalCommentPages}
                      className="rounded-lg p-2 text-sm text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      <i className="fa-regular fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className={styles.sidebar}>
            {/* Comic Info Card */}
            <div className={`${styles.panel} ${styles.infoPanel}`}>
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
              <div className={styles.panel}>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                  <i className="fa-regular fa-tags text-amber-500"></i>
                  Thể loại
                </h3>
                <div className="flex flex-wrap gap-2">
                  {comic.genres.map((g) => (
                    <span key={g.id} className={styles.genreLabel}>
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Comics Card */}
            {relatedComics.length > 0 && (
              <div className={styles.panel}>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <i className="fa-solid fa-sparkles text-amber-500"></i>
                    Có thể bạn thích
                  </h3>
                  {recommendReason && (
                    <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90 mt-0.5 line-clamp-1 font-medium flex items-center gap-1">
                      <span>{recommendReason}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {relatedComics.map((rc, idx) => (
                    <Link
                      key={rc.id}
                      href={`/comics/${rc.slug}`}
                      className={`${styles.recommendation} group`}
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
    </div>
  );
}

/** Generate page number array with ellipsis for pagination */
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);

  return pages;
}
