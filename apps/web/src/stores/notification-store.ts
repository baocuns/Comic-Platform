'use client';

import { create } from 'zustand';
import type { NotificationItem } from 'shared';
import { api } from '@/lib/api-client';

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (token: string, page?: number) => Promise<void>;
  fetchUnreadCount: (token: string) => Promise<void>;
  pushRealtimeNotification: (item: NotificationItem) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: (token: string, id: string) => Promise<void>;
  markAllAsRead: (token: string) => Promise<void>;
  deleteItem: (token: string, id: string) => Promise<void>;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (token, page = 1) => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ success: boolean; data: NotificationItem[] }>(
        `/notifications?page=${page}&limit=20`,
        { token },
      );
      set({ items: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async (token) => {
    try {
      const res = await api.get<{ success: boolean; data: { count: number } }>(
        '/notifications/unread-count',
        { token },
      );
      set({ unreadCount: res.data.count });
    } catch {
      // Ignore
    }
  },

  pushRealtimeNotification: (item) => {
    set((state) => {
      const alreadyExists = state.items.some((i) => i.id === item.id);
      return {
        items: [item, ...state.items.filter((i) => i.id !== item.id)].slice(0, 30),
        unreadCount: alreadyExists ? state.unreadCount : state.unreadCount + 1,
      };
    });
  },

  setUnreadCount: (count) => set({ unreadCount: Math.max(0, Math.floor(count || 0)) }),

  markAsRead: async (token, id) => {
    const prevItems = get().items;
    const prevUnread = get().unreadCount;
    const existing = prevItems.find((n) => n.id === id);
    if (existing?.isRead) return;
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      const res = await api.patch<{ data: { count: number } }>(`/notifications/${id}/read`, {}, { token });
      set({ unreadCount: Math.max(0, res.data.count) });
    } catch {
      set({ items: prevItems, unreadCount: prevUnread });
    }
  },

  markAllAsRead: async (token) => {
    const prevItems = get().items;
    const prevUnread = get().unreadCount;
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await api.post('/notifications/read-all', {}, { token });
    } catch {
      set({ items: prevItems, unreadCount: prevUnread });
    }
  },

  deleteItem: async (token, id) => {
    const prevItems = get().items;
    const prevUnread = get().unreadCount;
    const target = prevItems.find((n) => n.id === id);
    set((state) => ({
      items: state.items.filter((n) => n.id !== id),
      unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
    try {
      await api.delete(`/notifications/${id}`, { token });
    } catch {
      set({ items: prevItems, unreadCount: prevUnread });
    }
  },

  reset: () => set({ items: [], unreadCount: 0, isLoading: false }),
}));
