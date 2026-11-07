'use client';

import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { useAuthStore } from './auth-store';

const STORAGE_KEY = 'comics_reading_history_v1';

export interface LocalReadRecord {
  comicId: string;
  comicSlug?: string;
  comicTitle?: string;
  coverUrl?: string | null;
  chapterId: string;
  chapterNumber: string;
  chapterTitle?: string | null;
  totalPages?: number;
  lastPage?: number;
  readAt: string;
  readChapterIds?: string[];
}

export type LocalRecordsMap = Record<string, LocalReadRecord>;

function loadFromStorage(): LocalRecordsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse reading history from localStorage:', e);
    return {};
  }
}

function saveToStorage(records: LocalRecordsMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event('reading-history-updated'));
  } catch (e) {
    console.warn('Failed to save reading history to localStorage:', e);
  }
}

function buildQuickLookup(records: LocalRecordsMap): Record<string, string> {
  const map: Record<string, string> = {};
  for (const record of Object.values(records)) {
    if (!record || !record.chapterNumber) continue;
    const num = String(record.chapterNumber);
    if (record.comicId) map[record.comicId] = num;
    if (record.comicSlug) map[record.comicSlug] = num;
  }
  return map;
}

interface ReadingHistoryState {
  records: LocalRecordsMap;
  history: Record<string, string>;
  isHydrated: boolean;

  hydrate: () => void;
  getChapter: (comicId?: string, comicSlug?: string) => string | undefined;
  getRecord: (comicId?: string, comicSlug?: string) => LocalReadRecord | undefined;
  recordRead: (data: {
    comicId: string;
    comicSlug?: string;
    comicTitle?: string;
    coverUrl?: string | null;
    chapterId: string;
    chapterNumber: string | number;
    chapterTitle?: string | null;
    totalPages?: number;
    lastPage?: number;
  }) => void;
  syncWithServer: (accessToken: string) => Promise<void>;
}

