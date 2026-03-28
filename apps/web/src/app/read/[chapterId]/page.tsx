'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface ChapterListItem {
  id: string;
  number: string;
  title: string | null;
  publishedAt: string | null;
}

interface Page {
  id: string;
  pageNumber: number;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

interface Chapter {
  id: string;
  number: string;
  title: string | null;
  totalPages: number;
  comic: { id: string; title: string; slug: string };
  pages: Page[];
}

interface Navigation {
  prev: { id: string; number: string; title: string | null } | null;
  next: { id: string; number: string; title: string | null } | null;
}

interface CommentUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  parentId: string | null;
  replies?: Comment[];
  _count?: { replies: number };
}

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [nav, setNav] = useState<Navigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [readMode, setReadMode] = useState<'scroll' | 'page'>('scroll');
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [commentPage, setCommentPage] = useState(1);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  // Chapter list modal
  const [showChapterList, setShowChapterList] = useState(false);
  const [allChapters, setAllChapters] = useState<ChapterListItem[]>([]);
  const [chapterSearch, setChapterSearch] = useState('');
  const chapterGridRef = useRef<HTMLDivElement>(null);

  // History tracking
  const lastSavedPage = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!params.chapterId) return;
    setLoading(true);
    Promise.all([
      api.get<{ data: Chapter }>(`/chapters/${params.chapterId}`),
      api.get<{ data: Navigation }>(`/chapters/${params.chapterId}/navigation`),
    ])
      .then(([chRes, navRes]) => {
        setChapter(chRes.data);
        setNav(navRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load comments (page 1)
    api.get<{ data: Comment[]; meta: { total: number; hasNext: boolean } }>(`/comments/chapter/${params.chapterId}?page=1`)
      .then((r) => {
        setComments(r.data);
        setCommentHasNext(r.meta.hasNext);
        setCommentTotal(r.meta.total);
        setCommentPage(1);
      })
      .catch(() => {});
  }, [params.chapterId]);

  // Save reading history (debounced)
  const saveHistory = useCallback((pageNum: number) => {
    if (!accessToken || !chapter || pageNum === lastSavedPage.current) return;
    lastSavedPage.current = pageNum;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.post('/history', {
        comicId: chapter.comic.id,
        chapterId: chapter.id,
        lastPage: pageNum,
      }, { token: accessToken }).catch(() => {});
    }, 2000);
  }, [accessToken, chapter]);

  // Track scroll position for history in scroll mode
  useEffect(() => {
    if (readMode !== 'scroll' || !chapter || !chapter.pages.length) return;

    const handleScroll = () => {
      const pages = document.querySelectorAll('[data-page-number]');
      let visiblePage = 1;
      pages.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2) {
          visiblePage = Number(el.getAttribute('data-page-number') || 1);
        }
      });
      saveHistory(visiblePage);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Save first page on mount
    saveHistory(1);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [readMode, chapter, saveHistory]);

  // Track page changes in page mode
  useEffect(() => {
    if (readMode === 'page' && chapter) {
      saveHistory(currentPage + 1);
    }
  }, [currentPage, readMode, chapter, saveHistory]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (readMode !== 'page' || !chapter) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      setCurrentPage((p) => Math.min(p + 1, chapter.pages.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentPage((p) => Math.max(p - 1, 0));
    }
  }, [readMode, chapter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Comment actions
  const postComment = async (parentId?: string) => {
    if (!accessToken || !chapter) return;
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await api.post<{ data: Comment }>(
        `/comments/chapter/${chapter.id}`,
        { content: content.trim(), parentId },
        { token: accessToken },
      );

      if (parentId) {
        // Add reply to parent
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...(c.replies || []), res.data], _count: { replies: (c._count?.replies || 0) + 1 } }
              : c,
          ),
        );
        setReplyingTo(null);
        setReplyContent('');
      } else {
        // Add as new top-level comment
        setComments((prev) => [{ ...res.data, replies: [], _count: { replies: 0 } }, ...prev]);
        setNewComment('');
      }
    } catch {}
    setSubmittingComment(false);
  };

  const deleteComment = async (commentId: string, parentId?: string | null) => {
    if (!accessToken || !confirm('Xóa bình luận này?')) return;
    try {
      await api.delete(`/comments/${commentId}`, { token: accessToken });
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }
              : c,
          ),
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch {}
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>;
  if (!chapter) return <div className="flex min-h-screen items-center justify-center text-zinc-500">Chương không tồn tại</div>;

  return (
    <>
    <div className="min-h-screen bg-black">
      {/* Reader Header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <Link href={`/comics/${chapter.comic.slug}`} className="text-sm text-zinc-400 hover:text-white">
            ← {chapter.comic.title}
          </Link>
          <span className="text-sm font-medium text-white">
            Chương {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReadMode(readMode === 'scroll' ? 'page' : 'scroll')}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 hover:text-white"
            >
              {readMode === 'scroll' ? '📜 Cuộn' : '📄 Trang'}
            </button>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div ref={containerRef} className="mx-auto max-w-3xl">
        {readMode === 'scroll' ? (
          <div className="flex flex-col">
            {chapter.pages.map((page) => (
              <img
                key={page.id}
                data-page-number={page.pageNumber}
                src={page.imageUrl}
                alt={`Trang ${page.pageNumber}`}
                className="w-full"
                loading="lazy"
                style={{ aspectRatio: page.width && page.height ? `${page.width}/${page.height}` : undefined }}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center p-4">
            {chapter.pages[currentPage] && (
              <>
                <img
                  src={chapter.pages[currentPage].imageUrl}
                  alt={`Trang ${currentPage + 1}`}
                  className="max-h-[85vh] w-auto object-contain"
                />
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                    disabled={currentPage === 0}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 disabled:opacity-30"
                  >
                    ← Trang trước
                  </button>
                  <span className="text-sm text-zinc-500">
                    {currentPage + 1} / {chapter.pages.length}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, chapter.pages.length - 1))}
                    disabled={currentPage === chapter.pages.length - 1}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 disabled:opacity-30"
                  >
                    Trang sau →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <h3 className="mb-4 text-lg font-semibold text-white">💬 Bình luận ({commentTotal})</h3>

            {/* New Comment Form */}
            {user ? (
              <div className="mb-6">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                    {user.displayName?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Viết bình luận..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => postComment()}
                        disabled={!newComment.trim() || submittingComment}
                        className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {submittingComment ? 'Đang gửi...' : 'Gửi'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-zinc-500">
                <Link href="/login" className="text-violet-400 hover:underline">Đăng nhập</Link> để bình luận
              </div>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    replyingTo={replyingTo}
                    replyContent={replyContent}
                    submitting={submittingComment}
                    onReply={(id) => { setReplyingTo(replyingTo === id ? null : id); setReplyContent(''); }}
                    onReplyContentChange={setReplyContent}
                    onPostReply={(parentId) => postComment(parentId)}
                    onDelete={deleteComment}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {commentHasNext && (
              <button
                onClick={async () => {
                  if (!chapter || loadingMoreComments) return;
                  setLoadingMoreComments(true);
                  const nextPage = commentPage + 1;
                  try {
                    const r = await api.get<{ data: Comment[]; meta: { hasNext: boolean } }>(`/comments/chapter/${chapter.id}?page=${nextPage}`);
                    setComments((prev) => [...prev, ...r.data]);
                    setCommentHasNext(r.meta.hasNext);
                    setCommentPage(nextPage);
                  } catch {}
                  setLoadingMoreComments(false);
                }}
                disabled={loadingMoreComments}
                className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm text-zinc-400 hover:border-violet-500/30 hover:text-white disabled:opacity-50"
              >
                {loadingMoreComments ? 'Đang tải...' : 'Xem thêm bình luận'}
              </button>
            )}
          </div>
        </div>

      {/* Navigation Footer */}
      <div className="border-t border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {nav?.prev ? (
            <Link
              href={`/read/${nav.prev.id}`}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              ← Ch.{nav.prev.number}
            </Link>
          ) : <div />}

          <button
            onClick={async () => {
              setShowChapterList(true);
              if (allChapters.length === 0 && chapter) {
                try {
                  const r = await api.get<{ data: ChapterListItem[] }>(`/comics/${chapter.comic.id}/chapters`);
                  setAllChapters(r.data);
                } catch {}
              }
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            📋 Danh sách chương
          </button>

          {nav?.next ? (
            <Link
              href={`/read/${nav.next.id}`}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white"
            >
              Ch.{nav.next.number} →
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>

    {/* Chapter List Modal */}
    {showChapterList && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowChapterList(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">📋 Danh sách chương</h3>
            <button onClick={() => setShowChapterList(false)} className="text-zinc-500 hover:text-white text-xl leading-none">&times;</button>
          </div>

          {/* Search */}
          <div className="border-b border-white/10 px-5 py-3">
            <input
              value={chapterSearch}
              onChange={(e) => {
                setChapterSearch(e.target.value);
                const num = e.target.value.trim();
                if (num && chapterGridRef.current) {
                  const el = chapterGridRef.current.querySelector(`[data-ch="${num}"]`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              placeholder="Nhập số chương để tìm..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Chapter Grid */}
          <div ref={chapterGridRef} className="flex-1 overflow-y-auto p-5">
            {allChapters.length === 0 ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {allChapters.map((ch) => {
                  const isCurrent = ch.id === params.chapterId;
                  const matchSearch = chapterSearch && ch.number.toString() === chapterSearch.trim();
                  return (
                    <Link
                      key={ch.id}
                      href={`/read/${ch.id}`}
                      data-ch={ch.number}
                      onClick={() => setShowChapterList(false)}
                      className={`flex items-center justify-center rounded-lg border px-2 py-3 text-sm font-medium transition-all ${
                        isCurrent
                          ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                          : matchSearch
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-violet-500/30 hover:text-white'
                      }`}
                      title={ch.title ? `Ch.${ch.number}: ${ch.title}` : `Chương ${ch.number}`}
                    >
                      {ch.number}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}

// ── Comment Component ──

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  replyingTo: string | null;
  replyContent: string;
  submitting: boolean;
  onReply: (id: string) => void;
  onReplyContentChange: (v: string) => void;
  onPostReply: (parentId: string) => void;
  onDelete: (id: string, parentId?: string | null) => void;
}

function CommentItem({ comment, currentUserId, replyingTo, replyContent, submitting, onReply, onReplyContentChange, onPostReply, onDelete }: CommentItemProps) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      {/* Main comment */}
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
          {comment.user.avatarUrl ? (
            <img src={comment.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            comment.user.displayName[0]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{comment.user.displayName}</span>
            <span className="text-xs text-zinc-600">{new Date(comment.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-400 whitespace-pre-line">{comment.content}</p>
          <div className="mt-2 flex items-center gap-3">
            {currentUserId && (
              <button onClick={() => onReply(comment.id)} className="text-xs text-zinc-500 hover:text-violet-400">
                {replyingTo === comment.id ? 'Hủy' : '↩ Trả lời'}
              </button>
            )}
            {currentUserId === comment.user.id && (
              <button onClick={() => onDelete(comment.id)} className="text-xs text-zinc-500 hover:text-red-400">
                Xóa
              </button>
            )}
            {(comment._count?.replies || 0) > 0 && (
              <span className="text-xs text-zinc-600">{comment._count!.replies} trả lời</span>
            )}
          </div>
        </div>
      </div>

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="mt-3 ml-11 flex gap-2">
          <input
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Trả lời..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onPostReply(comment.id); } }}
          />
          <button
            onClick={() => onPostReply(comment.id)}
            disabled={!replyContent.trim() || submitting}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Gửi
          </button>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-11 space-y-3 border-l border-white/5 pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-xs font-bold text-zinc-400">
                {reply.user.avatarUrl ? (
                  <img src={reply.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  reply.user.displayName[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{reply.user.displayName}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(reply.createdAt).toLocaleDateString('vi-VN')}</span>
                  {currentUserId === reply.user.id && (
                    <button onClick={() => onDelete(reply.id, comment.id)} className="text-[10px] text-zinc-600 hover:text-red-400">
                      Xóa
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-400">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
