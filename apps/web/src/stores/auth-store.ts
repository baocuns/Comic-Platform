'use client';

import { create } from 'zustand';
import type { UserProfile } from 'shared';
import { api } from '@/lib/api-client';
import { useReadingHistoryStore } from './reading-history-store';
import { useNotificationStore } from './notification-store';

let authGeneration = 0;
let inflightRefreshPromise: Promise<string | null> | null = null;
let inflightHydratePromise: Promise<void> | null = null;

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  register: (data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  fetchProfile: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string;
    bio?: string;
    socialLinks?: Record<string, string>;
    preferences?: Record<string, unknown>;
  }) => Promise<void>;
  updateUser: (partial: Partial<UserProfile>) => void;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: UserProfile;
    accessToken: string;
    expiresIn: number;
  };
}

interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

async function syncLocalHistoryToServer(token: string) {
  try {
    const store = useReadingHistoryStore.getState();
    store.hydrate();
    const items = store.getAllSorted();
    if (items.length === 0) return;
    await api.post(
      '/history/sync',
      {
        items: items.slice(0, 20).map((i) => ({
          comicId: i.comicId,
          chapterId: i.chapterId,
          lastPage: i.lastPage,
          totalPages: i.totalPages,
        })),
      },
      { token },
    );
  } catch {
    // Non-fatal
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  api.configureAuth(
    () => get().accessToken,
    () => get().refreshToken(),
  );

  return {
    user: null,
    accessToken: null,
    isLoading: false,
    isHydrated: false,

    register: async (data) => {
      const prevUserId = get().user?.id;
      const gen = ++authGeneration;
      set({ isLoading: true });
      try {
        const res = await api.post<AuthResponse>('/auth/register', data);
        if (authGeneration !== gen) {
          set({ isLoading: false });
          return;
        }
        if (prevUserId && prevUserId !== res.data.user.id) {
          useReadingHistoryStore.getState().clearAll();
        }
        set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false, isHydrated: true });
        syncLocalHistoryToServer(res.data.accessToken);
      } catch (err) {
        if (authGeneration === gen) set({ isLoading: false });
        throw err;
      }
    },

    login: async (identifier, password) => {
      const prevUserId = get().user?.id;
      const gen = ++authGeneration;
      set({ isLoading: true });
      try {
        const res = await api.post<AuthResponse>('/auth/login', { identifier, password });
        if (authGeneration !== gen) {
          set({ isLoading: false });
          return;
        }
        if (prevUserId && prevUserId !== res.data.user.id) {
          useReadingHistoryStore.getState().clearAll();
        }
        set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false, isHydrated: true });
        syncLocalHistoryToServer(res.data.accessToken);
      } catch (err) {
        if (authGeneration === gen) set({ isLoading: false });
        throw err;
      }
    },

    googleLogin: async (token) => {
      const prevUserId = get().user?.id;
      const gen = ++authGeneration;
      set({ isLoading: true });
      try {
        const res = await api.post<AuthResponse>('/auth/google', { token });
        if (authGeneration !== gen) {
          set({ isLoading: false });
          return;
        }
        if (prevUserId && prevUserId !== res.data.user.id) {
          useReadingHistoryStore.getState().clearAll();
        }
        set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false, isHydrated: true });
        syncLocalHistoryToServer(res.data.accessToken);
      } catch (err) {
        if (authGeneration === gen) set({ isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      authGeneration += 1;
      inflightRefreshPromise = null;
      inflightHydratePromise = null;
      const token = get().accessToken;
      set({ user: null, accessToken: null, isLoading: false, isHydrated: true });
      useReadingHistoryStore.getState().clearAll();
      useNotificationStore.getState().reset();
      try {
        await api.post('/auth/logout', undefined, { token, skipAuthRefresh: true });
      } catch {
        // Ignore
      }
    },

    refreshToken: async () => {
      if (inflightRefreshPromise) return inflightRefreshPromise;
      const gen = authGeneration;
      inflightRefreshPromise = (async () => {
        try {
          const res = await api.post<RefreshResponse>('/auth/refresh', undefined, { skipAuthRefresh: true });
          if (authGeneration !== gen) {
            return null;
          }
          set({ accessToken: res.data.accessToken });
          return res.data.accessToken;
        } catch {
          if (authGeneration === gen) {
            set({ user: null, accessToken: null });
          }
          return null;
        } finally {
          inflightRefreshPromise = null;
        }
      })();
      return inflightRefreshPromise;
    },

    fetchProfile: async () => {
      const token = get().accessToken;
      if (!token) return;
      const gen = authGeneration;
      try {
        const res = await api.get<{ success: boolean; data: UserProfile }>('/auth/me', { token });
        if (authGeneration === gen && get().accessToken) {
          set({ user: res.data });
        }
      } catch {
        // Handled by apiClient refresh
      }
    },

    hydrate: async () => {
      if (get().isHydrated) return;
      if (inflightHydratePromise) return inflightHydratePromise;
      const gen = authGeneration;
      inflightHydratePromise = (async () => {
        try {
          const refreshRes = await api.post<RefreshResponse>('/auth/refresh', undefined, { skipAuthRefresh: true });
          if (authGeneration !== gen) return;
          const token = refreshRes.data.accessToken;
          set({ accessToken: token });
          const meRes = await api.get<{ success: boolean; data: UserProfile }>('/auth/me', { token });
          if (authGeneration !== gen) return;
          set({ user: meRes.data, isHydrated: true });
        } catch {
          if (authGeneration === gen) {
            set({ user: null, accessToken: null, isHydrated: true });
          }
        } finally {
          inflightHydratePromise = null;
        }
      })();
      return inflightHydratePromise;
    },

    updateProfile: async (data) => {
      const token = get().accessToken;
      if (!token) return;
      const gen = authGeneration;
      const res = await api.put<{ success: boolean; data: UserProfile }>('/users/me', data, { token });
      if (authGeneration === gen) {
        set({ user: res.data });
      }
    },

    updateUser: (partial) => {
      const current = get().user;
      if (current) {
        set({ user: { ...current, ...partial } });
      }
    },
  };
});
