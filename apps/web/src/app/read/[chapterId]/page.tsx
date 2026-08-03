'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { CommentSection } from '@/components/comments';

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

interface ChapterItemData {
  chapter: Chapter;
  nav: Navigation;
  comments: Comment[];
  commentTotal: number;
  commentPage: number;
  commentHasNext: boolean;
  loadingMoreComments?: boolean;
}

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  // Loaded chapters list for infinite scroll
  const [loadedChapters, setLoadedChapters] = useState<ChapterItemData[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingNextChapter, setLoadingNextChapter] = useState(false);

  // Settings state
  const [readMode, setReadMode] = useState<'scroll' | 'page'>('scroll');
  const [autoLoadNext, setAutoLoadNext] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [readerWidth, setReaderWidth] = useState<'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl' | 'max-w-full'>('max-w-3xl');
  const [pageGap, setPageGap] = useState<string>('gap-0');
  const [bgColor, setBgColor] = useState<string>('bg-black');
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReaderBgDark = !['bg-white', 'bg-zinc-100', 'bg-[#f4ebd0]'].includes(bgColor);

  useEffect(() => {
    // Sync reader bg color with global theme on mount
    const isDark = document.documentElement.classList.contains('dark');
    setBgColor(isDark ? 'bg-black' : 'bg-white');
  }, []);

  // Comment input state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Chapter list modal
  const [showChapterList, setShowChapterList] = useState(false);
  const [allChapters, setAllChapters] = useState<ChapterListItem[]>([]);
  const [chapterSearch, setChapterSearch] = useState('');
  const chapterGridRef = useRef<HTMLDivElement>(null);

  // Active chapter object
  const activeItem = loadedChapters.find((item) => item.chapter.id === activeChapterId) || loadedChapters[0];
  const activeChapter = activeItem?.chapter || null;

  const handleOpenChapterList = useCallback(async () => {
    setShowChapterList(true);
    if (allChapters.length === 0 && activeChapter) {
      try {
        const r = await api.get<{ data: ChapterListItem[] }>(`/comics/${activeChapter.comic.id}/chapters`);
        setAllChapters(r.data);
      } catch { }
    }
  }, [allChapters.length, activeChapter]);

  // Scroll direction detection for header hide/show
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 50) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        setShowHeader(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initial chapter load
  useEffect(() => {
    if (!params.chapterId) return;
    const chId = params.chapterId as string;
    setLoading(true);
    Promise.all([
      api.get<{ data: Chapter }>(`/chapters/${chId}`),
      api.get<{ data: Navigation }>(`/chapters/${chId}/navigation`),
      api.get<{ data: Comment[]; meta: { total: number; hasNext: boolean } }>(`/comments/chapter/${chId}?page=1`).catch(() => ({ data: [], meta: { total: 0, hasNext: false } })),
    ])
      .then(([chRes, navRes, comRes]) => {
        const item: ChapterItemData = {
          chapter: chRes.data,
          nav: navRes.data,
          comments: comRes.data || [],
          commentTotal: comRes.meta?.total || 0,
          commentPage: 1,
          commentHasNext: comRes.meta?.hasNext || false,
        };
        setLoadedChapters([item]);
        setActiveChapterId(chRes.data.id);
        setCurrentPage(0);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [params.chapterId]);

  // Infinite scroll: auto load next chapter
  const loadNextChapter = useCallback(async () => {
    if (loadingNextChapter || !autoLoadNext || loadedChapters.length === 0) return;
    const lastItem = loadedChapters[loadedChapters.length - 1];
    if (!lastItem?.nav?.next) return;

    const nextId = lastItem.nav.next.id;
    if (loadedChapters.some((item) => item.chapter.id === nextId)) return;

    setLoadingNextChapter(true);
    try {
      const [chRes, navRes, comRes] = await Promise.all([
        api.get<{ data: Chapter }>(`/chapters/${nextId}`),
        api.get<{ data: Navigation }>(`/chapters/${nextId}/navigation`),
        api.get<{ data: Comment[]; meta: { total: number; hasNext: boolean } }>(`/comments/chapter/${nextId}?page=1`).catch(() => ({ data: [], meta: { total: 0, hasNext: false } })),
      ]);

      const newItem: ChapterItemData = {
        chapter: chRes.data,
        nav: navRes.data,
        comments: comRes.data || [],
        commentTotal: comRes.meta?.total || 0,
        commentPage: 1,
        commentHasNext: comRes.meta?.hasNext || false,
      };

      setLoadedChapters((prev) => [...prev, newItem]);
    } catch { }
    setLoadingNextChapter(false);
  }, [loadingNextChapter, autoLoadNext, loadedChapters]);

  // Trigger auto load next chapter when scrolling near bottom
  useEffect(() => {
    if (readMode !== 'scroll' || !autoLoadNext || loadingNextChapter) return;

    const handleScrollForNext = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (documentHeight - scrollPosition < 800) {
        loadNextChapter();
      }
    };

    window.addEventListener('scroll', handleScrollForNext, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollForNext);
  }, [readMode, autoLoadNext, loadingNextChapter, loadNextChapter]);

  // Track active chapter block and update URL seamlessly
  useEffect(() => {
    if (readMode !== 'scroll' || loadedChapters.length <= 1) return;

    const handleScrollActive = () => {
      const blocks = document.querySelectorAll('[data-chapter-block-id]');
      let currentId = activeChapterId;

      blocks.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.4 && rect.bottom >= 100) {
          const id = el.getAttribute('data-chapter-block-id');
          if (id) currentId = id;
        }
      });

      if (currentId && currentId !== activeChapterId) {
        setActiveChapterId(currentId);
        window.history.replaceState(null, '', `/read/${currentId}`);
      }
    };

    window.addEventListener('scroll', handleScrollActive, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollActive);
  }, [readMode, loadedChapters, activeChapterId]);

  // History tracking
  const lastSavedPage = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveHistory = useCallback((chapterObj: Chapter, pageNum: number) => {
    if (!accessToken || !chapterObj || pageNum === lastSavedPage.current) return;
    lastSavedPage.current = pageNum;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.post('/history', {
        comicId: chapterObj.comic.id,
        chapterId: chapterObj.id,
        lastPage: pageNum,
      }, { token: accessToken }).catch(() => { });
    }, 2000);
  }, [accessToken]);

  // Track page numbers for history in scroll mode
  useEffect(() => {
    if (readMode !== 'scroll' || !activeChapter || !activeChapter.pages.length) return;

    const handleScrollPage = () => {
      const pages = document.querySelectorAll(`[data-chapter-id="${activeChapter.id}"][data-page-number]`);
      let visiblePage = 1;
      pages.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2) {
          visiblePage = Number(el.getAttribute('data-page-number') || 1);
        }
      });
      saveHistory(activeChapter, visiblePage);
    };

    window.addEventListener('scroll', handleScrollPage, { passive: true });
    saveHistory(activeChapter, 1);
    return () => window.removeEventListener('scroll', handleScrollPage);
  }, [readMode, activeChapter, saveHistory]);

  // Track page changes in page mode
  useEffect(() => {
    if (readMode === 'page' && activeChapter) {
      saveHistory(activeChapter, currentPage + 1);
    }
  }, [currentPage, readMode, activeChapter, saveHistory]);

  // Keyboard navigation for page mode
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (readMode !== 'page' || !activeChapter) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      setCurrentPage((p) => Math.min(p + 1, activeChapter.pages.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentPage((p) => Math.max(p - 1, 0));
    }
  }, [readMode, activeChapter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Comment actions
  const postComment = async (targetChapterId: string, content: string, parentId?: string | null) => {
    if (!accessToken || !content.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await api.post<{ data: Comment }>(
        `/comments/chapter/${targetChapterId}`,
        { content: content.trim(), parentId },
        { token: accessToken },
      );

      setLoadedChapters((prev) =>
        prev.map((item) => {
          if (item.chapter.id !== targetChapterId) return item;
          if (parentId) {
            return {
              ...item,
              comments: item.comments.map((c) =>
                c.id === parentId
                  ? { ...c, replies: [...(c.replies || []), res.data], _count: { replies: (c._count?.replies || 0) + 1 } }
                  : c
              ),
            };
          } else {
            return {
              ...item,
              comments: [{ ...res.data, replies: [], _count: { replies: 0 } }, ...item.comments],
              commentTotal: item.commentTotal + 1,
            };
          }
        })
      );

      if (parentId) {
        setReplyingTo(null);
        setReplyContent('');
      } else {
        setNewComment('');
      }
    } catch { }
    setSubmittingComment(false);
  };

  const deleteComment = async (commentId: string, targetChapterId: string, parentId?: string | null) => {
    if (!accessToken || !confirm('Xóa bình luận này?')) return;
    try {
      await api.delete(`/comments/${commentId}`, { token: accessToken });
      setLoadedChapters((prev) =>
        prev.map((item) => {
          if (item.chapter.id !== targetChapterId) return item;
          if (parentId) {
            return {
              ...item,
              comments: item.comments.map((c) =>
                c.id === parentId
                  ? { ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }
                  : c
              ),
            };
          } else {
            return {
              ...item,
              comments: item.comments.filter((c) => c.id !== commentId),
              commentTotal: Math.max(0, item.commentTotal - 1),
            };
          }
        })
      );
    } catch { }
  };

  const loadMoreComments = async (targetChapterId: string) => {
    const item = loadedChapters.find((i) => i.chapter.id === targetChapterId);
    if (!item || item.loadingMoreComments || !item.commentHasNext) return;

    setLoadedChapters((prev) =>
      prev.map((i) => (i.chapter.id === targetChapterId ? { ...i, loadingMoreComments: true } : i))
    );

    try {
      const nextPage = item.commentPage + 1;
      const r = await api.get<{ data: Comment[]; meta: { total: number; hasNext: boolean } }>(
        `/comments/chapter/${targetChapterId}?page=${nextPage}`
      );
      setLoadedChapters((prev) =>
        prev.map((i) =>
          i.chapter.id === targetChapterId
            ? {
              ...i,
              comments: [...i.comments, ...r.data],
              commentHasNext: r.meta.hasNext,
              commentPage: nextPage,
              loadingMoreComments: false,
            }
            : i
        )
      );
    } catch {
      setLoadedChapters((prev) =>
        prev.map((i) => (i.chapter.id === targetChapterId ? { ...i, loadingMoreComments: false } : i))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
      </div>
    );
  }

  if (loadedChapters.length === 0 || !activeChapter) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Chương không tồn tại</div>;
  }

  const lastItem = loadedChapters[loadedChapters.length - 1];

  return (
    <>
      <div className={`min-h-screen ${bgColor} transition-colors duration-300 ${isReaderBgDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
        {/* Reader Header */}
        <div className={`sticky top-0 z-50 border-b transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'} ${
          isReaderBgDark ? 'border-white/10 bg-black/90 text-white' : 'border-zinc-200 bg-white/95 text-zinc-900 shadow-sm'
        } backdrop-blur-xl`}>
          <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
            <Link href={`/comics/${activeChapter.comic.slug}`} className={`text-sm flex items-center gap-1.5 transition-colors ${
              isReaderBgDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
            }`}>
              <i className="fa-light fa-arrow-left-long"></i>
              <span className="hidden sm:inline">{activeChapter.comic.title}</span>
            </Link>
            <button
              onClick={handleOpenChapterList}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${
                isReaderBgDark ? 'text-white hover:bg-white/10 hover:text-violet-300' : 'text-zinc-800 hover:bg-zinc-100 hover:text-violet-600'
              }`}>
              <span>Chương {activeChapter.number}{activeChapter.title ? ` — ${activeChapter.title}` : ''}</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  isReaderBgDark ? 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
                title="Cài đặt trình đọc">
                <i className="fa-regular fa-gear text-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Reader Content Area */}
        <div ref={containerRef} className={`mx-auto ${readerWidth} transition-all duration-200`}>
          {readMode === 'scroll' ? (
            /* Scroll Mode (Multi-Chapter Infinite Scroll) */
            <div className="flex flex-col">
              {loadedChapters.map((chItem, idx) => (
                <div key={chItem.chapter.id} data-chapter-block-id={chItem.chapter.id} className="chapter-block">
                  {/* Chapter Pages */}
                  <div className={`flex flex-col ${pageGap}`}>
                    {chItem.chapter.pages.map((page) => (
                      <img
                        key={page.id}
                        data-chapter-id={chItem.chapter.id}
                        data-page-number={page.pageNumber}
                        src={page.imageUrl}
                        alt={`Chương ${chItem.chapter.number} - Trang ${page.pageNumber}`}
                        className="w-full"
                        loading="lazy"
                        style={{ aspectRatio: page.width && page.height ? `${page.width}/${page.height}` : undefined }}
                      />
                    ))}
                  </div>

                  {/* Chapter End & Separator */}
                  <div className={`my-10 rounded-2xl border p-6 text-center backdrop-blur-xl ${
                    isReaderBgDark ? 'border-white/10 bg-white/[0.02]' : 'border-zinc-200 bg-zinc-50/50'
                  }`}>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                      🎉 Hết Chương {chItem.chapter.number}
                    </div>
                    {chItem.nav.next ? (
                      <p className={`text-xs ${isReaderBgDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Đoạn kế tiếp: <span className={`font-semibold ${isReaderBgDark ? 'text-white' : 'text-zinc-900'}`}>Chương {chItem.nav.next.number}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-555">Bạn đã đọc đến chương mới nhất của bộ truyện!</p>
                    )}
                  </div>

                  {/* Comments for this chapter */}
                  <div className="mt-8">
                    <CommentSection
                      comments={chItem.comments}
                      totalCount={chItem.commentTotal}
                      title={`Bình luận Chương ${chItem.chapter.number}`}
                      currentUser={user ? { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl } : null}
                      onSubmitComment={(content) => postComment(chItem.chapter.id, content)}
                      onSubmitReply={(parentId, content) => postComment(chItem.chapter.id, content, parentId)}
                      onDeleteComment={(commentId, parentId) => deleteComment(commentId, chItem.chapter.id, parentId)}
                      hasNext={chItem.commentHasNext}
                      isLoadingMore={chItem.loadingMoreComments}
                      onLoadMore={() => loadMoreComments(chItem.chapter.id)}
                      isSubmitting={submittingComment}
                      isReaderBgDark={isReaderBgDark}
                      accentColor="violet"
                    />
                  </div>

                  {idx < loadedChapters.length - 1 && (
                    <div className="my-12 h-px w-full bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
                  )}
                </div>
              ))}

              {/* Loading Indicator for Next Chapter */}
              {loadingNextChapter && (
                <div className={`my-8 flex items-center justify-center gap-3 py-6 text-sm ${isReaderBgDark ? 'text-violet-300' : 'text-violet-600'}`}>
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                  <span>Đang tải chương tiếp theo...</span>
                </div>
              )}
            </div>
          ) : (
            /* Page Mode (Single Page Step-by-Step) */
            <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center p-4">
              {activeChapter.pages[currentPage] && (
                <>
                  <img
                    src={activeChapter.pages[currentPage].imageUrl}
                    alt={`Trang ${currentPage + 1}`}
                    className="max-h-[85vh] w-auto object-contain"
                  />
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                      disabled={currentPage === 0}
                      className={`rounded-lg border px-4 py-2 text-sm disabled:opacity-30 ${
                        isReaderBgDark ? 'border-white/10 bg-white/5 text-zinc-400' : 'border-zinc-200 bg-white text-zinc-600'
                      }`}
                    >
                      ← Trang trước
                    </button>
                    <span className={`text-sm ${isReaderBgDark ? 'text-zinc-500' : 'text-zinc-650'}`}>
                      {currentPage + 1} / {activeChapter.pages.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, activeChapter.pages.length - 1))}
                      disabled={currentPage === activeChapter.pages.length - 1}
                      className={`rounded-lg border px-4 py-2 text-sm disabled:opacity-30 ${
                        isReaderBgDark ? 'border-white/10 bg-white/5 text-zinc-400' : 'border-zinc-200 bg-white text-zinc-600'
                      }`}
                    >
                      Trang sau →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className={`border-t backdrop-blur-xl ${
          isReaderBgDark ? 'border-white/10 bg-black/90 text-white' : 'border-zinc-200 bg-white/95 text-zinc-900 shadow-sm'
        }`}>
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            {activeItem?.nav?.prev ? (
              <Link
                href={`/read/${activeItem.nav.prev.id}`}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                  isReaderBgDark ? 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                }`}
              >
                ← Ch.{activeItem.nav.prev.number}
              </Link>
            ) : <div />}

            <button
              onClick={handleOpenChapterList}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                isReaderBgDark ? 'border-white/10 text-zinc-400 hover:text-white' : 'border-zinc-200 text-zinc-650 hover:text-zinc-900'
              }`}
            >
              Danh sách chương
            </button>

            {lastItem?.nav?.next ? (
              <Link
                href={`/read/${lastItem.nav.next.id}`}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white"
              >
                Ch.{lastItem.nav.next.number} →
              </Link>
            ) : <div />}
          </div>
        </div>
      </div>

      {/* Chapter List Modal */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300 ${showChapterList ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setShowChapterList(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-2xl transition-all duration-300 ${showChapterList ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
            }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">📋 Danh sách chương</h3>
            <button onClick={() => setShowChapterList(false)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xl leading-none">&times;</button>
          </div>

          {/* Search */}
          <div className="border-b border-zinc-200 dark:border-white/10 px-5 py-3">
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
              className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Chapter Grid */}
          <div ref={chapterGridRef} className="flex-1 overflow-y-auto p-5">
            {allChapters.length === 0 ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" /></div>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {allChapters.map((ch) => {
                  const isCurrent = ch.id === activeChapterId;
                  const matchSearch = chapterSearch && ch.number.toString() === chapterSearch.trim();
                  return (
                    <Link
                      key={ch.id}
                      href={`/read/${ch.id}`}
                      data-ch={ch.number}
                      onClick={() => setShowChapterList(false)}
                      className={`flex items-center justify-center rounded-lg border px-2 py-3 text-sm font-medium transition-all ${isCurrent
                        ? 'border-violet-500 bg-violet-600/20 text-violet-650 dark:text-violet-300'
                        : matchSearch
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-white'
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

      {/* Settings Modal */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300 ${showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setShowSettings(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`mx-4 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-2xl transition-all duration-300 ${showSettings ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
            }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <i className="fa-regular fa-gear text-base text-violet-500 dark:text-violet-400" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Cài đặt trình đọc</h3>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xl leading-none text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-800 dark:hover:text-white"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 overflow-y-auto p-5 text-sm text-zinc-700 dark:text-zinc-300">
            {/* Tự động tải chương tiếp theo */}
            <div>
              <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Cuộn đọc vô tận
              </label>
              <button
                onClick={() => setAutoLoadNext(!autoLoadNext)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 font-medium transition-all ${autoLoadNext
                  ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                  : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20'
                  }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span>⚡ Tự động tải chương tiếp theo</span>
                </div>
                <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${autoLoadNext ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                  <div className={`h-4 w-4 rounded-full bg-white transition-transform ${autoLoadNext ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            {/* Chế độ đọc */}
            <div>
              <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400">
                Chế độ hiển thị
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReadMode('scroll')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-medium transition-all ${readMode === 'scroll'
                    ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                    : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white'
                    }`}
                >
                  📜 Cuộn liên tục
                </button>
                <button
                  onClick={() => setReadMode('page')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-medium transition-all ${readMode === 'page'
                    ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                    : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white'
                    }`}
                >
                  📄 Theo từng trang
                </button>
              </div>
            </div>

            {/* Chiều rộng khung đọc */}
            <div>
              <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400">
                Chiều rộng khung đọc
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  { label: 'Nhỏ', value: 'max-w-xl' },
                  { label: 'Vừa', value: 'max-w-2xl' },
                  { label: 'Chuẩn', value: 'max-w-3xl' },
                  { label: 'Rộng', value: 'max-w-4xl' },
                  { label: 'Toàn màn', value: 'max-w-full' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setReaderWidth(item.value as any)}
                    className={`rounded-xl border py-2 text-xs font-medium transition-all ${readerWidth === item.value
                      ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Khoảng cách trang (chế độ cuộn) */}
            {readMode === 'scroll' && (
              <div>
                <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400">
                  Khoảng cách giữa các trang
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Không', value: 'gap-0' },
                    { label: 'Nhỏ', value: 'gap-2' },
                    { label: 'Vừa', value: 'gap-4' },
                    { label: 'Lớn', value: 'gap-6' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setPageGap(item.value)}
                      className={`rounded-xl border py-2 text-xs font-medium transition-all ${pageGap === item.value
                        ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                        : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white'
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Màu nền */}
            <div>
              <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400">
                Màu nền trình đọc
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Trắng tinh', value: 'bg-white' },
                  { label: 'Xám sáng', value: 'bg-zinc-100' },
                  { label: 'Màu kem', value: 'bg-[#f4ebd0]' },
                  { label: 'Đen tuyền', value: 'bg-black' },
                  { label: 'Đen xám', value: 'bg-zinc-950' },
                  { label: 'Xám tối', value: 'bg-zinc-900' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setBgColor(item.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${bgColor === item.value
                      ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white'
                      }`}
                  >
                    <span className={`h-3 w-3 rounded-full border border-black/10 dark:border-white/20 ${item.value}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

