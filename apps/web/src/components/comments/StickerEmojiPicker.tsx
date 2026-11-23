'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sticker as StickerIcon,
  Smile,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  X,
} from 'lucide-react';
import {
  EMOJI_CATEGORIES,
  isAllowedStickerUrl,
  STICKER_CATEGORIES,
  type Sticker,
} from './stickerData';

const RECENT_STICKERS_KEY = 'owoc_recent_stickers';
const MAX_RECENT_STICKERS = 16;

interface StickerEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (sticker: { url: string; name: string }) => void;
  onClose?: () => void;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
}

export function StickerEmojiPicker({
  onSelectEmoji,
  onSelectSticker,
  onClose,
  placement = 'bottom',
  align = 'left',
}: StickerEmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<'sticker' | 'emoji'>('sticker');
  const [selectedStickerCat, setSelectedStickerCat] = useState<string>(STICKER_CATEGORIES[0].id);
  const [stickerSearch, setStickerSearch] = useState('');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const stickerNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_STICKERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentStickers(
            parsed
              .map((item) => {
                const safeUrl = item && typeof item.url === 'string' ? isAllowedStickerUrl(item.url) : null;
                return safeUrl ? { ...item, url: safeUrl } : null;
              })
              .filter((item): item is Sticker => Boolean(item))
              .slice(0, MAX_RECENT_STICKERS),
          );
        }
      }
    } catch {
      // Ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (!isMobile || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobile) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, isMobile]);

  const scrollStickerNav = (dir: 'left' | 'right') => {
    if (stickerNavRef.current) {
      stickerNavRef.current.scrollBy({
        left: dir === 'left' ? -150 : 150,
        behavior: 'smooth',
      });
    }
  };

  const displayedStickers = useMemo(() => {
    const q = stickerSearch.trim().toLowerCase();
    if (q) {
      const seen = new Set<string>();
      const matches: Sticker[] = [];
      for (const cat of STICKER_CATEGORIES) {
        for (const st of cat.stickers) {
          if (!seen.has(st.url) && (st.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))) {
            seen.add(st.url);
            matches.push(st);
          }
        }
      }
      return matches;
    }

    if (selectedStickerCat === 'recent') {
      return recentStickers;
    }
    return STICKER_CATEGORIES.find((c) => c.id === selectedStickerCat)?.stickers || [];
  }, [stickerSearch, selectedStickerCat, recentStickers]);

  const handlePickSticker = (sticker: Sticker) => {
    const nextRecent = [
      sticker,
      ...recentStickers.filter((item) => item.url !== sticker.url),
    ].slice(0, MAX_RECENT_STICKERS);
    setRecentStickers(nextRecent);
    try {
      localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(nextRecent));
    } catch {
      // Ignore storage quota issues
    }
    onSelectSticker({ url: sticker.url, name: sticker.name });
  };

  const posClasses = [
    placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
    align === 'right' ? 'right-0' : 'left-0',
  ].join(' ');

  const pickerBody = (
    <>
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'sticker'
                ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <StickerIcon className="h-3.5 w-3.5" />
            <span>Sticker</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Smile className="h-3.5 w-3.5" />
            <span>Biểu cảm</span>
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Đóng bảng sticker"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {activeTab === 'sticker' ? (
          <>
            {/* Search stickers */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={stickerSearch}
                onChange={(e) => setStickerSearch(e.target.value)}
                placeholder="Tìm sticker theo tên hoặc bộ..."
                className="h-8 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>

            {/* Category Bar */}
            {!stickerSearch.trim() && (
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollStickerNav('left')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  aria-label="Cuộn trái"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <div
                  ref={stickerNavRef}
                  onWheel={(e) => {
                    if (e.deltaY !== 0) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }}
                  className="flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {recentStickers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStickerCat('recent')}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        selectedStickerCat === 'recent'
                          ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>Gần đây</span>
                    </button>
                  )}

                  {STICKER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedStickerCat(cat.id)}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        selectedStickerCat === cat.id
                          ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => scrollStickerNav('right')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  aria-label="Cuộn phải"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Sticker Grid (scroll wrapper separated from CSS Grid for WebKit/iOS Safari) */}
            {displayedStickers.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                Không tìm thấy sticker phù hợp.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                <div className="grid grid-cols-4 gap-2 select-none">
                  {displayedStickers.map((st, idx) => (
                    <button
                      key={`${st.id}-${idx}`}
                      type="button"
                      title={st.name}
                      onClick={() => handlePickSticker(st)}
                      className="group flex h-[72px] sm:h-[78px] w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1.5 transition-all hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] active:scale-95 cursor-pointer"
                    >
                      <img
                        src={st.url}
                        alt={st.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full h-auto w-auto object-contain pointer-events-none transition-transform group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Lọc theo nhóm (Cảm xúc, Meme...) hoặc emoji"
                className="h-8 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>

            <div className="max-h-60 space-y-3 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {EMOJI_CATEGORIES.map((cat) => {
                const q = emojiSearch.trim().toLowerCase();
                const catMatches = q ? cat.name.toLowerCase().includes(q) : true;
                const filtered = q
                  ? catMatches
                    ? cat.emojis
                    : cat.emojis.filter((e) => e.includes(q))
                  : cat.emojis;

                if (filtered.length === 0) return null;
                return (
                  <div key={cat.name}>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {cat.name}
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {filtered.map((emoji, idx) => (
                        <button
                          key={`${emoji}-${idx}`}
                          type="button"
                          onClick={() => onSelectEmoji(emoji)}
                          className="flex h-9 w-full items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-[var(--accent-primary-soft)] cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );

  if (isMobile && typeof document !== 'undefined') {
    return createPortal(
      <div
        className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[1px]"
        onClick={() => onClose?.()}
      >
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xl animate-slide-up"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
          {pickerBody}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      ref={popoverRef}
      className={`absolute ${posClasses} z-40 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xl`}
    >
      {pickerBody}
    </div>
  );
}
