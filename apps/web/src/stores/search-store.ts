'use client';

import { create } from 'zustand';

interface SearchState {
  isOpen: boolean;
  recentQueries: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  addRecent: (q: string) => void;
  clearRecent: () => void;
}

const RECENT_KEY = 'owoc_recent_searches';

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  recentQueries: [],
  open: () => set({ isOpen: true, recentQueries: loadRecent() }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen, recentQueries: !s.isOpen ? loadRecent() : s.recentQueries })),
  addRecent: (q) => {
    const clean = q.trim().slice(0, 120);
    if (clean.length < 2) return;
    const next = [clean, ...get().recentQueries.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    set({ recentQueries: next });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
    }
  },
  clearRecent: () => {
    set({ recentQueries: [] });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(RECENT_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  },
}));
