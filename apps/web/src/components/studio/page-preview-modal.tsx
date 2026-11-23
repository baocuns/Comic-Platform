'use client';

import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  pages: Array<{ id: string; pageNumber: number; imageUrl: string }>;
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}

export function PagePreviewModal({ pages, currentIndex, onChangeIndex, onClose }: Props) {
  const page = pages[currentIndex];
  if (!page) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative flex max-h-[90vh] max-w-4xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex w-full items-center justify-between text-white">
          <span className="text-sm font-semibold">
            Trang {page.pageNumber} / {pages.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 hover:bg-white/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <img
          src={page.imageUrl}
          alt={`Trang ${page.pageNumber}`}
          className="max-h-[76vh] w-auto rounded-xl object-contain"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onChangeIndex(currentIndex - 1)}
            className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-35 cursor-pointer"
          >
            <ChevronLeft className="inline h-4 w-4" /> Trước
          </button>
          <button
            type="button"
            disabled={currentIndex >= pages.length - 1}
            onClick={() => onChangeIndex(currentIndex + 1)}
            className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-35 cursor-pointer"
          >
            Sau <ChevronRight className="inline h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
