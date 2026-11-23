'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Lock,
  Unlock,
  Coins,
  Play,
  Pause,
  MessageSquare,
  Sun,
  X,
  BookOpen,
  Layers,
  Columns2,
  ScrollText,
  Flag,
} from 'lucide-react';
import { ReportTargetType, type ChapterDetail, type ChapterSummary, type CommentItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import {
  useReaderSettingsStore,
  type ReaderMode,
  type ReaderTheme,
  type ReaderWidth,
} from '@/stores/reader-settings-store';
import { useToast } from '@/components/providers/toast-provider';
import { CommentSection } from '@/components/comments';
import { Button } from '@/components/ui/button';
import { ReportModal } from '@/components/ui/report-modal';

interface LoadedChapterBlock {
  detail: ChapterDetail;
  comments: CommentItem[];
  commentTotal: number;
  commentPage: number;
  commentHasNext: boolean;
}

const THEME_STYLES: Record<ReaderTheme, { bg: string; text: string; bar: string; border: string; label: string }> = {
  ink: {
    bg: 'bg-[#111318]',
    text: 'text-[#F2EFE9]',
    bar: 'bg-[#181B22]/92 text-[#F2EFE9]',
    border: 'border-[#272B36]',
    label: 'Đêm mực',
  },
  oled: {
    bg: 'bg-black',
    text: 'text-zinc-100',
    bar: 'bg-black/92 text-zinc-100',
    border: 'border-white/10',
    label: 'OLED Đen',
  },
  paper: {
    bg: 'bg-[#FAF8F5]',
    text: 'text-[#1F1D1A]',
    bar: 'bg-white/95 text-[#1F1D1A]',
    border: 'border-[#E8E3DC]',
    label: 'Giấy ấm',
  },
  sepia: {
    bg: 'bg-[#F3E9D2]',
    text: 'text-[#3D2E1E]',
    bar: 'bg-[#EFE3C8]/95 text-[#3D2E1E]',
    border: 'border-[#DFD0B2]',
    label: 'Sepia cổ điển',
  },
};

const WIDTH_CLASS: Record<ReaderWidth, string> = {
  narrow: 'max-w-xl',
  medium: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-full',
};

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const chapterIdParam = params?.chapterId as string;

  const { user, accessToken, isHydrated, fetchProfile } = useAuthStore();
  const { toast } = useToast();
  const settings = useReaderSettingsStore();

  const [blocks, setBlocks] = useState<LoadedChapterBlock[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingNext, setLoadingNext] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showBars, setShowBars] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [reportChapterTarget, setReportChapterTarget] = useState<{ id: string; label: string } | null>(null);
  const [allChapters, setAllChapters] = useState<ChapterSummary[]>([]);
  const [chapterFilter, setChapterFilter] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);

  const lastScrollY = useRef(0);
  const lastSavedRef = useRef('');
  const loadingNextRef = useRef(false);
  const lastTrackTimeRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const canAutoLoadNextRef = useRef(false);
  const autoScrollSpeedRef = useRef(0);

  const isNavTargetLocked = (
    nav?: { isPremium: boolean; priceCoins?: number; isUnlocked?: boolean } | null,
  ) => Boolean(nav && nav.isPremium && (nav.priceCoins ?? 0) > 0 && !nav.isUnlocked);

  useEffect(() => {
    settings.hydrate();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      useReaderSettingsStore.getState().update({ autoScrollSpeed: 0 });
    };
  }, []);

  const activeBlock = blocks.find((b) => b.detail.id === activeId) || blocks[0];
  const activeChapter = activeBlock?.detail || null;
  const lastBlock = blocks[blocks.length - 1];
  const anyOverlayOpen = Boolean(
    showSettings || showChapterDrawer || showCommentsModal || reportChapterTarget,
  );
  autoScrollSpeedRef.current = settings.autoScrollSpeed;
  canAutoLoadNextRef.current = Boolean(
    settings.autoLoadNext &&
    lastBlock &&
    !lastBlock.detail.isLocked &&
    lastBlock.detail.navigation.next &&
    !isNavTargetLocked(lastBlock.detail.navigation.next),
  );

  useEffect(() => {
    if ((activeChapter?.isLocked || anyOverlayOpen) && settings.autoScrollSpeed > 0) {
      useReaderSettingsStore.getState().update({ autoScrollSpeed: 0 });
    }
  }, [activeChapter?.isLocked, anyOverlayOpen, settings.autoScrollSpeed]);

  useEffect(() => {
    setAllChapters([]);
  }, [activeChapter?.comic.id, accessToken]);

  const fetchChapterBlock = useCallback(
    async (id: string, signal?: AbortSignal): Promise<LoadedChapterBlock> => {
      const chRes = await api.get<{ data: ChapterDetail }>(`/chapters/${id}`, {
        token: accessToken,
        signal,
      });

      if (chRes.data.isLocked) {
        return {
          detail: chRes.data,
          comments: [],
          commentTotal: 0,
          commentPage: 1,
          commentHasNext: false,
        };
      }

      const comRes = await api
        .get<{ data: CommentItem[]; meta: { total: number; hasNext: boolean } }>(
          `/comments/chapter/${id}?page=1`,
          { token: accessToken, signal },
        )
        .catch(() => ({ data: [], meta: { total: 0, hasNext: false } }));

      return {
        detail: chRes.data,
        comments: comRes.data || [],
        commentTotal: comRes.meta?.total || 0,
        commentPage: 1,
        commentHasNext: comRes.meta?.hasNext || false,
      };
    },
    [accessToken],
  );

  useEffect(() => {
    if (!chapterIdParam || !isHydrated) return;
    const controller = new AbortController();
    setLoading(true);
    setBlocks([]);
    lastSavedRef.current = '';
    loadingNextRef.current = false;
    setLoadingNext(false);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    fetchChapterBlock(chapterIdParam, controller.signal)
      .then((block) => {
        if (controller.signal.aborted) return;
        setBlocks([block]);
        setActiveId(block.detail.id);
        setCurrentPageIndex(0);
        if (progressBarRef.current) {
          progressBarRef.current.style.width = '0%';
        }
        window.scrollTo(0, 0);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBlocks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [chapterIdParam, isHydrated, user?.id, fetchChapterBlock]);

  // Save reading history
  const saveProgress = useCallback(
    (ch: ChapterDetail, pageNum: number) => {
      if (!ch || ch.isLocked) return;
      const saveKey = `${ch.id}:${pageNum}`;
      if (saveKey === lastSavedRef.current) return;
      lastSavedRef.current = saveKey;

      useReadingHistoryStore.getState().recordRead({
        comicId: ch.comic.id,
        comicSlug: ch.comic.slug,
        comicTitle: ch.comic.title,
        coverUrl: ch.comic.coverUrl,
        chapterId: ch.id,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        totalPages: ch.totalPages || ch.pages.length,
        lastPage: pageNum,
      });

      if (accessToken) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          api
            .post(
              '/history',
              {
                comicId: ch.comic.id,
                chapterId: ch.id,
                lastPage: pageNum,
                totalPages: ch.totalPages || ch.pages.length,
              },
              { token: accessToken },
            )
            .catch(() => {});
        }, 1800);
      }
    },
    [accessToken],
  );

  // Load next chapter in scroll mode (allows unlocked VIP chapters too)
  const loadNextInScroll = useCallback(async () => {
    if (loadingNextRef.current || !settings.autoLoadNext || blocks.length === 0) return;
    const tail = blocks[blocks.length - 1];
    if (tail.detail.isLocked) return;
    const nextNav = tail.detail.navigation?.next;
    if (!nextNav || blocks.some((b) => b.detail.id === nextNav.id)) return;
    if (isNavTargetLocked(nextNav)) return;

    loadingNextRef.current = true;
    setLoadingNext(true);
    try {
      const nextBlock = await fetchChapterBlock(nextNav.id);
      if (!nextBlock.detail.isLocked) {
        setBlocks((prev) =>
          prev.some((b) => b.detail.id === nextBlock.detail.id) ? prev : [...prev, nextBlock],
        );
      }
    } catch {
      // Ignore
    } finally {
      loadingNextRef.current = false;
      setLoadingNext(false);
    }
  }, [settings.autoLoadNext, blocks, fetchChapterBlock]);

  // IntersectionObserver fallback so bottom infinite-load fires reliably on short chapters & rapid swipes
  useEffect(() => {
    if (settings.mode !== 'scroll' || !settings.autoLoadNext) return;
    const el = bottomSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadNextInScroll();
        }
      },
      { rootMargin: '950px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [settings.mode, settings.autoLoadNext, loadNextInScroll]);

  // Scroll listener (direct DOM progress bar, bottom infinite-load check & throttled chapter/page tracking)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (progressBarRef.current && settings.mode === 'scroll') {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(100, Math.round((y / docHeight) * 100)) : 0;
        progressBarRef.current.style.width = `${pct}%`;
      }

      if (autoScrollSpeedRef.current <= 0) {
        if (y <= 60) setShowBars(true);
        else if (y > lastScrollY.current + 14) setShowBars(false);
        else if (y < lastScrollY.current - 14) setShowBars(true);
      }
      lastScrollY.current = y;

      if (
        settings.mode === 'scroll' &&
        document.documentElement.scrollHeight - (y + window.innerHeight) < 950
      ) {
        loadNextInScroll();
      }

      const now = performance.now();
      if (now - lastTrackTimeRef.current < 250) return;
      lastTrackTimeRef.current = now;

      if (settings.mode === 'scroll' && activeChapter) {
        // Track visible chapter block
        const blockEls = document.querySelectorAll('[data-chapter-block]');
        let currentVisibleId = activeId;
        blockEls.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.45 && rect.bottom >= 80) {
            const id = el.getAttribute('data-chapter-block');
            if (id) currentVisibleId = id;
          }
        });
        if (currentVisibleId && currentVisibleId !== activeId) {
          setActiveId(currentVisibleId);
          window.history.replaceState(null, '', `/read/${currentVisibleId}`);
        }

        // Track visible page
        const pageEls = document.querySelectorAll(`[data-ch-page="${currentVisibleId}"]`);
        let pageNum = 1;
        pageEls.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.55) {
            pageNum = Number(el.getAttribute('data-page-num') || 1);
          }
        });
        const targetBlock = blocks.find((b) => b.detail.id === currentVisibleId);
        if (targetBlock) saveProgress(targetBlock.detail, pageNum);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (activeChapter && !activeChapter.isLocked) {
      saveProgress(activeChapter, 1);
    }
    return () => window.removeEventListener('scroll', onScroll);
  }, [settings.mode, activeChapter, activeId, blocks, loadNextInScroll, saveProgress]);

  // Page/double mode progress tracking & progress bar sync
  useEffect(() => {
    if (settings.mode !== 'scroll' && activeChapter) {
      if (!activeChapter.isLocked) {
        saveProgress(activeChapter, currentPageIndex + 1);
      }
      if (progressBarRef.current) {
        const pct = Math.round(((currentPageIndex + 1) / Math.max(1, activeChapter.pages.length)) * 100);
        progressBarRef.current.style.width = `${pct}%`;
      }
    }
  }, [settings.mode, currentPageIndex, activeChapter, saveProgress]);

  // Strictly monotonic auto-scroll loop using virtualY + scrollingElement.scrollTop
  useEffect(() => {
    if (settings.autoScrollSpeed <= 0 || settings.mode !== 'scroll') return;

    const speedsPxPerSec = [0, 40, 80, 130, 190];
    const speedPx = speedsPxPerSec[settings.autoScrollSpeed] ?? 80;

    const scrollEl = document.scrollingElement || document.documentElement;
    const htmlEl = document.documentElement;
    const prevScrollBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = 'auto';

    let virtualY = scrollEl.scrollTop;
    let lastAppliedY = Math.floor(virtualY);
    let pausedByUser = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;
    let lastTime = performance.now();

    const clearResumeTimer = () => {
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = (delayMs: number) => {
      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        virtualY = scrollEl.scrollTop;
        lastAppliedY = Math.floor(virtualY);
        lastTime = performance.now();
        pausedByUser = false;
      }, delayMs);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-autoscroll-control]')) return;
      pausedByUser = true;
      clearResumeTimer();
    };

    const onTouchEnd = () => {
      if (pausedByUser) {
        scheduleResume(450);
      }
    };

    const onWheel = () => {
      pausedByUser = true;
      scheduleResume(350);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });

    const stepFrame = (now: number) => {
      const dt = Math.min(Math.max(0, now - lastTime), 64);
      lastTime = now;

      if (!pausedByUser) {
        const viewportH = window.innerHeight || htmlEl.clientHeight;
        const maxY = Math.max(0, scrollEl.scrollHeight - viewportH);

        if (maxY > 4 && virtualY >= maxY - 2) {
          if (!canAutoLoadNextRef.current) {
            useReaderSettingsStore.getState().update({ autoScrollSpeed: 0 });
            return;
          }
        } else {
          virtualY = Math.min(maxY, virtualY + (speedPx * dt) / 1000);
          const nextIntY = Math.floor(virtualY);
          if (nextIntY > lastAppliedY) {
            lastAppliedY = nextIntY;
            scrollEl.scrollTop = nextIntY;
          }
        }
      }

      rafId = window.requestAnimationFrame(stepFrame);
    };

    rafId = window.requestAnimationFrame(stepFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      clearResumeTimer();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('wheel', onWheel);
      htmlEl.style.scrollBehavior = prevScrollBehavior;
    };
  }, [settings.autoScrollSpeed, settings.mode]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reportChapterTarget) setReportChapterTarget(null);
        else if (showCommentsModal) setShowCommentsModal(false);
        else if (showChapterDrawer) setShowChapterDrawer(false);
        else if (showSettings) setShowSettings(false);
        return;
      }

      if (anyOverlayOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]')
      ) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        setShowChapterDrawer((v) => !v);
      } else if (e.key === 's' || e.key === 'S') {
        setShowSettings((v) => !v);
      } else if (settings.mode === 'scroll' && e.code === 'Space' && activeChapter && !activeChapter.isLocked) {
        e.preventDefault();
        settings.update({ autoScrollSpeed: settings.autoScrollSpeed > 0 ? 0 : 2 });
      } else if (settings.mode !== 'scroll' && activeChapter && !activeChapter.isLocked) {
        const step = settings.mode === 'double' ? 2 : 1;
        const maxIdx = Math.max(0, activeChapter.pages.length - 1);
        if (e.key === 'ArrowRight' || e.code === 'Space') {
          e.preventDefault();
          setCurrentPageIndex((p) => Math.min(p + step, maxIdx));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setCurrentPageIndex((p) => Math.max(p - step, 0));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    settings,
    activeChapter,
    anyOverlayOpen,
    showCommentsModal,
    showChapterDrawer,
    showSettings,
    reportChapterTarget,
  ]);

  const openChapterList = async () => {
    setShowChapterDrawer(true);
    if (allChapters.length === 0 && activeChapter) {
      try {
        const res = await api.get<{ data: ChapterSummary[] }>(
          `/comics/${activeChapter.comic.id}/chapters`,
          { token: accessToken },
        );
        setAllChapters(res.data || []);
      } catch {
        // Ignore
      }
    }
  };

  const handleUnlockChapter = async () => {
    if (!activeChapter) return;
    if (!accessToken) {
      router.push(`/login?redirect=/read/${activeChapter.id}`);
      return;
    }
    setUnlocking(true);
    try {
      await api.post(`/chapters/${activeChapter.id}/unlock`, {}, { token: accessToken });
      toast.success(`Đã mở khóa Chương ${activeChapter.number}!`);
      await fetchProfile();
      setAllChapters([]);
      const unlockedBlock = await fetchChapterBlock(activeChapter.id);
      setBlocks([unlockedBlock]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không đủ Xu để mở khóa chương này');
    } finally {
      setUnlocking(false);
    }
  };

  const handleChapterCommentSubmit = async (
    targetChapterId: string,
    content: string,
    isSpoiler: boolean,
    parentId?: string,
  ) => {
    if (!accessToken) return;
    setSubmittingComment(true);
    try {
      const res = await api.post<{ data: CommentItem }>(
        `/comments/chapter/${targetChapterId}`,
        { content, isSpoiler, parentId },
        { token: accessToken },
      );
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.detail.id !== targetChapterId) return b;
          if (parentId) {
            return {
              ...b,
              comments: b.comments.map((c) =>
                c.id === parentId ? { ...c, replies: [...(c.replies || []), res.data] } : c,
              ),
            };
          }
          return {
            ...b,
            comments: [res.data, ...b.comments],
            commentTotal: b.commentTotal + 1,
          };
        }),
      );
      toast.success('Đã gửi bình luận (+5 XP)');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi bình luận');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleChapterCommentLike = async (targetChapterId: string, commentId: string) => {
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
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.detail.id !== targetChapterId) return b;
          return {
            ...b,
            comments: b.comments.map((c) => {
              if (c.id === commentId) {
                return { ...c, isLiked: res.data.liked, likesCount: res.data.likesCount };
              }
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
          };
        }),
      );
    } catch {
      // Ignore
    }
  };

  const handleChapterCommentEdit = async (
    targetChapterId: string,
    commentId: string,
    content: string,
  ) => {
    if (!accessToken) return;
    try {
      await api.patch(`/comments/${commentId}`, { content }, { token: accessToken });
      setBlocks((prev) =>
        prev.map((b) =>
          b.detail.id !== targetChapterId
            ? b
            : {
              ...b,
              comments: b.comments.map((c) =>
                c.id === commentId
                  ? { ...c, content }
                  : { ...c, replies: c.replies?.map((r) => (r.id === commentId ? { ...r, content } : r)) },
              ),
            },
        ),
      );
      toast.success('Đã cập nhật bình luận');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể cập nhật bình luận');
    }
  };

  const handleChapterCommentDelete = async (
    targetChapterId: string,
    commentId: string,
    parentId?: string | null,
  ) => {
    if (!accessToken) return;
    try {
      await api.delete(`/comments/${commentId}`, { token: accessToken });
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.detail.id !== targetChapterId) return b;
          if (parentId) {
            return {
              ...b,
              comments: b.comments.map((c) =>
                c.id === parentId ? { ...c, replies: c.replies?.filter((r) => r.id !== commentId) } : c,
              ),
            };
          }
          return {
            ...b,
            comments: b.comments.filter((c) => c.id !== commentId),
            commentTotal: Math.max(0, b.commentTotal - 1),
          };
        }),
      );
      toast.info('Đã xóa bình luận');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xóa bình luận');
    }
  };

  const handleChapterCommentPin = async (
    targetChapterId: string,
    commentId: string,
    isPinned: boolean,
  ) => {
    if (!accessToken) return;
    try {
      await api.patch(`/comments/${commentId}`, { isPinned }, { token: accessToken });
      const comRes = await api.get<{ data: CommentItem[]; meta: { total: number; hasNext: boolean } }>(
        `/comments/chapter/${targetChapterId}?page=1`,
        { token: accessToken },
      );
      setBlocks((prev) =>
        prev.map((b) =>
          b.detail.id !== targetChapterId
            ? b
            : {
              ...b,
              comments: comRes.data || [],
              commentTotal: comRes.meta?.total || 0,
              commentPage: 1,
              commentHasNext: comRes.meta?.hasNext || false,
            },
        ),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể ghim bình luận');
    }
  };

  const handleChapterCommentLoadMore = async (targetChapterId: string) => {
    const target = blocks.find((b) => b.detail.id === targetChapterId);
    if (!target || !target.commentHasNext || loadingMoreComments) return;
    const nextPage = target.commentPage + 1;
    setLoadingMoreComments(true);
    try {
      const comRes = await api.get<{ data: CommentItem[]; meta: { total: number; hasNext: boolean } }>(
        `/comments/chapter/${targetChapterId}?page=${nextPage}`,
        { token: accessToken },
      );
      setBlocks((prev) =>
        prev.map((b) =>
          b.detail.id !== targetChapterId
            ? b
            : {
              ...b,
              comments: [...b.comments, ...(comRes.data || [])],
              commentTotal: comRes.meta?.total ?? b.commentTotal,
              commentPage: nextPage,
              commentHasNext: comRes.meta?.hasNext || false,
            },
        ),
      );
    } catch {
      // Ignore
    } finally {
      setLoadingMoreComments(false);
    }
  };

  const themeCfg = THEME_STYLES[settings.theme] || THEME_STYLES.ink;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111318] text-white">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent-warm)]" />
      </div>
    );
  }

  if (!activeChapter) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#111318] px-4 text-center text-white">
        <p className="font-serif text-xl font-bold">Không tìm thấy chương truyện</p>
        <Link href="/comics" className="mt-4">
          <Button variant="warm">Quay lại kho truyện</Button>
        </Link>
      </div>
    );
  }

  const filterStyle = {
    filter: `brightness(${settings.brightness}%) sepia(${settings.warmth}%)`,
  };

  return (
    <div className={`min-h-screen ${themeCfg.bg} ${themeCfg.text} select-none transition-colors duration-200`}>
      {/* Top Floating Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-50 border-b ${themeCfg.bar} ${themeCfg.border} backdrop-blur-xl transition-transform duration-300 ${showBars ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-2 px-3 sm:px-5">
          <Link
            href={`/comics/${activeChapter.comic.slug}`}
            className="inline-flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-2 min-w-0 rounded-xl border border-current/15 sm:border-transparent sm:px-0 text-sm font-medium opacity-90 hover:bg-current/5 sm:hover:bg-transparent hover:opacity-100"
            title={`Quay lại ${activeChapter.comic.title}`}
            aria-label={`Quay lại ${activeChapter.comic.title}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline truncate max-w-64 md:max-w-md">
              {activeChapter.comic.title}
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {settings.mode === 'scroll' && !activeChapter.isLocked && (
              <button
                type="button"
                data-autoscroll-control
                onClick={() => {
                  settings.update({ autoScrollSpeed: settings.autoScrollSpeed > 0 ? 0 : 2 });
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-xl border border-current/15 px-2.5 text-xs font-semibold cursor-pointer ${settings.autoScrollSpeed > 0 ? 'bg-[var(--accent-warm)] text-white border-transparent' : ''
                  }`}
                title="Tự động cuộn (Space)"
              >
                {settings.autoScrollSpeed > 0 ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Cuộn</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCommentsModal(true)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-current/15 px-2.5 text-xs font-semibold hover:bg-current/5 cursor-pointer"
              title="Bình luận chương"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{activeBlock?.commentTotal || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-current/15 hover:bg-current/5 cursor-pointer"
              title="Cài đặt (S)"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Progress Line */}
        <div className="h-0.5 w-full bg-current/10">
          <div
            ref={progressBarRef}
            className="h-full bg-[var(--accent-warm)]"
            style={{ width: '0%' }}
          />
        </div>
      </header>

      {/* Main Reader Surface */}
      <main
        style={{ overflowAnchor: 'none' }}
        className={`pt-14 pb-20 mx-auto ${WIDTH_CLASS[settings.width]}`}
        onClick={() => setShowBars((v) => !v)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {activeChapter.isLocked ? (
          <div className="mx-auto my-20 max-w-md px-4" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-3xl border border-current/15 bg-current/[0.04] p-7 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]">
                <Lock className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl font-bold">Chương Premium VIP</h2>
              <p className="text-sm opacity-80 leading-relaxed">
                Chương {activeChapter.number}
                {activeChapter.title ? ` (${activeChapter.title})` : ''} là nội dung ủng hộ tác giả. Mở khóa một lần để đọc vĩnh viễn!
              </p>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--accent-warm)]/30 bg-[var(--accent-warm-soft)] px-4 py-2 text-sm font-bold text-[var(--accent-warm)]">
                <Coins className="h-4 w-4" />
                <span>Giá mở khóa: {activeChapter.priceCoins} Xu</span>
              </div>
              {user && (
                <p className="text-xs opacity-70">
                  Số dư hiện tại của bạn: <strong>{user.coins.toLocaleString('vi-VN')} Xu</strong>
                </p>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="warm" size="lg" isLoading={unlocking} onClick={handleUnlockChapter}>
                  <Coins className="h-4 w-4" />
                  <span>
                    {user ? `Mở khóa ngay (${activeChapter.priceCoins} Xu)` : 'Đăng nhập để mở khóa'}
                  </span>
                </Button>
                <Link href="/cultivation">
                  <Button variant="ghost" size="sm" className="w-full">
                    Làm nhiệm vụ kiếm thêm Xu →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : settings.mode === 'scroll' ? (
          <div className="flex flex-col">
            {blocks.map((block) => (
              <div key={block.detail.id} data-chapter-block={block.detail.id}>
                <div
                  className="flex flex-col items-center"
                  style={{ gap: `${settings.pageGap}px`, overflowAnchor: 'none', ...filterStyle }}
                >
                  {block.detail.pages.map((page) => (
                    <img
                      key={page.id}
                      data-ch-page={block.detail.id}
                      data-page-num={page.pageNumber}
                      src={page.imageUrl}
                      alt={`Chương ${block.detail.number} - Trang ${page.pageNumber}`}
                      width={page.width || undefined}
                      height={page.height || undefined}
                      style={
                        page.width && page.height
                          ? { aspectRatio: `${page.width} / ${page.height}` }
                          : undefined
                      }
                      loading="lazy"
                      draggable={false}
                      className="w-full h-auto block"
                    />
                  ))}
                </div>

                {/* Chapter End Card */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mx-4 my-8 rounded-2xl border border-current/15 bg-current/[0.04] p-6 text-center space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent-warm)]">
                    Hoàn thành Chương {block.detail.number}
                  </p>
                  {(() => {
                    const nextNav = block.detail.navigation.next;
                    if (!nextNav) {
                      return <p className="text-sm opacity-75">Bạn đã đọc đến chương mới nhất của truyện.</p>;
                    }
                    const alreadyLoaded = blocks.some((b) => b.detail.id === nextNav.id);
                    if (alreadyLoaded) {
                      return (
                        <p className="text-sm font-medium opacity-80">
                          Tiếp theo bên dưới ↓ Chương {nextNav.number}
                          {nextNav.title ? ` — ${nextNav.title}` : ''}
                        </p>
                      );
                    }
                    const nextLocked = isNavTargetLocked(nextNav);
                    return (
                      <div className="space-y-3">
                        <p className="text-sm opacity-80">
                          Tiếp theo: Chương {nextNav.number}
                          {nextNav.title ? ` — ${nextNav.title}` : ''}
                        </p>
                        <Link href={`/read/${nextNav.id}`}>
                          <Button variant="warm" size="sm">
                            {nextLocked
                              ? `Mở Chương VIP tiếp theo (${nextNav.priceCoins} Xu) →`
                              : 'Đọc chương tiếp theo →'}
                          </Button>
                        </Link>
                      </div>
                    );
                  })()}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setReportChapterTarget({
                          id: block.detail.id,
                          label: `Chương ${block.detail.number} — ${block.detail.comic.title}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs opacity-65 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Báo lỗi / Báo cáo chương
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {loadingNext && (
              <div className="py-6 text-center text-xs opacity-70">Đang tải chương kế tiếp...</div>
            )}
            <div ref={bottomSentinelRef} className="h-4 w-full" aria-hidden="true" />
          </div>
        ) : (
          /* Single or Double Page Mode */
          <div
            className="flex min-h-[calc(100vh-110px)] flex-col items-center justify-center px-3 py-4"
            style={filterStyle}
          >
            {settings.mode === 'double' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                {activeChapter.pages.slice(currentPageIndex, currentPageIndex + 2).map((p) => (
                  <img
                    key={p.id}
                    src={p.imageUrl}
                    alt={`Trang ${p.pageNumber}`}
                    draggable={false}
                    className="max-h-[82vh] w-auto mx-auto rounded-lg object-contain"
                  />
                ))}
              </div>
            ) : (
              activeChapter.pages[currentPageIndex] && (
                <img
                  src={activeChapter.pages[currentPageIndex].imageUrl}
                  alt={`Trang ${currentPageIndex + 1}`}
                  draggable={false}
                  className="max-h-[84vh] w-auto rounded-lg object-contain"
                />
              )
            )}

            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-current/15 bg-current/[0.06] px-4 py-2 text-xs font-semibold"
            >
              <button
                type="button"
                disabled={currentPageIndex === 0}
                onClick={() =>
                  setCurrentPageIndex((p) => Math.max(0, p - (settings.mode === 'double' ? 2 : 1)))
                }
                className="disabled:opacity-30 cursor-pointer"
              >
                ← Trang trước
              </button>
              <span className="opacity-70">
                {currentPageIndex + 1} / {activeChapter.pages.length}
              </span>
              <button
                type="button"
                disabled={currentPageIndex >= activeChapter.pages.length - 1}
                onClick={() =>
                  setCurrentPageIndex((p) =>
                    Math.min(activeChapter.pages.length - 1, p + (settings.mode === 'double' ? 2 : 1)),
                  )
                }
                className="disabled:opacity-30 cursor-pointer"
              >
                Trang sau →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Auto-Scroll Quick Control Pill */}
      {settings.autoScrollSpeed > 0 && settings.mode === 'scroll' && !activeChapter.isLocked && (
        <div
          data-autoscroll-control
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-3 z-40 flex items-center gap-1 rounded-full border ${themeCfg.border} ${themeCfg.bar} px-2 py-1.5 text-xs font-bold shadow-xl backdrop-blur-xl transition-all duration-300 ${showBars ? 'bottom-16' : 'bottom-4'
            }`}
        >
          <button
            type="button"
            onClick={() => {
              const nextSpeed = settings.autoScrollSpeed >= 4 ? 1 : settings.autoScrollSpeed + 1;
              settings.update({ autoScrollSpeed: nextSpeed });
            }}
            className="rounded-full bg-current/10 px-2.5 py-1 hover:bg-current/20 cursor-pointer"
            title="Đổi tốc độ tự động cuộn"
          >
            {settings.autoScrollSpeed}x
          </button>
          <button
            type="button"
            onClick={() => settings.update({ autoScrollSpeed: 0 })}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-warm)] px-2.5 py-1 text-white hover:bg-[var(--accent-warm-hover)] cursor-pointer"
            title="Tạm dừng cuộn"
          >
            <Pause className="h-3 w-3" />
            <span>Dừng</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Navigation Bar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-50 border-t ${themeCfg.bar} ${themeCfg.border} backdrop-blur-xl transition-transform duration-300 ${showBars ? 'translate-y-0' : 'translate-y-full'
          }`}
      >
        <div className="mx-auto flex h-13 max-w-5xl items-center justify-between px-4 text-xs sm:text-sm font-semibold">
          {activeChapter.navigation.prev ? (
            <Link
              href={`/read/${activeChapter.navigation.prev.id}`}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 hover:bg-current/10"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Ch.{activeChapter.navigation.prev.number}</span>
            </Link>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={openChapterList}
            className="inline-flex items-center gap-1.5 rounded-xl border border-current/15 px-3.5 py-1.5 hover:bg-current/10 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Mục lục · Ch.{activeChapter.number}</span>
          </button>

          {lastBlock?.detail.navigation.next ? (
            <Link
              href={`/read/${lastBlock.detail.navigation.next.id}`}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-warm)] px-3.5 py-1.5 text-white hover:bg-[var(--accent-warm-hover)]"
            >
              <span>Ch.{lastBlock.detail.navigation.next.number}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </footer>

      {/* Settings Drawer Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-[var(--text-primary)] shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold">Cài đặt trình đọc</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Chế độ đọc
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'scroll', label: 'Cuộn dọc', icon: ScrollText },
                    { value: 'page', label: 'Từng trang', icon: Layers },
                    { value: 'double', label: 'Trang đôi', icon: Columns2 },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const active = settings.mode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => settings.update({ mode: m.value as ReaderMode })}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer ${active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Màu nền trình đọc
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(THEME_STYLES) as ReaderTheme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => settings.update({ theme: t })}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${settings.theme === t
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                  >
                    {THEME_STYLES[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Width */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Độ rộng khung tranh
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { k: 'narrow', l: 'Gọn' },
                    { k: 'medium', l: 'Chuẩn' },
                    { k: 'wide', l: 'Rộng' },
                    { k: 'full', l: 'Toàn màn' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.k}
                    type="button"
                    onClick={() => settings.update({ width: w.k })}
                    className={`rounded-xl border py-2 text-xs font-semibold cursor-pointer ${settings.width === w.k
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                  >
                    {w.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Brightness & Warmth */}
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Sun className="h-3.5 w-3.5" /> Độ sáng
                  </span>
                  <span>{settings.brightness}%</span>
                </div>
                <input
                  type="range"
                  min={55}
                  max={115}
                  value={settings.brightness}
                  onChange={(e) => settings.update({ brightness: Number(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">Lọc ánh sáng ấm (chống mỏi mắt)</span>
                  <span>{settings.warmth}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={settings.warmth}
                  onChange={(e) => settings.update({ warmth: Number(e.target.value) })}
                  className="w-full accent-[var(--accent-warm)]"
                />
              </div>
            </div>

            {/* Auto-scroll speed */}
            {settings.mode === 'scroll' && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Tốc độ tự động cuộn</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => settings.update({ autoScrollSpeed: sp })}
                      className={`h-7 min-w-8 rounded-lg px-2 text-xs font-bold cursor-pointer ${settings.autoScrollSpeed === sp
                        ? 'bg-[var(--accent-warm)] text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                        }`}
                    >
                      {sp === 0 ? 'Tắt' : `${sp}x`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chapter List Drawer */}
      {showChapterDrawer && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowChapterDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
              <h3 className="text-base font-bold">Mục lục chương</h3>
              <button
                type="button"
                onClick={() => setShowChapterDrawer(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-[var(--border-subtle)] px-5 py-3">
              <input
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                placeholder="Tìm số chương..."
                className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {allChapters
                .filter((ch) => !chapterFilter.trim() || String(ch.number).includes(chapterFilter.trim()))
                .map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/read/${ch.id}`}
                    onClick={() => setShowChapterDrawer(false)}
                    className={`flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-[var(--bg-subtle)] ${ch.id === activeId ? 'bg-[var(--accent-primary-soft)] font-bold text-[var(--accent-primary)]' : ''
                      }`}
                  >
                    <span className="truncate">
                      Chương {ch.number}
                      {ch.title ? ` — ${ch.title}` : ''}
                    </span>
                    {ch.isPremium && ch.priceCoins > 0 && (
                      ch.isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)] shrink-0">
                          <Unlock className="h-3 w-3" /> Đã mở
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-warm)] shrink-0">
                          <Lock className="h-3 w-3" /> {ch.priceCoins} Xu
                        </span>
                      )
                    )}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Chapter Comments Modal */}
      {showCommentsModal && activeBlock && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowCommentsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
              <h3 className="text-base font-bold">Bình luận Chương {activeBlock.detail.number}</h3>
              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {activeBlock.detail.isLocked ? (
                <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
                  Vui lòng mở khóa chương này để xem và tham gia bình luận.
                </div>
              ) : (
                <CommentSection
                  title={`Bình luận Chương ${activeBlock.detail.number}`}
                  comments={activeBlock.comments}
                  totalCount={activeBlock.commentTotal}
                  currentUserId={user?.id}
                  currentUserRole={user?.role}
                  comicAuthorId={activeBlock.detail.comic.authorId}
                  isSubmitting={submittingComment}
                  hasNext={activeBlock.commentHasNext}
                  isLoadingMore={loadingMoreComments}
                  onSubmitComment={(c, sp) => handleChapterCommentSubmit(activeBlock.detail.id, c, sp)}
                  onSubmitReply={(pid, c, sp) => handleChapterCommentSubmit(activeBlock.detail.id, c, sp, pid)}
                  onToggleLike={(cid) => handleChapterCommentLike(activeBlock.detail.id, cid)}
                  onEditComment={(cid, c) => handleChapterCommentEdit(activeBlock.detail.id, cid, c)}
                  onDeleteComment={(cid, pid) => handleChapterCommentDelete(activeBlock.detail.id, cid, pid)}
                  onPinComment={(cid, pinned) => handleChapterCommentPin(activeBlock.detail.id, cid, pinned)}
                  onLoadMore={() => handleChapterCommentLoadMore(activeBlock.detail.id)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {reportChapterTarget && (
        <ReportModal
          open={!!reportChapterTarget}
          onClose={() => setReportChapterTarget(null)}
          targetType={ReportTargetType.CHAPTER}
          targetId={reportChapterTarget.id}
          targetLabel={reportChapterTarget.label}
        />
      )}
    </div>
  );
}
