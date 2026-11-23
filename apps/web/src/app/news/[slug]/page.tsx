'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Heart, Eye, Clock, Share2 } from 'lucide-react';
import { ReportTargetType, type CommentItem, type NewsItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { NEWS_CATEGORY_LABEL, formatDate } from '@/lib/format';
import { NewsContentRenderer } from '@/components/news/news-content-renderer';
import { CommentSection } from '@/components/comments';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NewsDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();

  const [article, setArticle] = useState<NewsItem | null>(null);
  const [related, setRelated] = useState<NewsItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async (articleId: string, signal?: AbortSignal) => {
    try {
      const res = await api.get<{ data: CommentItem[]; meta: { total: number } }>(
        `/news/${articleId}/comments?page=1`,
        { signal },
      );
      if (!signal?.aborted) {
        setComments(res.data || []);
        setCommentTotal(res.meta?.total || 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setArticle(null);
    setRelated([]);
    setComments([]);
    setCommentTotal(0);

    Promise.all([
      api.get<{ data: NewsItem }>(`/news/${slug}`, { token: accessToken, signal: controller.signal }),
      api
        .get<{ data: NewsItem[] }>(`/news/${slug}/related`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
    ])
      .then(([artRes, relRes]) => {
        if (controller.signal.aborted) return;
        setArticle(artRes.data);
        setRelated(relRes.data || []);
        loadComments(artRes.data.id, controller.signal);
      })
      .catch(() => {
        if (!controller.signal.aborted) setArticle(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug, accessToken, loadComments]);

  const handleToggleLike = async () => {
    if (!article) return;
    if (!accessToken) {
      toast.error('Đăng nhập để thích bài viết');
      return;
    }
    try {
      const res = await api.post<{ data: { liked: boolean; likesCount: number } }>(
        `/news/${article.id}/like`,
        {},
        { token: accessToken },
      );
      setArticle((prev) =>
        prev ? { ...prev, isLiked: res.data.liked, likesCount: res.data.likesCount } : prev,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể thao tác lúc này');
    }
  };

  const handleComment = async (content: string, parentId?: string) => {
    if (!article || !accessToken) return;
    setSubmitting(true);
    try {
      await api.post(
        `/news/${article.id}/comments`,
        { content, parentId },
        { token: accessToken },
      );
      await loadComments(article.id);
      toast.success('Đã gửi bình luận');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!article || !accessToken) return;
    try {
      await api.delete(`/news/comments/${commentId}`, { token: accessToken });
      await loadComments(article.id);
      toast.info('Đã xóa bình luận');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xóa bình luận');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-80 animate-pulse rounded-3xl bg-[var(--bg-subtle)]" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-3">
        <h1 className="font-serif text-2xl font-bold">Bài viết không tồn tại</h1>
        <Link href="/news">
          <Button>Quay lại trang Tin tức</Button>
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại Tạp chí & Tin tức
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warm">{NEWS_CATEGORY_LABEL[article.category]}</Badge>
          {article.tags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>

        <h1 className="font-serif text-2xl sm:text-4xl font-bold leading-tight text-[var(--text-primary)]">
          {article.title}
        </h1>

        {article.excerpt && (
          <p className="text-base leading-relaxed text-[var(--text-secondary)]">{article.excerpt}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border-subtle)] py-3.5">
          <Link href={`/@${article.author.username}`} className="flex items-center gap-2.5">
            <Avatar src={article.author.avatarUrl} name={article.author.displayName} size="sm" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{article.author.displayName}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatDate(article.publishedAt)}</p>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {article.readTimeMinutes} phút đọc
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {article.viewCount} lượt xem
            </span>
          </div>
        </div>
      </header>

      {article.coverUrl && (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)]">
          <img src={article.coverUrl} alt={article.title} className="w-full max-h-[460px] object-cover" />
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <NewsContentRenderer content={article.content} />

        <div className="mt-8 flex items-center justify-between border-t border-[var(--border-subtle)] pt-5">
          <Button variant={article.isLiked ? 'warm' : 'outline'} size="sm" onClick={handleToggleLike}>
            <Heart className={`h-4 w-4 ${article.isLiked ? 'fill-current' : ''}`} />
            <span>Thích bài viết ({article.likesCount})</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                if (!navigator.clipboard?.writeText) {
                  toast.error('Trình duyệt không hỗ trợ sao chép');
                  return;
                }
                await navigator.clipboard.writeText(window.location.href);
                toast.success('Đã sao chép liên kết bài viết');
              } catch {
                toast.error('Không thể sao chép liên kết');
              }
            }}
          >
            <Share2 className="h-4 w-4" />
            Chia sẻ
          </Button>
        </div>
      </Card>

      <CommentSection
        title="Bình luận bài viết"
        comments={comments}
        totalCount={commentTotal}
        currentUserId={user?.id}
        currentUserRole={user?.role}
        reportTargetType={ReportTargetType.NEWS_COMMENT}
        allowSpoiler={false}
        isSubmitting={submitting}
        onSubmitComment={(c) => handleComment(c)}
        onSubmitReply={(pid, c) => handleComment(c, pid)}
        onDeleteComment={(cid) => handleDeleteComment(cid)}
      />

      {related.length > 0 && (
        <section className="space-y-4 pt-4">
          <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">Bài viết liên quan</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.id} href={`/news/${r.slug}`}>
                <Card padded={false} interactive className="overflow-hidden h-full">
                  {r.coverUrl && (
                    <img src={r.coverUrl} alt={r.title} className="aspect-video w-full object-cover" />
                  )}
                  <div className="p-3.5">
                    <h4 className="line-clamp-2 text-sm font-bold text-[var(--text-primary)]">{r.title}</h4>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
