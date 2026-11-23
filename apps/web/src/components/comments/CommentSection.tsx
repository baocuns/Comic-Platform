'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Heart,
  Reply,
  Pin,
  EyeOff,
  Trash2,
  Edit3,
  Flag,
  Send,
  Sticker as StickerIcon,
  X,
} from 'lucide-react';
import type { CommentItem } from 'shared';
import { ReportTargetType } from 'shared';
import { formatRelativeTime } from '@/lib/format';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RealmBadge } from '@/components/ui/realm-badge';
import { ReportModal } from '@/components/ui/report-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/providers/toast-provider';
import {
  CommentContent,
  parseCommentContent,
  serializeCommentContent,
  type StickerAttachment,
} from './CommentContent';
import { StickerEmojiPicker } from './StickerEmojiPicker';
import { MAX_STICKERS_PER_COMMENT } from './stickerData';

interface CommentSectionProps {
  title?: string;
  comments: CommentItem[];
  totalCount: number;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  comicAuthorId?: string | null;
  reportTargetType?: ReportTargetType;
  allowSpoiler?: boolean;
  isLoading?: boolean;
  isSubmitting?: boolean;
  hasNext?: boolean;
  isLoadingMore?: boolean;
  sort?: 'newest' | 'top';
  onSortChange?: (sort: 'newest' | 'top') => void;
  onSubmitComment?: (content: string, isSpoiler: boolean) => Promise<void> | void;
  onSubmitReply?: (parentId: string, content: string, isSpoiler: boolean) => Promise<void> | void;
  onToggleLike?: (commentId: string) => Promise<void> | void;
  onEditComment?: (commentId: string, content: string) => Promise<void> | void;
  onDeleteComment?: (commentId: string, parentId?: string | null) => Promise<void> | void;
  onPinComment?: (commentId: string, pinned: boolean) => Promise<void> | void;
  onLoadMore?: () => void;
}

