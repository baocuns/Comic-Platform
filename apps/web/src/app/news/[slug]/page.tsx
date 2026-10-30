'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { NewsContentRenderer } from '@/components/news/news-content-renderer';
import { CommentSection } from '@/components/comments';
import '../../supporting-pages.css';

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
  content: string;
  coverUrl: string | null;
  category: string;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  publishedAt: string;
  author: NewsAuthor;
  _count: { comments: number; likes: number };
}

interface NewsComment {
  id: string;
  content: string;
  createdAt: string;
  user: NewsAuthor;
  replies: NewsComment[];
  _count: { replies: number };
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string;
  publishedAt: string;
  author: NewsAuthor;
}

const CATEGORY_MAP: Record<string, string> = {
  ANNOUNCEMENT: '📢 Thông báo',
  EVENT: '🎉 Sự kiện',
  UPDATE: '🔄 Cập nhật',
  COMMUNITY: '👥 Cộng đồng',
  FEATURED: '⭐ Nổi bật',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return formatDate(dateStr);
}

function formatViews(count: number) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export default function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, accessToken } = useAuthStore();

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<{ data: NewsArticle }>(`/news/${slug}`, accessToken ? { token: accessToken } : undefined)
      .then((r) => {
        setArticle(r.data);
        setIsLiked(r.data.isLiked);
        setLikesCount(r.data.likesCount);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      })
      .finally(() => setIsLoading(false));

    api
      .get<{ data: RelatedArticle[] }>(`/news/${slug}/related`)
      .then((r) => setRelated(r.data))
      .catch(() => {});
  }, [slug, accessToken]);

  useEffect(() => {
    if (!article) return;
    api
      .get<{ data: NewsComment[] }>(`/news/${article.id}/comments`)
      .then((r) => setComments(r.data))
      .catch(() => {});
  }, [article]);

  const handleLike = async () => {
    if (!user || !article || !accessToken || isLiking) return;

    // Save previous state for rollback
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;

    // Optimistic UI update
    const nextIsLiked = !isLiked;
    setIsLiked(nextIsLiked);
    setLikesCount((prev) => (nextIsLiked ? prev + 1 : prev - 1));
    setIsLiking(true);

    try {
      const r = await api.post<{ data: { liked: boolean } }>(
        `/news/${article.id}/like`,
        undefined,
        { token: accessToken }
      );
      setIsLiked(r.data.liked);
    } catch {
      // Rollback on error
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handlePostComment = async (content: string) => {
    if (!user || !article || !content.trim() || !accessToken) return;
    setIsSubmitting(true);
    try {
      const r = await api.post<{ data: NewsComment }>(
        `/news/${article.id}/comments`,
        { content: content.trim() },
        { token: accessToken }
      );
      setComments((prev) => [r.data, ...prev]);
    } catch {}
    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!accessToken) return;
    try {
      await api.delete(`/news/comments/${commentId}`, { token: accessToken });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="ow-support ow-article min-h-screen" role="status" aria-label="Đang tải bài viết">
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-16 animate-pulse">
          <div className="h-4 w-32 rounded-full bg-zinc-200/60 dark:bg-zinc-800/60 mb-6" />
          <div className="h-8 w-3/4 rounded bg-zinc-200/60 dark:bg-zinc-800/60 mb-3" />
          <div className="h-8 w-1/2 rounded bg-zinc-200/60 dark:bg-zinc-800/60 mb-6" />
          <div className="flex gap-3 mb-8">
            <div className="h-8 w-8 rounded-full bg-zinc-200/60 dark:bg-zinc-800/60" />
            <div className="h-4 w-48 rounded bg-zinc-200/60 dark:bg-zinc-800/60 self-center" />
          </div>
          <div className="aspect-video rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-4 rounded bg-zinc-200/40 dark:bg-zinc-800/40 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-5/6' : 'w-4/5'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="ow-support ow-unavailable flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="text-6xl mb-4">📰</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Không tìm thấy bài viết</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">Bài viết này không tồn tại hoặc đã bị xóa.</p>
        <Link
          href="/news"
          className="ow-action text-sm font-semibold text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:brightness-110 transition-all"
        >
          ← Quay lại tin tức
        </Link>
      </div>
    );
  }

  return (
    <div className="ow-support ow-article">

      <article className="relative mx-auto max-w-4xl px-4 pt-8 pb-16">
        {/* Back link */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mb-8"
        >
          <i className="fa-light fa-arrow-left" />
          Quay lại tin tức
        </Link>

        {/* Article Header */}
        <header className="ow-article-header mb-8">
          <span className="ow-kicker mb-5">
            {CATEGORY_MAP[article.category] || article.category}
          </span>

          <h1 className="text-2xl sm:text-4xl font-bold text-zinc-900 dark:text-white leading-tight mb-6">
            {article.title}
          </h1>

          {/* Author & Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href={`/@${article.author.username}`} className="flex items-center gap-2.5 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-sm font-bold text-white shadow-sm">
                {article.author.avatarUrl ? (
                  <img src={article.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  article.author.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white text-sm">{article.author.displayName}</p>
              </div>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{formatDate(article.publishedAt)}</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span><i className="fa-light fa-eye mr-1" />{formatViews(article.viewCount)} lượt xem</span>
          </div>
        </header>

        {/* Cover Image */}
        {article.coverUrl && (
          <div className="ow-article-cover mb-10">
            <img
              src={article.coverUrl}
              alt={article.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Article Content */}
        <div className="ow-article-content mb-10">
          <NewsContentRenderer content={article.content} />
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10 pt-6 border-t border-zinc-200 dark:border-white/10">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/news?tag=${encodeURIComponent(tag)}`}
                className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 transition-all hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-amber-600 dark:hover:text-amber-400"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Like & Share Section */}
        <div className="flex items-center gap-4 mb-10 py-6 border-y border-zinc-200 dark:border-white/10">
          <button
            onClick={handleLike}
            disabled={!user || isLiking}
            aria-pressed={isLiked}
            aria-label={isLiked ? 'Bỏ thích bài viết' : 'Thích bài viết'}
            className={`ow-secondary ow-like-button flex items-center gap-2 text-sm ${
              isLiked
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
                : 'bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-rose-500/30 hover:bg-rose-500/5 hover:text-rose-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={!user ? 'Đăng nhập để thích bài viết' : ''}
          >
            <i className={`${isLiked ? 'fa-solid text-rose-500' : 'fa-light'} fa-heart transition-transform duration-200 ${isLiked ? 'scale-110' : ''}`} />
            <span>{likesCount}</span>
          </button>

          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            <i className="fa-light fa-comment mr-1" /> {article._count.comments} bình luận
          </span>
        </div>

        {/* Comments Section */}
        <section className="mb-12">
          <CommentSection
            comments={comments}
            totalCount={article._count.comments}
            currentUser={user ? { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl } : null}
            onSubmitComment={handlePostComment}
            onDeleteComment={(commentId) => handleDeleteComment(commentId)}
            isSubmitting={isSubmitting}
            accentColor="amber"
          />
        </section>

        {/* Related Articles */}
        {related.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">
              Bài viết liên quan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/news/${r.slug}`}
                  className="ow-news-card group"
                >
                  <div className="aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt={r.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                        <i className="fa-light fa-newspaper text-2xl text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      {CATEGORY_MAP[r.category] || r.category}
                    </span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {r.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                      {formatDate(r.publishedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
