'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

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

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !article || !commentText.trim() || !accessToken) return;
    setIsSubmitting(true);
    try {
      const r = await api.post<{ data: NewsComment }>(
        `/news/${article.id}/comments`,
        { content: commentText.trim() },
        { token: accessToken }
      );
      setComments((prev) => [r.data, ...prev]);
      setCommentText('');
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
      <div className="relative min-h-screen">
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="text-6xl mb-4">📰</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Không tìm thấy bài viết</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">Bài viết này không tồn tại hoặc đã bị xóa.</p>
        <Link
          href="/news"
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25"
        >
          ← Quay lại tin tức
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/5 dark:bg-emerald-600/10 blur-[150px]" />
      </div>

      <article className="relative mx-auto max-w-4xl px-4 pt-8 pb-16">
        {/* Back link */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors mb-8"
        >
          <i className="fa-light fa-arrow-left" />
          Quay lại tin tức
        </Link>

        {/* Article Header */}
        <header className="mb-8">
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300 uppercase tracking-wider mb-4">
            {CATEGORY_MAP[article.category] || article.category}
          </span>

          <h1 className="text-2xl sm:text-4xl font-bold text-zinc-900 dark:text-white leading-tight mb-6">
            {article.title}
          </h1>

          {/* Author & Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href={`/@${article.author.username}`} className="flex items-center gap-2.5 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-sm">
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
          <div className="mb-10 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
            <img
              src={article.coverUrl}
              alt={article.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Article Content */}
        <div
          className="prose prose-zinc dark:prose-invert max-w-none
            prose-headings:font-bold prose-headings:text-zinc-900 dark:prose-headings:text-white
            prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-p:leading-relaxed
            prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl prose-img:border prose-img:border-zinc-200 dark:prose-img:border-white/10
            prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1
            prose-code:text-emerald-600 dark:prose-code:text-emerald-400
            prose-pre:bg-zinc-900 dark:prose-pre:bg-zinc-800/50 prose-pre:border prose-pre:border-zinc-200 dark:prose-pre:border-white/10
            mb-10"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10 pt-6 border-t border-zinc-200 dark:border-white/10">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/news?tag=${encodeURIComponent(tag)}`}
                className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-300"
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
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-95 cursor-pointer ${
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
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">
            Bình luận ({article._count.comments})
          </h3>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleComment} className="mb-8">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Viết bình luận..."
                    rows={3}
                    className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!commentText.trim() || isSubmitting}
                      className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? 'Đang gửi...' : 'Gửi bình luận'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-8 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-5 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Đăng nhập để bình luận</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25"
              >
                Đăng nhập
              </Link>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Link href={`/@${comment.user.username}`} className="shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                    {comment.user.avatarUrl ? (
                      <img src={comment.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      comment.user.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/@${comment.user.username}`} className="text-sm font-semibold text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors">
                        {comment.user.displayName}
                      </Link>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                  </div>

                  {/* Delete button for own comments */}
                  {user && user.id === comment.user.id && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="mt-1 ml-2 text-[10px] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 ml-2 pl-4 border-l-2 border-zinc-100 dark:border-white/5">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-2.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[8px] font-bold text-white">
                            {reply.user.avatarUrl ? (
                              <img src={reply.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              reply.user.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0 rounded-lg bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/30 dark:border-white/5 px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-white">{reply.user.displayName}</span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatRelativeTime(reply.createdAt)}</span>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                      {comment._count.replies > comment.replies.length && (
                        <button className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline ml-8 cursor-pointer">
                          Xem thêm {comment._count.replies - comment.replies.length} câu trả lời
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-8">
                Chưa có bình luận nào. Hãy là người đầu tiên!
              </p>
            )}
          </div>
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
                  className="group overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  <div className="aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt={r.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                        <i className="fa-light fa-newspaper text-2xl text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-300 uppercase tracking-wider">
                      {CATEGORY_MAP[r.category] || r.category}
                    </span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
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
