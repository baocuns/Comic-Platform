'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { formatRelativeTime, sanitizeSafeUrl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotificationsPage() {
  const { user, accessToken } = useAuthStore();
  const { items, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead, deleteItem } =
    useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (accessToken) {
      fetchNotifications(accessToken, 1);
    }
  }, [accessToken, fetchNotifications]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Đăng nhập để xem thông báo"
          description="Nhận thông báo tức thì khi truyện bạn theo dõi ra chương mới hoặc có bình luận phản hồi."
          action={
            <Link href="/login">
              <Button>Đăng nhập</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const displayed = filter === 'unread' ? items.filter((i) => !i.isRead) : items;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">Trung Tâm Thông Báo</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết tất cả thông báo'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1 cursor-pointer ${
                filter === 'all' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-lg px-3 py-1 cursor-pointer ${
                filter === 'unread' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>
          {unreadCount > 0 && accessToken && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead(accessToken)}>
              <CheckCheck className="h-4 w-4" />
              Đọc tất cả
            </Button>
          )}
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Không có thông báo nào"
          description="Khi có chương mới, lượt đánh giá hay phản hồi bình luận, mọi cập nhật sẽ hiển thị tại đây."
        />
      ) : (
        <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {displayed.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-4 transition-colors ${
                !n.isRead ? 'bg-[var(--accent-primary-soft)]/45' : ''
              }`}
            >
              <Link
                href={sanitizeSafeUrl(n.actionUrl, true) || '/notifications'}
                onClick={() => {
                  if (!n.isRead && accessToken) markAsRead(accessToken, n.id);
                }}
                className="min-w-0 flex-1 space-y-1"
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-2 w-2 rounded-full bg-[var(--accent-warm)] shrink-0" />}
                  <p className="text-sm font-bold text-[var(--text-primary)]">{n.title}</p>
                </div>
                {n.content && <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{n.content}</p>}
                <p className="text-[11px] text-[var(--text-muted)]">{formatRelativeTime(n.createdAt)}</p>
              </Link>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => deleteItem(accessToken, n.id)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                  title="Xóa thông báo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
