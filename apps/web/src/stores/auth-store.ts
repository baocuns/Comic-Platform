'use client';

import { create } from 'zustand';
import { api, ApiError } from '@/lib/api-client';

interface BannerData {
  url?: string;
  position?: number;
}

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  banner: BannerData | null;
  role: string;
  bio: string | null;
  socialLinks: Record<string, string>;
  coins: number;
  experience: number;
  level: number;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  register: (data: { email: string; username: string; password: string; displayName: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateProfile: (data: { displayName?: string; bio?: string; socialLinks?: Record<string, string> }) => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: User;
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

interface ProfileResponse {
  success: boolean;
  data: User;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isHydrated: false,

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.post<AuthResponse>('/auth/register', data);
      set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  googleLogin: async (token) => {
    set({ isLoading: true });
    try {
      const res = await api.post<AuthResponse>('/auth/google', { token });
      set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const { accessToken } = get();
    try {
      await api.post('/auth/logout', undefined, { token: accessToken || undefined });
    } catch {
      // Ignore errors on logout
    }
    set({ user: null, accessToken: null });
  },

  refreshToken: async () => {
    try {
      const res = await api.post<RefreshResponse>('/auth/refresh');
      set({ accessToken: res.data.accessToken });
      return true;
    } catch {
      set({ user: null, accessToken: null });
      return false;
    }
  },

  fetchProfile: async () => {
    const { accessToken } = get();
    if (!accessToken) return;
    try {
      const res = await api.get<ProfileResponse>('/auth/me', { token: accessToken });
      set({ user: res.data });
    } catch {
      const refreshed = await get().refreshToken();
      if (refreshed) {
        const newToken = get().accessToken;
        const res = await api.get<ProfileResponse>('/auth/me', { token: newToken || undefined });
        set({ user: res.data });
      }
    }
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const res = await api.post<RefreshResponse>('/auth/refresh');
      set({ accessToken: res.data.accessToken });
      const profile = await api.get<ProfileResponse>('/auth/me', { token: res.data.accessToken });
      set({ user: profile.data, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  updateProfile: async (data) => {
    const { accessToken } = get();
    if (!accessToken) return;
    const res = await api.put<{ success: boolean; data: User }>('/users/me', data, { token: accessToken });
    set({ user: res.data });
  },

  updateUser: (partial) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, ...partial } });
    }
  },
}));
