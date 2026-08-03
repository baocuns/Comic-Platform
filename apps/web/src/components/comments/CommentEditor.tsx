'use client';

import React, { useState, useRef } from 'react';
import { StickerEmojiPicker } from './StickerEmojiPicker';

interface CommentEditorProps {
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  onSubmit: (content: string) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  isReaderBgDark?: boolean;
  accentColor?: 'violet' | 'emerald';
  compact?: boolean;
}

export function CommentEditor({
  placeholder = 'Viết bình luận...',
  submitLabel = 'Bình luận',
  initialValue = '',
  onSubmit,
  onCancel,
  isSubmitting = false,
  userAvatarUrl,
  userDisplayName,
  isReaderBgDark = false,
  accentColor = 'violet',
  compact = false,
}: CommentEditorProps) {
  const [text, setText] = useState<string>(initialValue);
  const [stickers, setStickers] = useState<Array<{ url: string; name?: string }>>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectEmoji = (emoji: string) => {
    if (!textareaRef.current) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setText(newText);

    // Reposition cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + emoji.length;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleSelectSticker = (stickerUrl: string, name?: string) => {
    setStickers((prev) => [...prev, { url: stickerUrl, name }]);
    setShowPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = text.trim().length > 0;
    const hasStickers = stickers.length > 0;

    if ((!hasText && !hasStickers) || isSubmitting) return;

    const stickerMarkdown = stickers.map((s) => `![${s.name || 'Sticker'}](${s.url})`).join(' ');
    const fullContent = [text.trim(), stickerMarkdown].filter(Boolean).join('\n');

    await onSubmit(fullContent);
    setText('');
    setStickers([]);
    setShowPicker(false);
  };

  const canSubmit = (text.trim().length > 0 || stickers.length > 0) && !isSubmitting;

  const buttonGradient =
    accentColor === 'emerald'
      ? 'from-emerald-600 to-teal-600 hover:shadow-emerald-500/30'
      : 'from-violet-600 to-fuchsia-600 hover:shadow-violet-500/30';

  return (
    <div className={`relative ${compact ? '' : 'mb-6'}`}>
      <div className="flex gap-3">
        {/* User Avatar */}
        {userDisplayName && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-sm text-white ${
              accentColor === 'emerald'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/20'
            }`}
          >
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              userDisplayName.charAt(0).toUpperCase()
            )}
          </div>
        )}

        {/* Input Box & Toolbar */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="relative">
            <div
              className={`group relative rounded-2xl border transition-all duration-200 ${
                isReaderBgDark
                  ? 'border-white/10 bg-white/[0.04] focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/20'
                  : accentColor === 'emerald'
                  ? 'border-zinc-200 bg-zinc-50 focus-within:border-emerald-500/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20'
                  : 'border-zinc-200 bg-zinc-50 focus-within:border-violet-500/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/20'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                rows={compact ? 2 : 3}
                className={`w-full bg-transparent px-4 py-3 text-sm outline-none resize-none transition-colors ${
                  isReaderBgDark ? 'text-white placeholder-zinc-500' : 'text-zinc-900 placeholder-zinc-400'
                }`}
              />

              {/* Visual GIF Sticker Cards */}
              {stickers.length > 0 && (
                <div className="flex flex-wrap gap-3 px-4 pb-3">
                  {stickers.map((s, idx) => (
                    <div
                      key={idx}
                      className={`group relative rounded-xl border p-1.5 transition-all shadow-sm ${
                        isReaderBgDark
                          ? 'border-white/15 bg-white/5 shadow-black/40'
                          : 'border-zinc-200 bg-white shadow-zinc-200/50'
                      }`}
                    >
                      <img
                        src={s.url}
                        alt={s.name || 'Sticker'}
                        className="h-20 sm:h-24 w-auto object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setStickers((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow-md hover:bg-red-600 transition-colors"
                        title="Xóa sticker"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Toolbar */}
              <div
                className={`flex items-center justify-between border-t px-3 py-2 ${
                  isReaderBgDark ? 'border-white/5' : 'border-zinc-100'
                }`}
              >
                {/* Left tools: Emoji & Sticker */}
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPicker(!showPicker)}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                      showPicker
                        ? accentColor === 'emerald'
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-violet-500/20 text-violet-500'
                        : isReaderBgDark
                        ? 'text-zinc-400 hover:bg-white/10 hover:text-white'
                        : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
                    }`}
                  >
                    <span className="text-base leading-none">🎭</span>
                    <span>Sticker & Icon</span>
                  </button>

                  {/* Popover */}
                  {showPicker && (
                    <StickerEmojiPicker
                      onSelectEmoji={handleSelectEmoji}
                      onSelectSticker={handleSelectSticker}
                      onClose={() => setShowPicker(false)}
                      isReaderBgDark={isReaderBgDark}
                    />
                  )}
                </div>

                {/* Right tools: Cancel & Submit buttons */}
                <div className="flex items-center gap-2">
                  {onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                        isReaderBgDark
                          ? 'text-zinc-400 hover:bg-white/10 hover:text-white'
                          : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
                      }`}
                    >
                      Hủy
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`rounded-xl bg-gradient-to-r ${buttonGradient} px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                  >
                    {isSubmitting ? 'Đang gửi...' : submitLabel}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
