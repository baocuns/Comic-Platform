const GUEST_GENRES_KEY = 'owoc_guest_genres';

export function trackComicView(comic: { genres?: Array<{ slug: string }> }) {
  if (typeof window === 'undefined' || !comic.genres?.length) return;
  try {
    const raw = localStorage.getItem(GUEST_GENRES_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const newSlugs = comic.genres.map((g) => g.slug).filter(Boolean);
    const merged = Array.from(new Set([...newSlugs, ...existing])).slice(0, 8);
    localStorage.setItem(GUEST_GENRES_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

export function getGuestRecentGenres(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_GENRES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
