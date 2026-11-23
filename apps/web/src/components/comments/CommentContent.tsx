'use client';

import React from 'react';
import { isAllowedStickerUrl, MAX_STICKERS_PER_COMMENT } from './stickerData';

export interface StickerAttachment {
  url: string;
  name?: string;
}

const STICKER_PATTERN = '!\\[([^\\]]*)\\]\\((https?:\\/\\/[^\\s)]+)\\)';

export function parseCommentContent(raw: string): {
  text: string;
  stickers: StickerAttachment[];
} {
  const regex = new RegExp(STICKER_PATTERN, 'g');
  const stickers: StickerAttachment[] = [];
  const text = (raw || '')
    .replace(regex, (fullMatch, alt: string, url: string) => {
      const allowed = isAllowedStickerUrl(url);
      if (!allowed) return fullMatch;
      stickers.push({ url: allowed, name: alt || 'Sticker' });
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, stickers: stickers.slice(0, MAX_STICKERS_PER_COMMENT) };
}

export function serializeCommentContent(text: string, stickers: StickerAttachment[]): string {
  const trimmedText = (text || '').trim();
  const stickerMarkdown = stickers
    .map((s) => ({ ...s, url: isAllowedStickerUrl(s.url) }))
    .filter((s): s is { url: string; name?: string } => Boolean(s.url))
    .slice(0, MAX_STICKERS_PER_COMMENT)
    .map((s) => `![${(s.name || 'Sticker').replace(/[\[\]]/g, '')}](${s.url})`)
    .join(' ');
  return [trimmedText, stickerMarkdown].filter(Boolean).join('\n');
}

interface CommentContentProps {
  content: string;
  className?: string;
}

export function CommentContent({ content, className = '' }: CommentContentProps) {
  const regex = new RegExp(STICKER_PATTERN, 'g');

  type Segment =
    | { type: 'text'; text: string }
    | { type: 'stickers'; items: Array<{ url: string; alt: string }> };

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let pendingStickers: Array<{ url: string; alt: string }> = [];

  const flushStickers = () => {
    if (pendingStickers.length > 0) {
      segments.push({ type: 'stickers', items: pendingStickers });
      pendingStickers = [];
    }
  };

  while ((match = regex.exec(content || '')) !== null) {
    const allowedUrl = isAllowedStickerUrl(match[2]);
    if (!allowedUrl) {
      continue;
    }
    const textBefore = (content || '').slice(lastIndex, match.index).trim();
    if (textBefore.length > 0) {
      flushStickers();
      segments.push({ type: 'text', text: textBefore });
    }
    pendingStickers.push({ alt: match[1] || 'Sticker', url: allowedUrl });
    lastIndex = match.index + match[0].length;
  }

  flushStickers();

  if (lastIndex < (content || '').length) {
    const tail = (content || '').slice(lastIndex).trim();
    if (tail.length > 0) {
      segments.push({ type: 'text', text: tail });
    }
  }

  if (segments.length === 0) {
    return (
      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-primary)] ${className}`}>
        {content}
      </p>
    );
  }

  return (
    <div className={`space-y-1.5 text-sm leading-relaxed text-[var(--text-primary)] ${className}`}>
      {segments.map((segment, idx) =>
        segment.type === 'stickers' ? (
          <div key={idx} className="my-1.5 flex flex-wrap items-end gap-2">
            {segment.items.map((sticker, sIdx) => (
              <div key={`${sticker.url}-${sIdx}`} className="inline-flex shrink-0">
                <img
                  src={sticker.url}
                  alt={sticker.alt}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-20 sm:max-h-24 w-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] object-contain p-1 shadow-xs transition-transform hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p key={idx} className="whitespace-pre-wrap break-words">
            {segment.text}
          </p>
        ),
      )}
    </div>
  );
}
