'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import '../supporting-pages.css';
import {
  useNotificationStore,
  NotificationType,
  NotificationItem,
} from '@/stores/notification-store';

// ── Config ──

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: string; color: string; bg: string; border: string; label: string }
> = {
  COMMENT_REPLY: { icon: 'fa-comment', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'Bình luận' },
  RATING_RECEIVED: { icon: 'fa-star', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Đánh giá' },
  NEW_CHAPTER: { icon: 'fa-book-open', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Chương mới' },
  FOLLOW_NEW: { icon: 'fa-user-plus', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Theo dõi' },
  CONTENT_APPROVED: { icon: 'fa-circle-check', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Đã duyệt' },
  CONTENT_REJECTED: { icon: 'fa-circle-xmark', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Từ chối' },
  NEWS_LIKE: { icon: 'fa-heart', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Thích tin tức' },
  NEWS_COMMENT: { icon: 'fa-comments', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'Bình luận tin tức' },
  ACHIEVEMENT: { icon: 'fa-trophy', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Thành tựu' },
  SYSTEM: { icon: 'fa-bullhorn', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: 'Hệ thống' },
};

const FILTER_TABS: { key: NotificationType | 'ALL'; label: string; icon: string }[] = [
  { key: 'ALL', label: 'Tất cả', icon: 'fa-bell' },
  { key: 'COMMENT_REPLY', label: 'Bình luận', icon: 'fa-comment' },
  { key: 'NEWS_LIKE', label: 'Thích tin tức', icon: 'fa-heart' },
  { key: 'NEWS_COMMENT', label: 'Tin tức', icon: 'fa-comments' },
  { key: 'RATING_RECEIVED', label: 'Đánh giá', icon: 'fa-star' },
  { key: 'NEW_CHAPTER', label: 'Chương mới', icon: 'fa-book-open' },
  { key: 'CONTENT_APPROVED', label: 'Nội dung', icon: 'fa-shield-check' },
  { key: 'SYSTEM', label: 'Hệ thống', icon: 'fa-bullhorn' },
  { key: 'ACHIEVEMENT', label: 'Thành tựu', icon: 'fa-trophy' },
];

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 172800) return `Hôm qua lúc ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return 'Hôm nay';
  if (date >= yesterday) return 'Hôm qua';
  if (date >= weekAgo) return 'Tuần này';
  return 'Cũ hơn';
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
    default:
      return null;
  }
}

// ── Page ──

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasNext,
    activeFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilter,
  } = useNotificationStore();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Group notifications by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: NotificationItem[] }[] = [];
    const groupMap = new Map<string, NotificationItem[]>();

    for (const n of notifications) {
      const group = getDateGroup(n.createdAt);
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(n);
    }

    const order = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Cũ hơn'];
    for (const label of order) {
      const items = groupMap.get(label);
      if (items && items.length > 0) {
        groups.push({ label, items });
      }
    }

    return groups;
  }, [notifications]);

  const handleClick = (n: NotificationItem) => {
    if (!n.isRead && n.source === 'personal') {
      markAsRead(n.id);
    }
    const url = getNotificationUrl(n);
    if (url) router.push(url);
  };

  if (!user) return null;

  return (
    <div className="ow-support ow-notifications">
      {/* Page Header */}
      <header className="ow-masthead">
        <span className="ow-kicker">OWOC / Hộp thư truyện</span>
        <div className="ow-notifications-heading flex items-center justify-between gap-4">
          <div>
            <h1>Thông báo<span aria-hidden="true">!</span></h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-500">
              {unreadCount > 0
                ? `Bạn có ${unreadCount} thông báo chưa đọc`
                : 'Tất cả thông báo đã được đọc'}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="ow-secondary shrink-0"
            >
              <i className="fa-solid fa-check-double text-xs" />
              Đọc tất cả
            </button>
          )}
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="ow-filters mb-6" aria-label="Lọc thông báo">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <i className={`fa-light ${tab.icon} text-[11px]`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className="space-y-6">
        {isLoading && notifications.length === 0 ? (
          // Skeleton
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="ow-notice flex gap-4 p-4"
              >
                <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-100 dark:bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-3/4 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-3.5 w-1/2 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-1/4 rounded-lg bg-zinc-100 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          // Empty state
          <div className="ow-empty flex flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/[0.04] mb-4">
              <i className="fa-light fa-bell-slash text-2xl text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
              Chưa có thông báo nào
            </h3>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-600 max-w-xs">
              {activeFilter === 'ALL'
                ? 'Khi có người tương tác với nội dung của bạn, thông báo sẽ xuất hiện ở đây.'
                : 'Không tìm thấy thông báo nào với bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              {/* Date group header */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-zinc-100 dark:bg-white/[0.04]" />
              </div>

              {/* Items */}
              <div className="space-y-2">
                {group.items.map((n) => {
                  const config = NOTIFICATION_CONFIG[n.type] || NOTIFICATION_CONFIG.SYSTEM;
                  const url = getNotificationUrl(n);

                  return (
                    <div
                      key={n.id}
                      className="ow-notice group relative flex items-start gap-3 sm:gap-4 p-4"
                      data-unread={!n.isRead}
                    >
                      <button
                        type="button"
                        className="ow-notice-open"
                        aria-label={`${url ? 'Mở thông báo' : 'Đánh dấu đã đọc'}: ${n.title}`}
                        onClick={() => handleClick(n)}
                      />
                      {/* Icon / Avatar */}
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${config.bg} ${config.border}`}>
                        {n.data?.actorAvatar ? (
                          <img
                            src={n.data.actorAvatar}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <i className={`fa-solid ${config.icon} ${config.color} text-base`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`ow-notice-title text-sm leading-relaxed ${
                              !n.isRead
                                ? 'text-zinc-900 dark:text-white font-medium'
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {n.title}
                          </p>

                          {/* Unread dot */}
                          {!n.isRead && (
                            <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40" />
                          )}
                        </div>

                        {n.content && (
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500 line-clamp-2">
                            {n.content}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-3">
                          <span
                            className={`text-xs ${
                              !n.isRead
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : 'text-zinc-400 dark:text-zinc-600'
                            }`}
                          >
                            {timeAgo(n.createdAt)}
                          </span>

                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}>
                            <i className={`fa-solid ${config.icon} text-[9px]`} />
                            {config.label}
                          </span>
                        </div>
                      </div>

                      {/* Delete button (personal only) */}
                      {n.source === 'personal' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="ow-notice-delete absolute right-1 top-1 z-10 flex items-center justify-center cursor-pointer"
                          aria-label={`Xóa thông báo: ${n.title}`}
                          title="Xóa thông báo"
                        >
                          <i className="fa-light fa-xmark text-sm" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasNext && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => fetchNotifications(false)}
            disabled={isLoading}
            className="ow-secondary"
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner-third fa-spin text-xs" />
                Đang tải...
              </>
            ) : (
              <>
                <i className="fa-light fa-arrow-down text-xs" />
                Tải thêm thông báo
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
