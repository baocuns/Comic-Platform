'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, BookOpen, MessageSquare, Star, Award, Sparkles, UserPlus } from 'lucide-react';
import { NotificationType } from 'shared';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { formatRelativeTime, sanitizeSafeUrl } from '@/lib/format';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.NEW_CHAPTER:
      return <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />;
    case NotificationType.COMMENT_REPLY:
    case NotificationType.COMMENT_LIKE:
    case NotificationType.NEWS_COMMENT:
      return <MessageSquare className="h-4 w-4 text-[var(--accent-warm)]" />;
    case NotificationType.RATING_RECEIVED:
      return <Star className="h-4 w-4 text-[var(--warning)]" />;
    case NotificationType.ACHIEVEMENT:
      return <Award className="h-4 w-4 text-[var(--success)]" />;
    case NotificationType.FOLLOW_NEW:
      return <UserPlus className="h-4 w-4 text-[var(--accent-primary)]" />;
    default:
      return <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />;
  }
}

export function NotificationBell() {
  const { accessToken } = useAuthStore();
  const { items, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && accessToken) {
      fetchNotifications(accessToken);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
        aria-label="Thông báo"
        title="Thông báo"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-warm)] px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl z-50 animate-slide-up">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--accent-warm-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-warm)]">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && accessToken && (
              <button
                type="button"
                onClick={() => markAllAsRead(accessToken)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {isLoading && items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">Đang tải thông báo...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">Chưa có thông báo nào</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Theo dõi truyện để nhận tin chương mới ngay lập tức.
                </p>
              </div>
            ) : (
              items.slice(0, 8).map((item) => {
                const href = sanitizeSafeUrl(item.actionUrl, true) || '/notifications';
                return (
                  <Link
                    key={item.id}
                    href={href}
                    prefetch={false}
                    onClick={() => {
                      if (!item.isRead && accessToken) markAsRead(accessToken, item.id);
                      setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-subtle)] ${
                      !item.isRead ? 'bg-[var(--accent-primary-soft)]/50' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)]">
                      {getNotificationIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2">
                        {item.title}
                      </p>
                      {item.content && (
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2">
                          {item.content}
                        </p>
                      )}
                      <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    {!item.isRead && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-warm)]" />
                    )}
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 py-2.5 text-center text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
