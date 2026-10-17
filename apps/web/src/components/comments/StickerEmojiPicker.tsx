'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EMOJI_CATEGORIES, STICKER_CATEGORIES, Sticker } from './stickerData';

interface StickerEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string, name?: string) => void;
  onClose?: () => void;
  isReaderBgDark?: boolean;
}

export function StickerEmojiPicker({
  onSelectEmoji,
  onSelectSticker,
  onClose,
  isReaderBgDark = false,
}: StickerEmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'sticker'>('sticker');
  const [selectedStickerCat, setSelectedStickerCat] = useState<string>(STICKER_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const stickerNavRef = useRef<HTMLDivElement>(null);

  const scrollStickerNav = (dir: 'left' | 'right') => {
    if (stickerNavRef.current) {
      stickerNavRef.current.scrollBy({
        left: dir === 'left' ? -140 : 140,
        behavior: 'smooth',
      });
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={`absolute bottom-full left-0 mb-2 z-50 w-80 max-w-[calc(100vw-1.5rem)] sm:w-96 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in fade-in zoom-in-95 ${isReaderBgDark
        ? 'border-white/10 bg-zinc-900/95 text-white shadow-black/80'
        : 'border-zinc-200 bg-white/95 text-zinc-900 shadow-zinc-400/30 dark:border-white/10 dark:bg-zinc-900/95 dark:text-white dark:shadow-black/80'
        }`}
    >
      {/* Header Tabs */}
      <div className={`flex items-center justify-between border-b px-3 py-2 ${isReaderBgDark ? 'border-white/10' : 'border-zinc-100 dark:border-white/10'}`}>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeTab === 'sticker'
              ? isReaderBgDark
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
              : 'opacity-60 hover:opacity-100'
              }`}
          >
            <span><i className="fa-light fa-gif"></i></span> Sticker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeTab === 'emoji'
              ? isReaderBgDark
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
              : 'opacity-60 hover:opacity-100'
              }`}
          >
            <span>😀</span> Icon & Emoji
          </button>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-6 w-6 rounded-full flex items-center justify-center text-xs opacity-50 hover:opacity-100 hover:bg-zinc-500/20"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {/* STICKER TAB */}
        {activeTab === 'sticker' && (
          <div>
            {/* Sticker Categories Sub-nav */}
            <div className="relative group/subnav mb-2 flex items-center">
              <button
                type="button"
                onClick={() => scrollStickerNav('left')}
                className={`absolute left-0 z-10 flex h-6 w-6 -ml-1 items-center justify-center rounded-full text-xs font-bold shadow-md transition-all opacity-0 group-hover/subnav:opacity-100 ${isReaderBgDark
                  ? 'bg-zinc-800/95 text-white hover:bg-zinc-700'
                  : 'bg-white/95 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/95 dark:text-white dark:border-white/10'
                  }`}
                title="Cuộn sang trái"
              >
                ‹
              </button>

              <div
                ref={stickerNavRef}
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="flex w-full gap-1.5 overflow-x-auto pb-2 pt-0.5 scroll-smooth max-w-full [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-400/50 dark:[&::-webkit-scrollbar-thumb]:bg-white/20"
              >
                {STICKER_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedStickerCat(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${selectedStickerCat === cat.id
                      ? isReaderBgDark
                        ? 'bg-amber-500 text-white font-bold shadow-sm'
                        : 'bg-zinc-800 text-white font-bold shadow-sm dark:bg-amber-500'
                      : isReaderBgDark
                        ? 'bg-white/10 text-zinc-300 hover:bg-white/20'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20'
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
                className={`absolute right-0 z-10 flex h-6 w-6 -mr-1 items-center justify-center rounded-full text-xs font-bold shadow-md transition-all opacity-0 group-hover/subnav:opacity-100 ${isReaderBgDark
                  ? 'bg-zinc-800/95 text-white hover:bg-zinc-700'
                  : 'bg-white/95 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/95 dark:text-white dark:border-white/10'
                  }`}
                title="Cuộn sang phải"
              >
                ›
              </button>
            </div>

            {/* Sticker Grid */}
            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1 select-none">
              {STICKER_CATEGORIES.find((c) => c.id === selectedStickerCat)?.stickers.map((s: Sticker) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.name}
                  onClick={() => {
                    onSelectSticker(s.url, s.name);
                    onClose?.();
                  }}
                  className={`group relative flex items-center justify-center aspect-square min-w-0 min-h-0 overflow-hidden rounded-xl border p-1 transition-all active:scale-95 touch-manipulation ${isReaderBgDark
                    ? 'border-white/5 bg-white/[0.03] hover:border-amber-500/50 hover:bg-amber-500/10'
                    : 'border-zinc-200/60 bg-zinc-50 hover:border-amber-500/50 hover:bg-amber-50 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-amber-500/50 dark:hover:bg-amber-500/10'
                    }`}
                >
                  <img
                    src={s.url}
                    alt={s.name}
                    className="max-h-full max-w-full h-auto w-auto object-contain block mx-auto pointer-events-none"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EMOJI TAB */}
        {activeTab === 'emoji' && (
          <div>
            <input
              type="text"
              placeholder="Tìm emoji..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`mb-2 w-full rounded-xl border px-3 py-1.5 text-xs outline-none ${isReaderBgDark
                ? 'border-white/10 bg-white/5 text-white placeholder-zinc-500 focus:border-amber-400'
                : 'border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 focus:border-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus:border-amber-400'
                }`}
            />
            <div className="max-h-52 overflow-y-auto pr-1 space-y-3">
              {EMOJI_CATEGORIES.map((cat) => {
                const filtered = searchQuery.trim()
                  ? cat.emojis.filter((e) => e.includes(searchQuery.trim()))
                  : cat.emojis;

                if (filtered.length === 0) return null;
                return (
                  <div key={cat.name}>
                    <div className="mb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {cat.name}
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {filtered.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onSelectEmoji(emoji);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:scale-125 transition-transform hover:bg-amber-500/20"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
