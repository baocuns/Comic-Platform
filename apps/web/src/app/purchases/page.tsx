'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Coins,
  History,
  Receipt,
  Search,
  Sparkles,
  Unlock,
  Wallet,
} from 'lucide-react';
import type {
  ChapterPurchaseItem,
  PaginationMeta,
  PurchaseHistoryResponse,
  PurchaseHistorySummary,
  RewardTransactionItem,
} from 'shared';
import { api } from '@/lib/api-client';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';

const SOURCE_LABELS: Record<string, string> = {
  unlock_chapter: 'Mở khóa chương VIP',
  daily_checkin: 'Điểm danh hàng ngày',
  quest_claim: 'Thưởng nhiệm vụ Tu Luyện',
  level_up: 'Thưởng đột phá cảnh giới',
  author_revenue: 'Doanh thu tác giả',
  welcome_bonus: 'Quà tân thủ',
  comment_reward: 'Thưởng bình luận',
  rating_reward: 'Thưởng đánh giá',
};

export default function PurchasesPage() {
  const { user, accessToken } = useAuthStore();
  const [tab, setTab] = useState<'unlocked' | 'transactions'>('unlocked');

  // Unlocked chapters state
  const [purchases, setPurchases] = useState<ChapterPurchaseItem[]>([]);
  const [summary, setSummary] = useState<PurchaseHistorySummary | null>(null);
  const [purchaseMeta, setPurchaseMeta] = useState<PaginationMeta | null>(null);
  const [purchasePage, setPurchasePage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  // Coin ledger state
  const [transactions, setTransactions] = useState<RewardTransactionItem[]>([]);
  const [txMeta, setTxMeta] = useState<PaginationMeta | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [loadingTx, setLoadingTx] = useState(false);

  const loadPurchases = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return;
    setLoadingPurchases(true);
    try {
      const params = new URLSearchParams({
        page: String(purchasePage),
        limit: '15',
      });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await api.get<{ data: PurchaseHistoryResponse }>(
        `/chapters/purchases?${params.toString()}`,
        { token: accessToken, signal },
      );
      if (!signal?.aborted) {
        setPurchases(res.data?.items || []);
        setSummary(res.data?.summary || null);
        setPurchaseMeta(res.data?.meta || null);
      }
    } catch {
      // Ignore abort / network errors
    } finally {
      if (!signal?.aborted) setLoadingPurchases(false);
    }
  }, [accessToken, purchasePage, searchQuery]);

  const loadTransactions = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return;
    setLoadingTx(true);
    try {
      const res = await api.get<{ data: RewardTransactionItem[]; meta: PaginationMeta }>(
        `/gamification/transactions?currency=COIN&page=${txPage}&limit=20`,
        { token: accessToken, signal },
      );
      if (!signal?.aborted) {
        setTransactions(res.data || []);
        setTxMeta(res.meta || null);
      }
    } catch {
      // Ignore
    } finally {
      if (!signal?.aborted) setLoadingTx(false);
    }
  }, [accessToken, txPage]);

  useEffect(() => {
    if (!accessToken) {
      setLoadingPurchases(false);
      return;
    }
    const controller = new AbortController();
    loadPurchases(controller.signal);
    return () => controller.abort();
  }, [accessToken, loadPurchases]);

  useEffect(() => {
    if (accessToken && tab === 'transactions') {
      const controller = new AbortController();
      loadTransactions(controller.signal);
      return () => controller.abort();
    }
  }, [accessToken, tab, loadTransactions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPurchasePage(1);
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPurchasePage(1);
    setSearchQuery(searchInput.trim());
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="Đăng nhập để xem Lịch sử mua hàng"
          description="Theo dõi các chương VIP bạn đã mở khóa và toàn bộ lịch sử biến động Xu Linh Thạch."
          action={
            <Link href="/login?redirect=/purchases">
              <Button>Đăng nhập ngay</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-warm)]">
            <Receipt className="h-4 w-4" />
            Ví Xu & Giao Dịch
          </p>
          <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">
            Lịch Sử Mua Hàng
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Danh sách các chương VIP đã mở khóa vĩnh viễn và sao kê thu chi Xu Linh Thạch.
          </p>
        </div>

        <Link href="/cultivation">
          <Button variant="warm" size="sm">
            <Sparkles className="h-4 w-4" />
            <span>Kiếm thêm Xu</span>
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Số dư Xu hiện tại</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {(summary?.currentCoins ?? user.coins).toLocaleString('vi-VN')} Xu
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
            <Unlock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Chương VIP đã mở</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {summary?.totalUnlockedChapters ?? 0}{' '}
              <span className="text-xs font-medium text-[var(--text-muted)]">
                ({summary?.uniqueComicsCount ?? 0} truyện)
              </span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Tổng Xu đã chi mở khóa</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {(summary?.totalCoinsSpent ?? 0).toLocaleString('vi-VN')} Xu
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: 'unlocked',
            label: 'Chương đã mở khóa',
            icon: <Unlock className="h-4 w-4" />,
            badge: summary?.totalUnlockedChapters,
          },
          {
            value: 'transactions',
            label: 'Biến động Xu',
            icon: <History className="h-4 w-4" />,
          },
        ]}
      />

      {tab === 'unlocked' ? (
        <div className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên truyện, tên chương hoặc số chương..."
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-10">
                Tìm kiếm
              </Button>
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                    setPurchasePage(1);
                  }}
                >
                  Đặt lại
                </Button>
              )}
            </div>
          </form>

          {loadingPurchases ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
              ))}
            </div>
          ) : purchases.length === 0 ? (
            <EmptyState
              icon={<Unlock className="h-6 w-6" />}
              title={searchQuery ? 'Không tìm thấy giao dịch phù hợp' : 'Bạn chưa mở khóa chương VIP nào'}
              description={
                searchQuery
                  ? 'Thử tìm bằng từ khóa hoặc tên truyện khác.'
                  : 'Khi mở khóa các chương VIP bằng Xu, hóa đơn chi tiết sẽ hiển thị tại đây để bạn tiện theo dõi và đọc lại bất cứ lúc nào.'
              }
              action={
                <Link href="/comics">
                  <Button variant="warm">Khám phá kho truyện</Button>
                </Link>
              }
            />
          ) : (
            <>
              <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Link
                        href={`/comics/${p.chapter.comic.slug}`}
                        className="h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                      >
                        {p.chapter.comic.coverUrl && (
                          <img
                            src={p.chapter.comic.coverUrl}
                            alt={p.chapter.comic.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </Link>

                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/comics/${p.chapter.comic.slug}`}
                          className="line-clamp-1 text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                        >
                          {p.chapter.comic.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[var(--text-secondary)]">
                            Chương {p.chapter.number}
                            {p.chapter.title ? ` — ${p.chapter.title}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                            <Unlock className="h-2.5 w-2.5" />
                            Đã mở khóa
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Mua lúc {formatDate(p.createdAt)} · {formatRelativeTime(p.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0 border-t border-[var(--border-subtle)] pt-2.5 sm:border-0 sm:pt-0">
                      <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-warm-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-warm)]">
                        <Coins className="h-3.5 w-3.5" />
                        -{p.coinsSpent} Xu
                      </span>
                      <Link href={`/read/${p.chapter.id}`}>
                        <Button size="sm" variant="primary">
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Đọc ngay</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </Card>

              {purchaseMeta && purchaseMeta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-muted)]">
                  <span>
                    Trang {purchaseMeta.page} / {purchaseMeta.totalPages} ({purchaseMeta.total} mục)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={purchasePage <= 1}
                      onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                    >
                      ← Trước
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={!purchaseMeta.hasNext}
                      onClick={() => setPurchasePage((p) => p + 1)}
                    >
                      Sau →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : loadingTx ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<Coins className="h-6 w-6" />}
          title="Chưa có giao dịch Xu nào"
          description="Điểm danh mỗi ngày hoặc hoàn thành nhiệm vụ để nhận Xu Linh Thạch."
          action={
            <Link href="/cultivation">
              <Button>Điểm danh ngay</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {tx.note || SOURCE_LABELS[tx.source] || tx.source}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {SOURCE_LABELS[tx.source] || tx.source} · {formatRelativeTime(tx.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`inline-flex items-center gap-1 text-sm font-bold ${
                      tx.amount >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} Xu
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Số dư: {tx.balanceAfter.toLocaleString('vi-VN')} Xu
                  </p>
                </div>
              </div>
            ))}
          </Card>

          {txMeta && txMeta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-muted)]">
              <span>
                Trang {txMeta.page} / {txMeta.totalPages} ({txMeta.total} giao dịch)
              </span>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  ← Trước
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!txMeta.hasNext}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  Sau →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
