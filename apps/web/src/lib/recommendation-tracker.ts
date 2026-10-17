import { api } from './api-client';

const STORAGE_KEYS = {
  RECENT_VIEWS: 'comic_recent_views',
  GUEST_GENRES: 'comic_guest_genres',
  RECENT_SEARCHES: 'comic_recent_searches',
} as const;

export interface TrackableComic {
  id: string;
  genres?: Array<{ slug: string; name?: string }>;
}

/**
 * Ghi nhận lượt xem truyện để xây dựng hồ sơ sở thích của khách vãng lai & user.
 */
export function trackComicView(comic: TrackableComic): void {
  if (typeof window === 'undefined' || !comic?.id) return;

  try {
    // 1. Lưu ID truyện gần đây
    const rawViews = localStorage.getItem(STORAGE_KEYS.RECENT_VIEWS);
    const views: string[] = rawViews ? JSON.parse(rawViews) : [];
    const updatedViews = [comic.id, ...views.filter((id) => id !== comic.id)].slice(0, 15);
    localStorage.setItem(STORAGE_KEYS.RECENT_VIEWS, JSON.stringify(updatedViews));

    // 2. Lưu thể loại quan tâm gần đây
    if (comic.genres && comic.genres.length > 0) {
      const rawGenres = localStorage.getItem(STORAGE_KEYS.GUEST_GENRES);
      const genres: string[] = rawGenres ? JSON.parse(rawGenres) : [];
      const newSlugs = comic.genres.map((g) => g.slug.toLowerCase());
      const updatedGenres = Array.from(new Set([...newSlugs, ...genres])).slice(0, 10);
      localStorage.setItem(STORAGE_KEYS.GUEST_GENRES, JSON.stringify(updatedGenres));
    }
  } catch (err) {
    console.warn('Failed to track comic view in localStorage:', err);
  }
}

/**
 * Ghi nhận từ khóa tìm kiếm vào localStorage và gửi lên backend để cá nhân hóa đề xuất.
 */
export function trackSearch(query: string, token?: string): void {
  if (typeof window === 'undefined') return;
  const clean = query?.trim().toLowerCase();
  if (!clean || clean.length < 2) return;

  try {
    // 1. Lưu vào localStorage
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
    const searches: string[] = raw ? JSON.parse(raw) : [];
    const updated = [clean, ...searches.filter((s) => s !== clean)].slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));

    // 2. Bắn request nhẹ lên backend (background)
    api.post('/comics/search/record', { query: clean }, token ? { token } : undefined).catch(() => {});
  } catch (err) {
    console.warn('Failed to track search query:', err);
  }
}

/**
 * Lấy danh sách thể loại gần đây từ localStorage để gửi lên API đề xuất.
 */
export function getGuestRecentGenres(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GUEST_GENRES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Lấy lịch sử các từ khóa tìm kiếm gần đây.
 */
export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Xóa lịch sử tìm kiếm gần đây.
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
  } catch {}
}
