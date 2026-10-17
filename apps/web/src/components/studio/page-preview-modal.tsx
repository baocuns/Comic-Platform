'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface PageData {
  id: string;
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

interface PagePreviewModalProps {
  pages: PageData[];
  initialIndex: number;
  onClose: () => void;
}

export function PagePreviewModal({ pages, initialIndex, onClose }: PagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const page = pages[currentIndex];

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
    if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex((i) => i - 1);
    if (e.key === 'ArrowRight' && currentIndex < pages.length - 1) setCurrentIndex((i) => i + 1);
  }, [currentIndex, pages.length, handleClose]);

  if (!page) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className={`relative flex h-full w-full flex-col transition-all duration-200 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] bg-white/90 dark:bg-[#0c0c0f]/90 px-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Trang {page.pageNumber} / {pages.length}
            <span className="ml-3 text-zinc-400 dark:text-zinc-600">{page.width}×{page.height}px</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              className="rounded-md bg-zinc-100 dark:bg-white/[0.06] px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-xs text-zinc-600 dark:text-zinc-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="rounded-md bg-zinc-100 dark:bg-white/[0.06] px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="rounded-md bg-zinc-100 dark:bg-white/[0.06] px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Reset
            </button>
            <div className="mx-2 h-4 w-px bg-zinc-200 dark:bg-white/[0.06]" />
            <button
              onClick={handleClose}
              className="rounded-md bg-zinc-100 dark:bg-white/[0.06] px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-300 transition-colors"
            >
              ✕ Đóng
            </button>
          </div>
        </div>

        {/* Image viewer */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          {/* Prev button */}
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white"
            >
              ‹
            </button>
          )}

          <img
            src={page.imageUrl}
            alt={`Trang ${page.pageNumber}`}
            className="max-h-full rounded-lg shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            draggable={false}
          />

          {/* Next button */}
          {currentIndex < pages.length - 1 && (
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white"
            >
              ›
            </button>
          )}
        </div>

        {/* Bottom thumbnails */}
        <div className="flex h-20 shrink-0 items-center gap-2 overflow-x-auto border-t border-zinc-200 dark:border-white/[0.06] bg-white/90 dark:bg-[#0c0c0f]/90 px-4">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setCurrentIndex(i); setZoom(1); }}
              className={`h-14 w-10 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                i === currentIndex
                  ? 'border-amber-500 shadow-lg shadow-amber-500/30'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
