'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore, NotificationType, NotificationItem } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';

// ── Notification type config ──

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: string; color: string; bg: string; label: string }> = {
  COMMENT_REPLY: { icon: 'fa-comment', color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Bình luận' },
  RATING_RECEIVED: { icon: 'fa-star', color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Đánh giá' },
  NEW_CHAPTER: { icon: 'fa-book-open', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Chương mới' },
  FOLLOW_NEW: { icon: 'fa-user-plus', color: 'text-green-500', bg: 'bg-green-500/10', label: 'Theo dõi' },
  CONTENT_APPROVED: { icon: 'fa-circle-check', color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Đã duyệt' },
  CONTENT_REJECTED: { icon: 'fa-circle-xmark', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Từ chối' },
  NEWS_LIKE: { icon: 'fa-heart', color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'Thích tin tức' },
  NEWS_COMMENT: { icon: 'fa-comments', color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Bình luận tin tức' },
  ACHIEVEMENT: { icon: 'fa-trophy', color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Thành tựu' },
  SYSTEM: { icon: 'fa-bullhorn', color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Hệ thống' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function getNotificationUrl(notification: NotificationItem): string | null {
  const { type, data } = notification;
  switch (type) {
    case 'COMMENT_REPLY':
    case 'NEW_CHAPTER':
      if (data.comicSlug && data.chapterId) return `/read/${data.comicSlug}/${data.chapterId}`;
      if (data.comicSlug) return `/comics/${data.comicSlug}`;
      return null;
    case 'RATING_RECEIVED':
      if (data.comicSlug) return `/comics/${data.comicSlug}`;
      return null;
    case 'CONTENT_APPROVED':
      if (data.slug) return `/comics/${data.slug}`;
      if (data.comicSlug) return `/comics/${data.comicSlug}`;
      return null;
    case 'CONTENT_REJECTED':
      return '/studio/comics';
    case 'NEWS_LIKE':
    case 'NEWS_COMMENT':
      if (data.slug) return `/news/${data.slug}`;
      if (data.articleId) return `/news/${data.articleId}`;
      if (data.newsId) return `/news/${data.newsId}`;
      return null;
    case 'FOLLOW_NEW':
      if (data.actorUsername) return `/@${data.actorUsername}`;
      return null;
    case 'ACHIEVEMENT':
    case 'SYSTEM':
    default:
      return null;
  }
}

// ── NotificationBell Component ──

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch notifications when dropdown opens
  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasFetched) {
      fetchNotifications(true);
      setHasFetched(true);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    // Mark as read if personal and unread
    if (!notification.isRead && notification.source === 'personal') {
      markAsRead(notification.id);
    }

    // Navigate
    const url = getNotificationUrl(notification);
    if (url) {
      router.push(url);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
  };

  if (!user) return null;

  const displayItems = notifications.slice(0, 10);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center p-1.5 sm:p-2 text-zinc-600 dark:text-zinc-300 transition-colors hover:text-zinc-900 dark:hover:text-white cursor-pointer"
        aria-label="Thông báo"
      >
        <i className={`fa-light fa-bell text-[21px] ${isOpen ? 'text-amber-500' : ''}`} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-md shadow-red-500/30 animate-bounce-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed sm:absolute top-16 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-[380px] max-w-[calc(100vw-24px)] sm:max-w-none origin-top sm:origin-top-right overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121212] shadow-2xl animate-slide-up z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 px-4 py-3 bg-white dark:bg-[#121212]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-bell text-amber-500 text-xs" />
              Thông báo
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors cursor-pointer"
              >
                Đọc tất cả
              </button>
            )}
          </div>

            {/* Notification List */}
            <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto overscroll-contain">
            {isLoading && displayItems.length === 0 ? (
              // Skeleton loading
              <div className="space-y-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-zinc-100 dark:bg-white/5 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-zinc-100 dark:bg-white/5 animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-white/5 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
                <i className="fa-light fa-bell-slash text-3xl mb-3" />
                <p className="text-sm font-medium">Chưa có thông báo nào</p>
                <p className="text-xs mt-1 text-zinc-400/80 dark:text-zinc-600/80">Các thông báo mới sẽ xuất hiện ở đây</p>
              </div>
            ) : (
              displayItems.map((n) => {
                const config = NOTIFICATION_CONFIG[n.type] || NOTIFICATION_CONFIG.SYSTEM;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer ${
                      !n.isRead ? 'bg-amber-50/50 dark:bg-amber-500/[0.04]' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                      {n.data?.actorAvatar ? (
                        <img src={n.data.actorAvatar} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <i className={`fa-solid ${config.icon} ${config.color} text-sm`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {n.title}
                      </p>
                      {n.content && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
                          {n.content}
                        </p>
                      )}
                      <p className={`mt-1 text-[11px] ${!n.isRead ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-zinc-400 dark:text-zinc-600'}`}>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-100 dark:border-white/5">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              Xem tất cả thông báo
              <i className="fa-solid fa-arrow-right text-xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