export const useReadingHistoryStore = create<ReadingHistoryState>((set, get) => ({
  records: {},
  history: {},
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated || typeof window === 'undefined') return;
    const records = loadFromStorage();
    const history = buildQuickLookup(records);
    set({ records, history, isHydrated: true });

    // Sync with server if logged in
    const token = useAuthStore.getState().accessToken;
    if (token) {
      get().syncWithServer(token);
    }
  },

  getChapter: (comicId, comicSlug) => {
    const { history } = get();
    if (comicId && history[comicId]) return history[comicId];
    if (comicSlug && history[comicSlug]) return history[comicSlug];
    return undefined;
  },

  getRecord: (comicId, comicSlug) => {
    const { records } = get();
    if (comicId && records[comicId]) return records[comicId];
    if (comicSlug) {
      const match = Object.values(records).find((r) => r.comicSlug === comicSlug);
      if (match) return match;
    }
    return undefined;
  },

  recordRead: (data) => {
    const { records } = get();
    const comicId = data.comicId;
    if (!comicId) return;

    const existing = records[comicId];
    const newChapNumStr = String(data.chapterNumber);

    // Only update if no existing record or new chapter is >= current chapter
    const currentNum = existing ? parseFloat(existing.chapterNumber) : NaN;
    const nextNum = parseFloat(newChapNumStr);
    const shouldUpdateChapter = isNaN(currentNum) || isNaN(nextNum) || nextNum >= currentNum;

    // Track read chapter IDs
    const currentReadIds = existing?.readChapterIds || (existing?.chapterId ? [existing.chapterId] : []);
    const updatedReadIds = currentReadIds.includes(data.chapterId)
      ? currentReadIds
      : [...currentReadIds, data.chapterId];

    const updatedRecord: LocalReadRecord = {
      comicId,
      comicSlug: data.comicSlug || existing?.comicSlug,
      comicTitle: data.comicTitle || existing?.comicTitle,
      coverUrl: data.coverUrl !== undefined ? data.coverUrl : existing?.coverUrl,
      chapterId: shouldUpdateChapter ? data.chapterId : (existing?.chapterId || data.chapterId),
      chapterNumber: shouldUpdateChapter ? newChapNumStr : existing!.chapterNumber,
      chapterTitle: shouldUpdateChapter ? data.chapterTitle : existing?.chapterTitle,
      totalPages: data.totalPages ?? existing?.totalPages,
      lastPage: data.lastPage || 1,
      readAt: new Date().toISOString(),
      readChapterIds: updatedReadIds,
    };

    const updatedRecords: LocalRecordsMap = {
      ...records,
      [comicId]: updatedRecord,
    };

    saveToStorage(updatedRecords);

    set({
      records: updatedRecords,
      history: buildQuickLookup(updatedRecords),
    });
  },

  syncWithServer: async (accessToken: string) => {
    if (!accessToken || typeof window === 'undefined') return;

    try {
      const res = await api.get<{
        data: Array<{
          id: string;
          lastPage: number;
          readAt: string;
          chapter: {
            id: string;
            number: string;
            title: string | null;
            totalPages: number;
            comic: { id: string; title: string; slug: string; coverUrl: string | null };
          };
        }>;
      }>('/history?limit=100', { token: accessToken });

      if (!res.data || !Array.isArray(res.data)) return;

      const currentRecords = loadFromStorage();
      const serverItems = res.data;
      const serverComicIds = new Set<string>();

      // 1. Merge server history into local
      for (const item of serverItems) {
        const comicId = item.chapter?.comic?.id;
        const comicSlug = item.chapter?.comic?.slug;
        const chapNum = item.chapter?.number;
        if (!comicId || !chapNum) continue;

        serverComicIds.add(comicId);
        const existing = currentRecords[comicId];
        const prevIds = existing?.readChapterIds || (existing?.chapterId ? [existing.chapterId] : []);
        const mergedIds = item.chapter.id && !prevIds.includes(item.chapter.id)
          ? [...prevIds, item.chapter.id]
          : prevIds;

        if (!existing) {
          currentRecords[comicId] = {
            comicId,
            comicSlug,
            comicTitle: item.chapter?.comic?.title,
            coverUrl: item.chapter?.comic?.coverUrl,
            chapterId: item.chapter.id,
            chapterNumber: String(chapNum),
            chapterTitle: item.chapter.title,
            totalPages: item.chapter.totalPages,
            lastPage: item.lastPage,
            readAt: item.readAt,
            readChapterIds: mergedIds,
          };
        } else {
          const localNum = parseFloat(existing.chapterNumber);
          const srvNum = parseFloat(chapNum);
          if (!isNaN(srvNum) && (isNaN(localNum) || srvNum >= localNum)) {
            currentRecords[comicId] = {
              comicId,
              comicSlug: comicSlug || existing.comicSlug,
              comicTitle: item.chapter?.comic?.title || existing.comicTitle,
              coverUrl: item.chapter?.comic?.coverUrl ?? existing.coverUrl,
              chapterId: item.chapter.id,
              chapterNumber: String(chapNum),
              chapterTitle: item.chapter.title || existing.chapterTitle,
              totalPages: item.chapter.totalPages || existing.totalPages,
              lastPage: item.lastPage,
              readAt: item.readAt,
              readChapterIds: mergedIds,
            };
          } else {
            currentRecords[comicId] = {
              ...existing,
              readChapterIds: mergedIds,
            };
          }
        }
      }

      // 2. Push any local records not on server to server
      for (const [comicId, record] of Object.entries(currentRecords)) {
        if (!serverComicIds.has(comicId) && record.chapterId) {
          api
            .post(
              '/history',
              {
                comicId: record.comicId,
                chapterId: record.chapterId,
                lastPage: record.lastPage || 1,
              },
              { token: accessToken },
            )
            .catch(() => { });
        }
      }

      // 3. Save to localStorage and store
      saveToStorage(currentRecords);
      set({
        records: currentRecords,
        history: buildQuickLookup(currentRecords),
      });
    } catch {
      // Ignore background sync errors
    }
  },
}));

// Cross-tab and window event listener
if (typeof window !== 'undefined') {
  window.addEventListener('reading-history-updated', () => {
    const records = loadFromStorage();
    useReadingHistoryStore.setState({
      records,
      history: buildQuickLookup(records),
    });
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const records = loadFromStorage();
      useReadingHistoryStore.setState({
        records,
        history: buildQuickLookup(records),
      });
    }
  });

  // Automatically sync when user logs in
  useAuthStore.subscribe((state, prevState) => {
    if (state.accessToken && state.accessToken !== prevState.accessToken) {
      useReadingHistoryStore.getState().syncWithServer(state.accessToken);
    }
  });
}

