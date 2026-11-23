'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bookmark, History, Trash2, Heart, BookOpen, Clock, Unlock, Coins, Receipt } from 'lucide-react';
import {
  ReadingListStatus,
  type BookmarkItem,
  type ChapterPurchaseItem,
  type HistoryItem,
  type PurchaseHistoryResponse,
} from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useReadingHistoryStore } from '@/stores/reading-history-store';
import { useToast } from '@/components/providers/toast-provider';
import { READING_LIST_LABEL, formatRelativeTime } from '@/lib/format';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function LibraryView({ defaultTab = 'bookmarks' }: { defaultTab?: 'bookmarks' | 'history' | 'unlocked' }) {
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();
  const localHistory = useReadingHistoryStore();

  const [tab, setTab] = useState<'bookmarks' | 'history' | 'unlocked'>(defaultTab);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [serverHistory, setServerHistory] = useState<HistoryItem[]>([]);
  const [unlockedChapters, setUnlockedChapters] = useState<ChapterPurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (accessToken) {
        if (tab === 'bookmarks') {
          const qs =
            statusFilter === 'FAVORITE'
              ? '?favoriteOnly=true'
              : statusFilter !== 'ALL'
                ? `?status=${statusFilter}`
                : '';
          const res = await api.get<{ data: BookmarkItem[] }>(`/bookmarks${qs}`, {
            token: accessToken,
            signal,
          });
          if (!signal?.aborted) setBookmarks(res.data || []);
        } else if (tab === 'unlocked') {
          const res = await api.get<{ data: PurchaseHistoryResponse }>('/chapters/purchases?limit=30', {
            token: accessToken,
            signal,
          });
          if (!signal?.aborted) setUnlockedChapters(res.data?.items || []);
        } else {
          const res = await api.get<{ data: HistoryItem[] }>('/history', {
            token: accessToken,
            signal,
          });
          if (!signal?.aborted) setServerHistory(res.data || []);
        }
      }
    } catch {
      // Ignore abort / network errors
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accessToken, tab, statusFilter]);

  useEffect(() => {
    localHistory.hydrate();
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleStatusChange = async (comicId: string, nextStatus: ReadingListStatus) => {
    if (!accessToken) return;
    try {
      await api.put(`/bookmarks/${comicId}`, { status: nextStatus }, { token: accessToken });
      setBookmarks((prev) => prev.map((b) => (b.comicId === comicId ? { ...b, status: nextStatus } : b)));
      toast.success(`Đã chuyển sang "${READING_LIST_LABEL[nextStatus]}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái');
    }
  };

  const handleRemoveBookmark = async (comicId: string) => {
    if (!accessToken) return;
    try {
      await api.delete(`/bookmarks/${comicId}`, { token: accessToken });
      setBookmarks((prev) => prev.filter((b) => b.comicId !== comicId));
      toast.info('Đã xóa khỏi tủ sách');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể xóa khỏi tủ sách');
    }
  };

  const handleClearHistory = async () => {
    localHistory.clearAll();
    if (accessToken) {
      await api.delete('/history', { token: accessToken }).catch(() => {});
      setServerHistory([]);
    }
    setConfirmClearOpen(false);
    toast.info('Đã xóa toàn bộ lịch sử đọc');
  };

  const localItems = localHistory.getAllSorted();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Tủ Sách & Lịch Sử</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Quản lý tiến độ đọc, phân loại danh sách truyện theo sở thích của bạn.
          </p>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'bookmarks', label: 'Tủ sách theo dõi', icon: <Bookmark className="h-4 w-4" /> },
            { value: 'unlocked', label: 'Đã mở khóa', icon: <Unlock className="h-4 w-4" /> },
            { value: 'history', label: 'Lịch sử đọc', icon: <History className="h-4 w-4" /> },
          ]}
        />
      </div>

      {tab === 'unlocked' ? (
        !user ? (
          <EmptyState
            icon={<Unlock className="h-6 w-6" />}
            title="Đăng nhập để xem Chương đã mở khóa"
            description="Toàn bộ các chương VIP bạn đã mua bằng Xu sẽ được lưu vĩnh viễn theo tài khoản."
            action={
              <Link href="/login">
                <Button>Đăng nhập ngay</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Các chương VIP bạn đã sở hữu vĩnh viễn
              </p>
              <Link
                href="/purchases"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Xem lịch sử giao dịch Xu →</span>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
                ))}
              </div>
            ) : unlockedChapters.length === 0 ? (
              <EmptyState
                icon={<Unlock className="h-6 w-6" />}
                title="Chưa mở khóa chương VIP nào"
                description="Các chương VIP đã mua sẽ xuất hiện tại đây để bạn đọc lại nhanh chóng."
                action={
                  <Link href="/comics">
                    <Button variant="warm">Khám phá truyện</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {unlockedChapters.map((p) => (
                  <Card key={p.id} className="flex gap-3.5 p-3.5">
                    <Link
                      href={`/read/${p.chapter.id}`}
                      className="h-24 w-18 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                    >
                      {p.chapter.comic.coverUrl && (
                        <img
                          src={p.chapter.comic.coverUrl}
                          alt={p.chapter.comic.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <Link
                          href={`/comics/${p.chapter.comic.slug}`}
                          className="line-clamp-1 text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                        >
                          {p.chapter.comic.title}
                        </Link>
                        <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                          Chương {p.chapter.number}
                          {p.chapter.title ? ` — ${p.chapter.title}` : ''}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent-warm)]">
                            <Coins className="h-3 w-3" />
                            {p.coinsSpent} Xu
                          </span>
                          <span>· {formatRelativeTime(p.createdAt)}</span>
                        </div>
                      </div>
                      <Link
                        href={`/read/${p.chapter.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)] hover:underline"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        Đọc ngay →
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      ) : tab === 'bookmarks' ? (
        !user ? (
          <EmptyState
            icon={<Bookmark className="h-6 w-6" />}
            title="Đăng nhập để đồng bộ Tủ sách"
            description="Tủ sách lưu trữ danh sách Đang đọc, Muốn đọc và thông báo chương mới theo tài khoản của bạn."
            action={
              <Link href="/login">
                <Button>Đăng nhập ngay</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: 'ALL', l: 'Tất cả' },
                { k: 'FAVORITE', l: 'Yêu thích ❤️' },
                ...Object.values(ReadingListStatus).map((st) => ({ k: st, l: READING_LIST_LABEL[st] })),
              ].map((f) => (
                <button
                  key={f.k}
                  type="button"
                  onClick={() => setStatusFilter(f.k)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    statusFilter === f.k
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-32 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
                ))}
              </div>
            ) : bookmarks.length === 0 ? (
              <EmptyState
                title="Chưa có bộ truyện nào trong danh sách này"
                description="Khám phá kho truyện và nhấn 'Lưu vào tủ sách' để theo dõi cập nhật."
                action={
                  <Link href="/comics">
                    <Button variant="warm">Khám phá truyện</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((b) => (
                  <Card key={b.id} className="flex gap-3.5 p-3.5">
                    <Link
                      href={`/comics/${b.comic.slug}`}
                      className="h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                    >
                      {b.comic.coverUrl && (
                        <img src={b.comic.coverUrl} alt={b.comic.title} className="h-full w-full object-cover" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <Link
                          href={`/comics/${b.comic.slug}`}
                          className="line-clamp-1 text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                        >
                          {b.comic.title}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">
                          {b.comic.author.displayName} · {b.comic.totalChapters} ch.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.comicId, e.target.value as ReadingListStatus)}
                          className="h-8 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 text-xs font-medium"
                        >
                          {Object.values(ReadingListStatus).map((st) => (
                            <option key={st} value={st}>
                              {READING_LIST_LABEL[st]}
                            </option>
                          ))}
                        </select>
                        {b.isFavorite && <Heart className="h-4 w-4 text-[var(--accent-warm)] fill-current shrink-0" />}
                        <button
                          type="button"
                          onClick={() => handleRemoveBookmark(b.comicId)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                          title="Xóa khỏi tủ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        /* History Tab */
        <div className="space-y-4">
          <div className="flex justify-end">
            {(serverHistory.length > 0 || localItems.length > 0) && (
              <Button variant="outline" size="sm" onClick={() => setConfirmClearOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Xóa toàn bộ lịch sử
              </Button>
            )}
          </div>

          {user && serverHistory.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {serverHistory.map((h) => (
                <Card key={h.id} className="flex gap-3.5 p-3.5">
                  <Link
                    href={`/read/${h.chapterId}`}
                    className="h-24 w-18 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-subtle)]"
                  >
                    {h.comic.coverUrl && (
                      <img src={h.comic.coverUrl} alt={h.comic.title} className="h-full w-full object-cover" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <Link
                        href={`/comics/${h.comic.slug}`}
                        className="line-clamp-1 text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {h.comic.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Chương {h.chapter.number} · Trang {h.lastPage}/{h.chapter.totalPages || '?'}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(h.readAt)}
                      </p>
                    </div>
                    <Link
                      href={`/read/${h.chapterId}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Đọc tiếp
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : localItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {localItems.map((h) => (
                <Card key={h.comicId} className="flex gap-3.5 p-3.5">
                  <Link href={`/read/${h.chapterId}`} className="h-24 w-18 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
                    {h.coverUrl && <img src={h.coverUrl} alt={h.comicTitle} className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/comics/${h.comicSlug}`} className="line-clamp-1 text-sm font-bold text-[var(--text-primary)]">
                        {h.comicTitle}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Chương {h.chapterNumber} · Trang {h.lastPage}/{h.totalPages || '?'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(h.updatedAt)}</p>
                    </div>
                    <Link href={`/read/${h.chapterId}`} className="text-xs font-semibold text-[var(--accent-primary)]">
                      Đọc tiếp →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="Lịch sử đọc trống"
              description="Các chương bạn đã đọc sẽ tự động được ghi lại tại đây."
              action={
                <Link href="/comics">
                  <Button>Bắt đầu đọc truyện</Button>
                </Link>
              }
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearHistory}
        title="Xóa toàn bộ lịch sử đọc?"
        description="Hành động này sẽ xóa toàn bộ tiến độ lịch sử đã lưu của bạn."
        confirmLabel="Xóa tất cả"
      />
    </div>
  );
}
