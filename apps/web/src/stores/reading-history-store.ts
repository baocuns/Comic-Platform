'use client';

import { create } from 'zustand';

export interface LocalHistoryEntry {
  comicId: string;
  comicSlug: string;
  comicTitle: string;
  coverUrl: string | null;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string | null;
  totalPages: number;
  lastPage: number;
  updatedAt: string;
}

const STORAGE_KEY = 'owoc_local_reading_history_v2';

interface ReadingHistoryState {
  entries: Record<string, LocalHistoryEntry>;
  isHydrated: boolean;
  hydrate: () => void;
  recordRead: (entry: Omit<LocalHistoryEntry, 'updatedAt'>) => void;
  getByComic: (comicId?: string, slug?: string) => LocalHistoryEntry | undefined;
  removeComic: (comicId: string) => void;
  clearAll: () => void;
  getAllSorted: () => LocalHistoryEntry[];
}

export const useReadingHistoryStore = create<ReadingHistoryState>((set, get) => ({
  entries: {},
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const valid =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, LocalHistoryEntry>)
          : {};
      set({ entries: valid, isHydrated: true });
    } catch {
      set({ entries: {}, isHydrated: true });
    }
  },

  recordRead: (entry) => {
    if (!get().isHydrated) get().hydrate();
    const next: LocalHistoryEntry = {
      ...entry,
      updatedAt: new Date().toISOString(),
    };
    const merged = { ...get().entries, [entry.comicId]: next };
    // Keep at most 100 most recent comics in localStorage
    const sortedEntries = Object.entries(merged)
      .sort(([, a], [, b]) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 100);
    const updated = Object.fromEntries(sortedEntries);
    set({ entries: updated, isHydrated: true });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore quota exceeded
      }
    }
  },

  getByComic: (comicId, slug) => {
    if (!get().isHydrated) get().hydrate();
    const entries = get().entries;
    if (comicId && entries[comicId]) return entries[comicId];
    if (slug) {
      return Object.values(entries).find((e) => e.comicSlug === slug);
    }
    return undefined;
  },

  removeComic: (comicId) => {
    if (!get().isHydrated) get().hydrate();
    const updated = { ...get().entries };
    delete updated[comicId];
    set({ entries: updated });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
    }
  },

  clearAll: () => {
    set({ entries: {}, isHydrated: true });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  },

  getAllSorted: () => {
    if (!get().isHydrated) get().hydrate();
    return Object.values(get().entries).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },
}));
