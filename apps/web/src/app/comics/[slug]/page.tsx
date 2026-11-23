'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Heart,
  Star,
  Eye,
  Bookmark,
  Share2,
  Flag,
  ThumbsUp,
  UserPlus,
  UserCheck,
  Bell,
  BellOff,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  ReadingListStatus,
  ReportTargetType,
  type ComicDetail,
  type ComicSummary,
  type CommentItem,
  type RatingItem,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import { useToast } from '@/components/providers/toast-provider';
import { trackComicView, getGuestRecentGenres } from '@/lib/recommendation-tracker';
import {
  COMIC_STATUS_LABEL,
  COMIC_TYPE_LABEL,
  CONTENT_RATING_LABEL,
  READING_LIST_LABEL,
  formatCompactNumber,
  formatDate,
} from '@/lib/format';
import { ChapterList, ComicCardHorizontal } from '@/components/comic';
import { CommentSection } from '@/components/comments';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RealmBadge } from '@/components/ui/realm-badge';
import { ReportModal } from '@/components/ui/report-modal';
import { Tabs } from '@/components/ui/tabs';

export default function ComicDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();
  const localHistory = useReadingHistoryStore((s) => s.getByComic(undefined, slug));

  const [comic, setComic] = useState<ComicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chapters' | 'ratings'>('chapters');

  // Bookmark & Follow state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingStatus, setReadingStatus] = useState<ReadingListStatus>(ReadingListStatus.READING);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notifyUpdate, setNotifyUpdate] = useState(true);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);

  // Ratings state
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [myReview, setMyReview] = useState('');
  const [hoverStar, setHoverStar] = useState(0);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Comments state
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentSort, setCommentSort] = useState<'newest' | 'top'>('newest');
  const [commentScope, setCommentScope] = useState<'all' | 'comic' | 'chapters'>('all');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Recommendations & Report
  const [recommendations, setRecommendations] = useState<ComicSummary[]>([]);
  const [recReason, setRecReason] = useState('Có thể bạn sẽ thích');
  const [reportOpen, setReportOpen] = useState(false);

  const loadComic = useCallback(async (signal?: AbortSignal) => {
    if (!slug) return;
    try {
      const res = await api.get<{ data: ComicDetail }>(`/comics/${slug}`, {
        token: accessToken,
        signal,
      });
      if (signal?.aborted) return;
      const data = res.data;
      setComic(data);
      trackComicView(data);

      if (data.userState) {
        setIsBookmarked(data.userState.isBookmarked);
        setReadingStatus(data.userState.readingStatus || ReadingListStatus.READING);
        setIsFavorite(data.userState.isFavorite);
        setNotifyUpdate(data.userState.notifyUpdate);
        setIsFollowingAuthor(data.userState.isFollowingAuthor);
        setMyScore(data.userState.myRating?.score || 0);
        setMyReview(data.userState.myRating?.review || '');
      } else {
        setIsBookmarked(false);
        setReadingStatus(ReadingListStatus.READING);
        setIsFavorite(false);
        setNotifyUpdate(true);
        setIsFollowingAuthor(false);
        setMyScore(0);
        setMyReview('');
      }
    } catch {
      if (!signal?.aborted) {
        setComic(null);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [slug, accessToken]);

  useEffect(() => {
    setComic(null);
    setLoading(true);
    setDescExpanded(false);
    setActiveTab('chapters');
    setShowRatingForm(false);
    setHoverStar(0);
    setReportOpen(false);
    setRatings([]);
    setComments([]);
    setRecommendations([]);

    const controller = new AbortController();
    loadComic(controller.signal);
    return () => controller.abort();
  }, [slug, loadComic]);

  const loadComments = useCallback(
    async (comicId: string, pageNum = 1, append = false, signal?: AbortSignal) => {
      if (!append) setLoadingComments(true);
      try {
        const res = await api.get<{ data: CommentItem[]; meta: { total: number; hasNext: boolean } }>(
          `/comments/comic/${comicId}?page=${pageNum}&sort=${commentSort}&scope=${commentScope}`,
          { token: accessToken, signal },
        );
        if (signal?.aborted) return;
        setComments((prev) => (append ? [...prev, ...res.data] : res.data));
        setCommentTotal(res.meta.total);
        setCommentHasNext(res.meta.hasNext);
        setCommentPage(pageNum);
      } catch {
        // Ignore abort / transient error
      } finally {
        if (!signal?.aborted) {
          setLoadingComments(false);
        }
      }
    },
    [commentSort, commentScope, accessToken],
  );

  useEffect(() => {
    if (!comic?.id) return;
    const controller = new AbortController();
    const comicId = comic.id;

    api
      .get<{ data: RatingItem[] }>(`/ratings/comics/${comicId}`, {
        token: accessToken,
        signal: controller.signal,
      })
      .then((r) => {
        if (!controller.signal.aborted) setRatings(r.data || []);
      })
      .catch(() => {});

    const guestGenres = getGuestRecentGenres();
    const q = new URLSearchParams({
      comicId,
      limit: '5',
      ...(guestGenres.length > 0 && { genres: guestGenres.join(',') }),
    });
    api
      .get<{ data: { data: ComicSummary[]; reason: string } }>(`/comics/recommendations?${q.toString()}`, {
        token: accessToken,
        signal: controller.signal,
      })
      .then((r) => {
        if (controller.signal.aborted) return;
        const payload = r.data as unknown as ComicSummary[] | { data: ComicSummary[]; reason?: string };
        const list = Array.isArray(payload) ? payload : payload.data || [];
        setRecommendations(list.filter((c) => c.id !== comicId).slice(0, 5));
        if (!Array.isArray(payload) && payload.reason) setRecReason(payload.reason);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [comic?.id, accessToken]);

  useEffect(() => {
    if (!comic?.id) return;
    const controller = new AbortController();
    loadComments(comic.id, 1, false, controller.signal);
    return () => controller.abort();
  }, [comic?.id, loadComments]);

  const handleSaveBookmark = async (status: ReadingListStatus, nextFav = isFavorite, nextNotify = notifyUpdate) => {
    if (!accessToken || !comic) {
      toast.error('Vui lòng đăng nhập để lưu truyện');
      return;
    }
    try {
      await api.put(
        `/bookmarks/${comic.id}`,
        { status, isFavorite: nextFav, notifyUpdate: nextNotify },
        { token: accessToken },
      );
      if (!isBookmarked) {
        setComic((prev) =>
          prev ? { ...prev, stats: { ...prev.stats, totalBookmarks: prev.stats.totalBookmarks + 1 } } : prev,
        );
      }
      setIsBookmarked(true);
      setReadingStatus(status);
      setIsFavorite(nextFav);
      setNotifyUpdate(nextNotify);
      toast.success(`Đã lưu vào danh sách "${READING_LIST_LABEL[status]}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể cập nhật tủ sách');
    }
  };

  const handleRemoveBookmark = async () => {
    if (!accessToken || !comic) return;
    try {
      await api.delete(`/bookmarks/${comic.id}`, { token: accessToken });
      setIsBookmarked(false);
      setComic((prev) =>
        prev
          ? { ...prev, stats: { ...prev.stats, totalBookmarks: Math.max(0, prev.stats.totalBookmarks - 1) } }
          : prev,
      );
      toast.info('Đã bỏ lưu khỏi tủ sách');
    } catch {
      // Ignore
    }
  };

  const handleToggleFollow = async () => {
    if (!accessToken || !comic) {
      toast.error('Vui lòng đăng nhập để theo dõi tác giả');
      return;
    }
    try {
      if (isFollowingAuthor) {
        await api.delete(`/users/${comic.author.id}/follow`, { token: accessToken });
        setIsFollowingAuthor(false);
        toast.info('Đã hủy theo dõi tác giả');
      } else {
        await api.post(`/users/${comic.author.id}/follow`, {}, { token: accessToken });
        setIsFollowingAuthor(true);
        toast.success(`Đã theo dõi ${comic.author.displayName}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  const handleSubmitRating = async () => {
    if (!accessToken || !comic || myScore === 0) return;
    setSubmittingRating(true);
    try {
      await api.post(
        `/ratings/comics/${comic.id}`,
        { score: myScore, review: myReview.trim() || undefined },
        { token: accessToken },
      );
      toast.success('Đã lưu đánh giá của bạn!');
      setShowRatingForm(false);
      await loadComic();
      const ratingsRes = await api.get<{ data: RatingItem[] }>(`/ratings/comics/${comic.id}`, {
        token: accessToken,
      });
      setRatings(ratingsRes.data || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi đánh giá');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleToggleHelpful = async (ratingId: string) => {
    if (!accessToken) {
      toast.error('Vui lòng đăng nhập để bình chọn hữu ích');
      return;
    }
    try {
      const res = await api.post<{ data: { isHelpful: boolean; helpfulCount: number } }>(
        `/ratings/${ratingId}/helpful`,
        {},
        { token: accessToken },
      );
      setRatings((prev) =>
        prev.map((r) =>
          r.id === ratingId
            ? { ...r, isHelpful: res.data.isHelpful, helpfulCount: res.data.helpfulCount }
            : r,
        ),
      );
    } catch {
      // Ignore
    }
  };

  const handleSubmitComment = async (content: string, isSpoiler: boolean, parentId?: string) => {
    if (!accessToken || !comic) return;
    setSubmittingComment(true);
    try {
      const res = await api.post<{ data: CommentItem }>(
        `/comments/comic/${comic.id}`,
        { content, isSpoiler, parentId },
        { token: accessToken },
      );
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, replies: [...(c.replies || []), res.data] } : c,
          ),
        );
      } else {
        setComments((prev) => [res.data, ...prev]);
        setCommentTotal((n) => n + 1);
      }
      toast.success('Đã đăng bình luận (+5 XP)');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi bình luận');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!accessToken) {
      toast.error('Đăng nhập để thích bình luận');
      return;
    }
    try {
      const res = await api.post<{ data: { liked: boolean; likesCount: number } }>(
        `/comments/${commentId}/like`,
        {},
        { token: accessToken },
      );
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, isLiked: res.data.liked, likesCount: res.data.likesCount };
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, isLiked: res.data.liked, likesCount: res.data.likesCount } : r,
              ),
            };
          }
          return c;
        }),
      );
    } catch {
      // Ignore
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!accessToken) return;
    await api.patch(`/comments/${commentId}`, { content }, { token: accessToken });
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, content }
          : { ...c, replies: c.replies?.map((r) => (r.id === commentId ? { ...r, content } : r)) },
      ),
    );
    toast.success('Đã cập nhật bình luận');
  };

  const handleDeleteComment = async (commentId: string, parentId?: string | null) => {
    if (!accessToken) return;
    await api.delete(`/comments/${commentId}`, { token: accessToken });
    if (parentId) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: c.replies?.filter((r) => r.id !== commentId) } : c,
        ),
      );
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentTotal((n) => Math.max(0, n - 1));
    }
    toast.info('Đã xóa bình luận');
  };

  const handlePinComment = async (commentId: string, isPinned: boolean) => {
    if (!accessToken) return;
    await api.patch(`/comments/${commentId}`, { isPinned }, { token: accessToken });
    if (comic) loadComments(comic.id, 1, false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--bg-subtle)]" />
      </div>
    );
  }

  if (!comic) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center space-y-3">
        <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Không tìm thấy truyện</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Bộ truyện có thể đã bị gỡ hoặc đang chờ kiểm duyệt.
        </p>
        <Link href="/comics">
          <Button>Quay lại kho truyện</Button>
        </Link>
      </div>
    );
  }

  const firstChapter = comic.chapters?.[0] || null;
  const resumeChapterId = comic.userState?.lastChapterId || localHistory?.chapterId || firstChapter?.id;
  const resumeChapterNumber =
    comic.chapters.find((c) => c.id === resumeChapterId)?.number ?? localHistory?.chapterNumber ?? firstChapter?.number;
  const isResuming = !!(comic.userState?.lastChapterId || localHistory?.chapterId);

  const totalRatings = Math.max(1, comic.stats.totalRatings);

  return (
    <div className="pb-16">
      {/* Banner Backdrop */}
      <div className="relative h-56 sm:h-72 overflow-hidden bg-[var(--bg-subtle)]">
        {(comic.bannerUrl || comic.coverUrl) && (
          <img
            src={comic.bannerUrl || comic.coverUrl!}
            alt=""
            className="h-full w-full object-cover opacity-55 blur-[2px] scale-105"
            style={{ objectPosition: `center ${comic.bannerPosition ?? 50}%` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/55 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 -mt-28 sm:-mt-36 relative z-10 space-y-8">
        {/* Hero Card */}
        <Card className="p-5 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Cover */}
            <div className="mx-auto md:mx-0 shrink-0">
              <div className="aspect-[3/4] w-44 sm:w-52 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] shadow-lg">
                {comic.coverUrl ? (
                  <img src={comic.coverUrl} alt={comic.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-serif text-4xl font-bold text-[var(--text-muted)]">
                    {comic.title[0]}
                  </div>
                )}
              </div>
            </div>

            {/* Meta & Actions */}
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">{COMIC_TYPE_LABEL[comic.type] || comic.type}</Badge>
                <Badge variant={comic.status === 'COMPLETED' ? 'success' : 'warm'}>
                  {COMIC_STATUS_LABEL[comic.status] || comic.status}
                </Badge>
                <Badge variant="outline">{CONTENT_RATING_LABEL[comic.contentRating]}</Badge>
              </div>

              <div>
                <h1 className="font-serif text-2xl sm:text-4xl font-bold leading-tight text-[var(--text-primary)]">
                  {comic.title}
                </h1>
                {comic.alternativeTitles?.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Tên khác: {comic.alternativeTitles.join(' · ')}
                  </p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--warning)]">
                  <Star className="h-4 w-4 fill-current" />
                  {comic.stats.avgRating.toFixed(1)} ({comic.stats.totalRatings} đánh giá)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-[var(--text-muted)]" />
                  {formatCompactNumber(comic.stats.totalViews)} lượt xem
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark className="h-4 w-4 text-[var(--text-muted)]" />
                  {formatCompactNumber(comic.stats.totalBookmarks)} theo dõi
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[var(--text-muted)]" />
                  {comic.stats.totalChapters} chương
                </span>
              </div>

              {/* Genres & Tags */}
              {comic.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {comic.genres.map((g) => (
                    <Link
                      key={g.id}
                      href={`/comics?genre=${g.slug}`}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      {g.icon} {g.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Synopsis */}
              {comic.description && (
                <div>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {descExpanded || comic.description.length <= 240
                      ? comic.description
                      : `${comic.description.slice(0, 240)}...`}
                  </p>
                  {comic.description.length > 240 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      {descExpanded ? 'Thu gọn' : 'Xem thêm'}
                    </button>
                  )}
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {resumeChapterId && (
                  <Link href={`/read/${resumeChapterId}`}>
                    <Button variant="warm" size="lg">
                      <BookOpen className="h-4 w-4" />
                      <span>
                        {isResuming ? `Đọc tiếp Chương ${resumeChapterNumber}` : 'Đọc từ đầu'}
                      </span>
                    </Button>
                  </Link>
                )}

                {user ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={isBookmarked ? readingStatus : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'REMOVE') handleRemoveBookmark();
                        else if (val) handleSaveBookmark(val as ReadingListStatus);
                      }}
                      className={`h-11 rounded-xl border px-3.5 text-sm font-semibold cursor-pointer focus:outline-none ${
                        isBookmarked
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)]'
                      }`}
                    >
                      {!isBookmarked && <option value="">+ Lưu vào tủ sách</option>}
                      {Object.values(ReadingListStatus).map((st) => (
                        <option key={st} value={st}>
                          {isBookmarked && readingStatus === st ? `✓ ${READING_LIST_LABEL[st]}` : READING_LIST_LABEL[st]}
                        </option>
                      ))}
                      {isBookmarked && <option value="REMOVE">× Bỏ khỏi tủ sách</option>}
                    </select>

                    {isBookmarked && (
                      <>
                        <Button
                          variant={isFavorite ? 'warm' : 'outline'}
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => handleSaveBookmark(readingStatus, !isFavorite, notifyUpdate)}
                          title={isFavorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          variant={notifyUpdate ? 'secondary' : 'outline'}
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => handleSaveBookmark(readingStatus, isFavorite, !notifyUpdate)}
                          title={notifyUpdate ? 'Đang bật thông báo chương mới' : 'Bật thông báo chương mới'}
                        >
                          {notifyUpdate ? <Bell className="h-4 w-4 text-[var(--accent-primary)]" /> : <BellOff className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <Link href="/login">
                    <Button variant="outline" size="lg">
                      <Bookmark className="h-4 w-4" />
                      <span>Lưu vào tủ sách</span>
                    </Button>
                  </Link>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={async () => {
                    try {
                      if (!navigator.clipboard?.writeText) {
                        toast.error('Trình duyệt không hỗ trợ sao chép tự động');
                        return;
                      }
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success('Đã sao chép liên kết truyện');
                    } catch {
                      toast.error('Không thể sao chép liên kết');
                    }
                  }}
                  title="Chia sẻ"
                >
                  <Share2 className="h-4 w-4" />
                </Button>

                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setReportOpen(true)}
                    title="Báo cáo vi phạm"
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Main 2-column Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-8">
            {/* Tabs: Chapters / Ratings */}
            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                <Tabs
                  value={activeTab}
                  onChange={setActiveTab}
                  items={[
                    { value: 'chapters', label: 'Danh sách chương', badge: comic.chapters.length },
                    { value: 'ratings', label: 'Đánh giá & Nhận xét', badge: comic.stats.totalRatings },
                  ]}
                />
              </div>

              {activeTab === 'chapters' ? (
                <ChapterList
                  chapters={comic.chapters}
                  comicId={comic.id}
                  comicSlug={comic.slug}
                  lastChapterId={comic.userState?.lastChapterId}
                  readChapterIds={comic.userState?.readChapterIds}
                  unlockedChapterIds={comic.userState?.unlockedChapterIds}
                />
              ) : (
                <div className="p-5 space-y-6">
                  {/* Rating Summary & Breakdown */}
                  <div className="flex flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-5 sm:flex-row sm:items-center">
                    <div className="text-center sm:pr-6 sm:border-r sm:border-[var(--border-subtle)]">
                      <p className="font-serif text-4xl font-bold text-[var(--text-primary)]">
                        {comic.stats.avgRating.toFixed(1)}
                      </p>
                      <div className="my-1 flex justify-center gap-0.5 text-[var(--warning)]">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s <= Math.round(comic.stats.avgRating) ? 'fill-current' : 'opacity-30'}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{comic.stats.totalRatings} lượt đánh giá</p>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = comic.ratingBreakdown?.[star as 1 | 2 | 3 | 4 | 5] || 0;
                        const pct = Math.round((count / totalRatings) * 100);
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-8 font-semibold text-[var(--text-secondary)]">{star}★</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                              <div
                                className="h-full rounded-full bg-[var(--warning)]"
                                style={{ width: `${comic.stats.totalRatings ? pct : 0}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-[var(--text-muted)]">{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    {user && (
                      <div className="shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setShowRatingForm((v) => !v)}
                        >
                          {comic.userState?.myRating ? 'Sửa đánh giá' : 'Viết đánh giá'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Rating Form */}
                  {showRatingForm && user && (
                    <div className="rounded-2xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary-soft)]/30 p-4 space-y-3">
                      <p className="text-sm font-bold text-[var(--text-primary)]">Chọn số sao của bạn</p>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onMouseEnter={() => setHoverStar(s)}
                            onMouseLeave={() => setHoverStar(0)}
                            onClick={() => setMyScore(s)}
                            className="p-1 cursor-pointer transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-7 w-7 ${
                                s <= (hoverStar || myScore)
                                  ? 'fill-current text-[var(--warning)]'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={3}
                        value={myReview}
                        onChange={(e) => setMyReview(e.target.value)}
                        placeholder="Nhận xét chi tiết về cốt truyện, nét vẽ..."
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={myScore === 0}
                          isLoading={submittingRating}
                          onClick={handleSubmitRating}
                        >
                          Gửi đánh giá
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowRatingForm(false)}>
                          Hủy
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Reviews list */}
                  <div className="space-y-3">
                    {ratings.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                        Chưa có nhận xét nào cho bộ truyện này.
                      </p>
                    ) : (
                      ratings.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <Link href={`/@${r.user.username}`}>
                                <Avatar src={r.user.avatarUrl} name={r.user.displayName} size="sm" />
                              </Link>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/@${r.user.username}`}
                                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                                  >
                                    {r.user.displayName}
                                  </Link>
                                  <RealmBadge level={r.user.level} />
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                  <span className="flex items-center gap-0.5 text-[var(--warning)]">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star key={s} className={`h-3 w-3 ${s <= r.score ? 'fill-current' : 'opacity-25'}`} />
                                    ))}
                                  </span>
                                  <span>{formatDate(r.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleHelpful(r.id)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                                r.isHelpful
                                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                              }`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              <span>Hữu ích ({r.helpfulCount})</span>
                            </button>
                          </div>
                          {r.review && (
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{r.review}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Direct Comic Comments */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Tabs
                  value={commentScope}
                  onChange={setCommentScope}
                  items={[
                    { value: 'all', label: 'Tất cả bình luận' },
                    { value: 'comic', label: 'Bình luận truyện' },
                    { value: 'chapters', label: 'Theo chương' },
                  ]}
                />
              </div>

              <CommentSection
                title="Thảo luận về truyện"
                comments={comments}
                totalCount={commentTotal}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                comicAuthorId={comic.author.id}
                isLoading={loadingComments}
                isSubmitting={submittingComment}
                hasNext={commentHasNext}
                sort={commentSort}
                onSortChange={setCommentSort}
                onSubmitComment={(content, spoiler) => handleSubmitComment(content, spoiler)}
                onSubmitReply={(parentId, content, spoiler) => handleSubmitComment(content, spoiler, parentId)}
                onToggleLike={handleToggleCommentLike}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                onPinComment={handlePinComment}
                onLoadMore={() => loadComments(comic.id, commentPage + 1, true)}
              />
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Author Card */}
            <Card className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Nhóm sáng tác / Tác giả
              </h3>
              <div className="flex items-center gap-3">
                <Link href={`/@${comic.author.username}`}>
                  <Avatar src={comic.author.avatarUrl} name={comic.author.displayName} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/@${comic.author.username}`}
                    className="block truncate text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                  >
                    {comic.author.displayName}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <RealmBadge level={comic.author.level} />
                    {comic.author.isTrusted && (
                      <Badge variant="success" className="text-[10px]">
                        <Check className="h-2.5 w-2.5" />
                        Uy tín
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {user?.id !== comic.author.id && (
                <Button
                  variant={isFollowingAuthor ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full"
                  onClick={handleToggleFollow}
                >
                  {isFollowingAuthor ? (
                    <>
                      <UserCheck className="h-4 w-4 text-[var(--success)]" />
                      <span>Đang theo dõi</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Theo dõi tác giả</span>
                    </>
                  )}
                </Button>
              )}
            </Card>

            {/* Details Card */}
            <Card className="space-y-3 text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Thông tin chi tiết
              </h3>
              <div className="space-y-2.5">
                {comic.artistName && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Họa sĩ</span>
                    <span className="font-medium text-[var(--text-primary)]">{comic.artistName}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Định dạng</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {COMIC_TYPE_LABEL[comic.type]}
                  </span>
                </div>
                {comic.releaseYear && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Năm phát hành</span>
                    <span className="font-medium text-[var(--text-primary)]">{comic.releaseYear}</span>
                  </div>
                )}
                {comic.tags?.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
                    {comic.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/comics?search=${encodeURIComponent(tag)}`}
                        className="rounded-lg bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Personalized Recommendations */}
            {recommendations.length > 0 && (
              <Card className="space-y-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                    <Sparkles className="h-4 w-4 text-[var(--accent-warm)]" />
                    Gợi ý tương đồng
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{recReason}</p>
                </div>
                <div className="space-y-2.5">
                  {recommendations.map((rc) => (
                    <ComicCardHorizontal key={rc.id} comic={rc} />
                  ))}
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType={ReportTargetType.COMIC}
        targetId={comic.id}
        targetLabel={comic.title}
      />
    </div>
  );
}
