'use client';

import { create } from 'zustand';

export type ReaderMode = 'scroll' | 'page' | 'double';
export type ReaderTheme = 'ink' | 'oled' | 'paper' | 'sepia';
export type ReaderWidth = 'narrow' | 'medium' | 'wide' | 'full';

interface ReaderSettingsState {
  mode: ReaderMode;
  theme: ReaderTheme;
  width: ReaderWidth;
  pageGap: number;
  brightness: number;
  warmth: number;
  autoLoadNext: boolean;
  autoScrollSpeed: number; // 0 = off, 1..5
  isHydrated: boolean;

  hydrate: () => void;
  update: (partial: Partial<Omit<ReaderSettingsState, 'hydrate' | 'update' | 'isHydrated'>>) => void;
}

const SETTINGS_KEY = 'owoc_reader_settings_v2';
const VALID_MODES: ReaderMode[] = ['scroll', 'page', 'double'];
const VALID_THEMES: ReaderTheme[] = ['ink', 'oled', 'paper', 'sepia'];
const VALID_WIDTHS: ReaderWidth[] = ['narrow', 'medium', 'wide', 'full'];

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export const useReaderSettingsStore = create<ReaderSettingsState>((set, get) => ({
  mode: 'scroll',
  theme: 'ink',
  width: 'medium',
  pageGap: 0,
  brightness: 100,
  warmth: 0,
  autoLoadNext: true,
  autoScrollSpeed: 0,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        set({
          mode: VALID_MODES.includes(parsed.mode as ReaderMode) ? (parsed.mode as ReaderMode) : 'scroll',
          theme: VALID_THEMES.includes(parsed.theme as ReaderTheme) ? (parsed.theme as ReaderTheme) : 'ink',
          width: VALID_WIDTHS.includes(parsed.width as ReaderWidth) ? (parsed.width as ReaderWidth) : 'medium',
          pageGap: clampNum(parsed.pageGap, 0, 48, 0),
          brightness: clampNum(parsed.brightness, 55, 115, 100),
          warmth: clampNum(parsed.warmth, 0, 45, 0),
          autoLoadNext: typeof parsed.autoLoadNext === 'boolean' ? parsed.autoLoadNext : true,
          autoScrollSpeed: 0,
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignore
    }
    const isDark = document.documentElement.classList.contains('dark');
    set({ theme: isDark ? 'ink' : 'paper', isHydrated: true });
  },

  update: (partial) => {
    const clean: Partial<Omit<ReaderSettingsState, 'hydrate' | 'update' | 'isHydrated'>> = {};
    if (partial.mode && VALID_MODES.includes(partial.mode)) clean.mode = partial.mode;
    if (partial.theme && VALID_THEMES.includes(partial.theme)) clean.theme = partial.theme;
    if (partial.width && VALID_WIDTHS.includes(partial.width)) clean.width = partial.width;
    if (partial.pageGap !== undefined) clean.pageGap = clampNum(partial.pageGap, 0, 48, 0);
    if (partial.brightness !== undefined) clean.brightness = clampNum(partial.brightness, 55, 115, 100);
    if (partial.warmth !== undefined) clean.warmth = clampNum(partial.warmth, 0, 45, 0);
    if (partial.autoLoadNext !== undefined) clean.autoLoadNext = Boolean(partial.autoLoadNext);
    if (partial.autoScrollSpeed !== undefined) {
      clean.autoScrollSpeed = clampNum(partial.autoScrollSpeed, 0, 5, 0);
    }

    const next = { ...get(), ...clean };
    set(clean);
    if (typeof window !== 'undefined') {
      try {
        const { hydrate: _h, update: _u, isHydrated: _ih, autoScrollSpeed: _as, ...persistable } = next;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(persistable));
      } catch {
        // Ignore
      }
    }
  },
}));
