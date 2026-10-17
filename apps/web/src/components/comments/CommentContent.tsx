'use client';

import React from 'react';

interface CommentContentProps {
  content: string;
  className?: string;
  isReaderBgDark?: boolean;
}

export function CommentContent({ content, className = '', isReaderBgDark = false }: CommentContentProps) {
  // Regex to extract ![alt](url) markdown images
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

  type Segment =
    | { type: 'text'; text: string }
    | { type: 'stickers'; items: Array<{ url: string; alt: string }> };

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  let pendingText = '';
  let pendingStickers: Array<{ url: string; alt: string }> = [];

  const flushPendingText = () => {
    if (pendingText) {
      segments.push({ type: 'text', text: pendingText });
      pendingText = '';
    }
  };

  const flushPendingStickers = () => {
    if (pendingStickers.length > 0) {
      segments.push({ type: 'stickers', items: pendingStickers });
      pendingStickers = [];
    }
  };

  while ((match = mdImgRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index);

    if (textBefore.trim().length > 0) {
      flushPendingStickers();
      pendingText += textBefore;
      flushPendingText();
    }

    pendingStickers.push({ alt: match[1] || 'Sticker', url: match[2] });
    lastIndex = match.index + match[0].length;
  }

  flushPendingStickers();

  if (lastIndex < content.length) {
    pendingText += content.slice(lastIndex);
    flushPendingText();
  }

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      {segments.map((segment, i) => {
        if (segment.type === 'stickers') {
          return (
            <div key={i} className="my-2 flex flex-wrap gap-2 items-end">
              {segment.items.map((s, idx) => (
                <div key={idx} className="inline-flex shrink-0">
                  <img
                    src={s.url}
                    alt={s.alt}
                    loading="lazy"
                    className={`max-h-20 sm:max-h-24 w-auto rounded object-contain border p-1 transition-all hover:scale-105 ${isReaderBgDark
                        ? 'border-white/10 bg-white/[0.04] shadow-md shadow-black/50 hover:border-amber-500/50'
                        : 'border-zinc-200 bg-zinc-50 shadow-sm shadow-zinc-200/80 hover:border-amber-500/50'
                      }`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={i} className="whitespace-pre-wrap">
            {segment.text}
          </div>
        );
      })}
    </div>
  );
}
