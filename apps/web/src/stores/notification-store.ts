'use client';

import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { useAuthStore } from './auth-store';

// ── Types ──

export type NotificationType =
  | 'NEW_CHAPTER'
  | 'COMMENT_REPLY'
  | 'RATING_RECEIVED'
  | 'FOLLOW_NEW'
  | 'SYSTEM'
  | 'ACHIEVEMENT'
  | 'CONTENT_APPROVED'
  | 'CONTENT_REJECTED'
  | 'NEWS_LIKE'
  | 'NEWS_COMMENT';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string | null;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  source: 'personal' | 'broadcast';
}

interface NotificationsResponse {
  success: boolean;
  data: NotificationItem[];
  meta: { page: number; limit: number; total: number; hasNext: boolean };
}

interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

// ── Store ──

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  hasNext: boolean;
  page: number;
  activeFilter: NotificationType | 'ALL';

  fetchNotifications: (reset?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  setFilter: (type: NotificationType | 'ALL') => void;
  addRealTimeNotification: (notification: NotificationItem) => void;
  updateUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasNext: false,
  page: 1,
  activeFilter: 'ALL',

  fetchNotifications: async (reset = false) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const { activeFilter, page } = get();
    const targetPage = reset ? 1 : page;

    set({ isLoading: true });

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: '20',
      });
      if (activeFilter !== 'ALL') {
        params.set('type', activeFilter);
      }

      const res = await api.get<NotificationsResponse>(
        `/notifications?${params.toString()}`,
        { token },
      );

      set((state) => ({
        notifications: reset
          ? res.data
          : [...state.notifications, ...res.data],
        hasNext: res.meta.hasNext,
        page: targetPage + 1,
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    try {
      const res = await api.get<UnreadCountResponse>(
        '/notifications/unread-count',
        { token },
      );
      set({ unreadCount: res.data.count });
    } catch {
      // Silently fail
    }
  },

  markAsRead: async (id: string) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    try {
      await api.patch(`/notifications/${id}/read`, undefined, { token });

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    try {
      await api.patch('/notifications/read-all', undefined, { token });

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  deleteNotification: async (id: string) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    try {
      await api.delete(`/notifications/${id}`, { token });

      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: notification && !notification.isRead
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch {
      // Silently fail
    }
  },

  setFilter: (type: NotificationType | 'ALL') => {
    set({ activeFilter: type, notifications: [], page: 1, hasNext: false });
    get().fetchNotifications(true);
  },

  addRealTimeNotification: (notification: NotificationItem) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));
  },

  updateUnreadCount: (count: number) => {
    set({ unreadCount: count });
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      hasNext: false,
      page: 1,
      activeFilter: 'ALL',
    });
  },
}));