function StickerPreviewStrip({
  stickers,
  onRemove,
  compact = false,
}: {
  stickers: StickerAttachment[];
  onRemove: (index: number) => void;
  compact?: boolean;
}) {
  if (stickers.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5 pt-1">
      {stickers.map((s, idx) => (
        <div
          key={`${s.url}-${idx}`}
          className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1.5 shadow-xs"
        >
          <img
            src={s.url}
            alt={s.name || 'Sticker'}
            referrerPolicy="no-referrer"
            className={`${compact ? 'h-14 sm:h-16' : 'h-18 sm:h-20'} w-auto rounded-lg object-contain`}
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-sm hover:opacity-90 cursor-pointer"
            title="Xóa sticker"
            aria-label="Xóa sticker"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <span className="text-[11px] font-medium text-[var(--text-muted)]">
        {stickers.length}/{MAX_STICKERS_PER_COMMENT} sticker
      </span>
    </div>
  );
}

export function CommentSection({
  title = 'Bình luận cộng đồng',
  comments,
  totalCount,
  currentUserId,
  currentUserRole,
  comicAuthorId,
  reportTargetType = ReportTargetType.COMMENT,
  allowSpoiler = true,
  isLoading = false,
  isSubmitting = false,
  hasNext = false,
  isLoadingMore = false,
  sort = 'newest',
  onSortChange,
  onSubmitComment,
  onSubmitReply,
  onToggleLike,
  onEditComment,
  onDeleteComment,
  onPinComment,
  onLoadMore,
}: CommentSectionProps) {
  const { toast } = useToast();
  const [newContent, setNewContent] = useState('');
  const [selectedStickers, setSelectedStickers] = useState<StickerAttachment[]>([]);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [showMainPicker, setShowMainPicker] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyStickers, setReplyStickers] = useState<StickerAttachment[]>([]);
  const [showReplyPicker, setShowReplyPicker] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStickers, setEditStickers] = useState<StickerAttachment[]>([]);
  const [showEditPicker, setShowEditPicker] = useState(false);

  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; parentId?: string | null } | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (
    el: HTMLTextAreaElement | HTMLInputElement | null,
    currentValue: string,
    setValue: (v: string) => void,
    emoji: string,
  ) => {
    if (!el) {
      setValue(currentValue + emoji);
      return;
    }
    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? currentValue.length;
    const updated = currentValue.slice(0, start) + emoji + currentValue.slice(end);
    setValue(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const appendSticker = (
    current: StickerAttachment[],
    setList: (next: StickerAttachment[]) => void,
    sticker: { url: string; name: string },
    closePicker: () => void,
  ) => {
    if (current.length >= MAX_STICKERS_PER_COMMENT) {
      toast.error(`Tối đa ${MAX_STICKERS_PER_COMMENT} sticker trong mỗi bình luận`);
      closePicker();
      return;
    }
    setList([...current, sticker]);
    closePicker();
  };

  const handleMainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localSubmitting || isSubmitting || (!newContent.trim() && selectedStickers.length === 0) || !onSubmitComment) return;
    setLocalSubmitting(true);
    try {
      const payload = serializeCommentContent(newContent, selectedStickers);
      await onSubmitComment(payload, allowSpoiler ? isSpoiler : false);
      setNewContent('');
      setSelectedStickers([]);
      setIsSpoiler(false);
      setShowMainPicker(false);
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (localSubmitting || isSubmitting || (!replyContent.trim() && replyStickers.length === 0) || !onSubmitReply) return;
    setLocalSubmitting(true);
    try {
      const payload = serializeCommentContent(replyContent, replyStickers);
      await onSubmitReply(parentId, payload, false);
      setReplyContent('');
      setReplyStickers([]);
      setShowReplyPicker(false);
      setReplyingTo(null);
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleEditSave = async (commentId: string) => {
    if (localSubmitting || isSubmitting || (!editContent.trim() && editStickers.length === 0) || !onEditComment) return;
    setLocalSubmitting(true);
    try {
      const payload = serializeCommentContent(editContent, editStickers);
      await onEditComment(commentId, payload);
      setEditingId(null);
      setEditContent('');
      setEditStickers([]);
      setShowEditPicker(false);
    } finally {
      setLocalSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !onDeleteComment) return;
    setDeletingComment(true);
    try {
      await onDeleteComment(pendingDelete.id, pendingDelete.parentId);
      setPendingDelete(null);
    } finally {
      setDeletingComment(false);
    }
  };

  const canModerate =
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'MODERATOR' ||
    (!!currentUserId && currentUserId === comicAuthorId);

  const renderCommentCard = (c: CommentItem, isReply = false) => {
    const isOwner = !!currentUserId && c.userId === currentUserId;
    const isHiddenSpoiler = c.isSpoiler && !revealedSpoilers[c.id];

    return (
      <div
        key={c.id}
        className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 ${
          isReply ? 'ml-6 sm:ml-10 bg-[var(--bg-canvas)]' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href={`/@${c.user.username}`}>
              <Avatar src={c.user.avatarUrl} name={c.user.displayName} size="sm" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/@${c.user.username}`}
                  className="truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                >
                  {c.user.displayName}
                </Link>
                <RealmBadge level={c.user.level} />
                {c.isPinned && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-primary)]">
                    <Pin className="h-2.5 w-2.5" />
                    Ghim
                  </span>
                )}
                {c.chapter && (
                  <Link
                    href={`/read/${c.chapter.id}`}
                    className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                  >
                    Ch.{c.chapter.number}
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{formatRelativeTime(c.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isReply && onPinComment && canModerate && (
              <button
                type="button"
                onClick={() => onPinComment(c.id, !c.isPinned)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                title={c.isPinned ? 'Bỏ ghim' : 'Ghim bình luận'}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwner && onEditComment && (
              <button
                type="button"
                onClick={() => {
                  const parsed = parseCommentContent(c.content);
                  setEditingId(c.id);
                  setEditContent(parsed.text);
                  setEditStickers(parsed.stickers);
                  setShowEditPicker(false);
                }}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Chỉnh sửa"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            {(isOwner || canModerate) && onDeleteComment && (
              <button
                type="button"
                onClick={() => setPendingDelete({ id: c.id, parentId: c.parentId })}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                title="Xóa bình luận"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {currentUserId && !isOwner && (
              <button
                type="button"
                onClick={() => setReportTargetId(c.id)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-warm)] cursor-pointer"
                title="Báo cáo"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-2.5">
          {editingId === c.id ? (
            <div className="space-y-2.5">
              <textarea
                ref={editTextareaRef}
                rows={2}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Nhập nội dung bình luận..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <StickerPreviewStrip
                stickers={editStickers}
                compact
                onRemove={(idx) => setEditStickers((prev) => prev.filter((_, i) => i !== idx))}
              />
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowEditPicker((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                      showEditPicker
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <StickerIcon className="h-3.5 w-3.5" />
                    <span>Sticker & Icon</span>
                  </button>
                  {showEditPicker && (
                    <StickerEmojiPicker
                      onSelectEmoji={(em) =>
                        insertAtCursor(editTextareaRef.current, editContent, setEditContent, em)
                      }
                      onSelectSticker={(st) =>
                        appendSticker(editStickers, setEditStickers, st, () => setShowEditPicker(false))
                      }
                      onClose={() => setShowEditPicker(false)}
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="xs"
                    onClick={() => handleEditSave(c.id)}
                    disabled={!editContent.trim() && editStickers.length === 0}
                  >
                    Lưu
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setEditStickers([]);
                      setShowEditPicker(false);
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            </div>
          ) : isHiddenSpoiler ? (
            <button
              type="button"
              onClick={() => setRevealedSpoilers((prev) => ({ ...prev, [c.id]: true }))}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs font-semibold text-[var(--warning)] cursor-pointer"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Bình luận có tiết lộ nội dung (Spoiler) — Nhấn để xem</span>
            </button>
          ) : (
            <CommentContent content={c.content} />
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          {onToggleLike && (
            <button
              type="button"
              onClick={() => onToggleLike(c.id)}
              className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                c.isLiked
                  ? 'text-[var(--accent-warm)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${c.isLiked ? 'fill-current' : ''}`} />
              <span>{c.likesCount}</span>
            </button>
          )}
          {!isReply && onSubmitReply && currentUserId && (
            <button
              type="button"
              onClick={() => {
                setReplyingTo(replyingTo === c.id ? null : c.id);
                setReplyContent('');
                setReplyStickers([]);
                setShowReplyPicker(false);
              }}
              className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-pointer"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Trả lời</span>
            </button>
          )}
        </div>

        {/* Reply input */}
        {replyingTo === c.id && (
          <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={replyInputRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReplySubmit(c.id);
                  }
                }}
                placeholder={`Trả lời ${c.user.displayName}...`}
                className="h-9 min-w-[180px] flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs sm:text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReplyPicker((v) => !v)}
                  className={`inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-medium cursor-pointer transition-colors ${
                    showReplyPicker
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                  title="Chèn Sticker hoặc Emoji"
                >
                  <StickerIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sticker</span>
                </button>
                {showReplyPicker && (
                  <StickerEmojiPicker
                    align="right"
                    onSelectEmoji={(em) =>
                      insertAtCursor(replyInputRef.current, replyContent, setReplyContent, em)
                    }
                    onSelectSticker={(st) =>
                      appendSticker(replyStickers, setReplyStickers, st, () => setShowReplyPicker(false))
                    }
                    onClose={() => setShowReplyPicker(false)}
                  />
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleReplySubmit(c.id)}
                isLoading={isSubmitting}
                disabled={!replyContent.trim() && replyStickers.length === 0}
              >
                Gửi
              </Button>
            </div>
            <StickerPreviewStrip
              stickers={replyStickers}
              compact
              onRemove={(idx) => setReplyStickers((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>
        )}

        {/* Nested replies */}
        {c.replies && c.replies.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {c.replies.map((reply) => renderCommentCard(reply, true))}
          </div>
        )}
      </div>
    );
  };

  const canMainSubmit =
    (newContent.trim().length > 0 || selectedStickers.length > 0) && !isSubmitting && !localSubmitting;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--accent-primary)]" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {title} <span className="text-sm font-medium text-[var(--text-muted)]">({totalCount})</span>
          </h3>
        </div>

        {onSortChange && (
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onSortChange('newest')}
              className={`rounded-lg px-3 py-1 cursor-pointer transition-colors ${
                sort === 'newest'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Mới nhất
            </button>
            <button
              type="button"
              onClick={() => onSortChange('top')}
              className={`rounded-lg px-3 py-1 cursor-pointer transition-colors ${
                sort === 'top'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Nổi bật
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      {onSubmitComment && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          {currentUserId ? (
            <form onSubmit={handleMainSubmit} className="space-y-3">
              <textarea
                ref={mainTextareaRef}
                rows={3}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Chia sẻ cảm nghĩ hoặc thả sticker vui nhộn..."
                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />

              <StickerPreviewStrip
                stickers={selectedStickers}
                onRemove={(idx) =>
                  setSelectedStickers((prev) => prev.filter((_, i) => i !== idx))
                }
              />

              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {allowSpoiler && (
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSpoiler}
                        onChange={(e) => setIsSpoiler(e.target.checked)}
                        className="accent-[var(--accent-warm)]"
                      />
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Spoiler</span>
                    </label>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowMainPicker((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        showMainPicker
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <StickerIcon className="h-3.5 w-3.5" />
                      <span>Sticker & Icon</span>
                    </button>

                    {showMainPicker && (
                      <StickerEmojiPicker
                        onSelectEmoji={(em) =>
                          insertAtCursor(mainTextareaRef.current, newContent, setNewContent, em)
                        }
                        onSelectSticker={(st) =>
                          appendSticker(selectedStickers, setSelectedStickers, st, () =>
                            setShowMainPicker(false),
                          )
                        }
                        onClose={() => setShowMainPicker(false)}
                      />
                    )}
                  </div>
                </div>

                <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!canMainSubmit}>
                  <Send className="h-3.5 w-3.5" />
                  <span>Gửi bình luận</span>
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-between gap-3 py-2 sm:flex-row">
              <p className="text-sm text-[var(--text-secondary)]">
                Đăng nhập để bình luận, thả sticker và nhận thêm EXP Tu Luyện.
              </p>
              <Link href="/login">
                <Button size="sm">Đăng nhập ngay</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-10 text-center text-sm text-[var(--text-muted)]">
          Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nhận!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => renderCommentCard(c))}
          {hasNext && onLoadMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={onLoadMore} isLoading={isLoadingMore}>
                Xem thêm bình luận
              </Button>
            </div>
          )}
        </div>
      )}

      {reportTargetId && (
        <ReportModal
          open={!!reportTargetId}
          onClose={() => setReportTargetId(null)}
          targetType={reportTargetType}
          targetId={reportTargetId}
          targetLabel="Bình luận"
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Xóa bình luận?"
        description="Bình luận và các trả lời liên quan sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa bình luận"
        isLoading={deletingComment}
      />
    </section>
  );
}
