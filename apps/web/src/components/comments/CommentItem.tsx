'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CommentContent } from './CommentContent';
import { CommentEditor } from './CommentEditor';

export interface CommentUser {
  id?: string;
  username?: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  chapter?: { id?: string; number: number | string } | null;
  parentId?: string | null;
  replies?: CommentData[];
  _count?: { replies: number };
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId?: string;
  onPostReply?: (parentId: string, content: string) => Promise<void> | void;
  onDelete?: (id: string, parentId?: string | null) => Promise<void> | void;
  isReaderBgDark?: boolean;
  accentColor?: 'amber' | 'violet' | 'emerald';
  readOnly?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onPostReply,
  onDelete,
  isReaderBgDark = false,
  accentColor = 'amber',
  readOnly = false,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleReplySubmit = async (content: string) => {
    if (!onPostReply) return;
    setIsSubmittingReply(true);
    try {
      await onPostReply(comment.id, content);
      setIsReplying(false);
    } catch { }
    setIsSubmittingReply(false);
  };

  const handleDelete = async (id: string, parentId?: string | null) => {
    if (!onDelete) return;
    if (confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      setIsDeleting(true);
      try {
        await onDelete(id, parentId);
      } catch {
        setIsDeleting(false);
      }
    }
  };

  const hoverTextClass =
    accentColor === 'emerald'
      ? 'hover:text-emerald-500 dark:hover:text-emerald-400'
      : accentColor === 'violet'
      ? 'hover:text-violet-500 dark:hover:text-violet-400'
      : 'hover:text-amber-500 dark:hover:text-amber-400';

  return (
    <div
      className={`group rounded border p-4 transition-all duration-200 ${isDeleting ? 'opacity-40 pointer-events-none' : ''
        } ${isReaderBgDark
          ? 'border-white/5 bg-white/[0.02] hover:border-white/10'
          : 'border-zinc-200/70 bg-zinc-50/60 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/20 dark:hover:bg-zinc-800/60'
        }`}
    >
      {/* Main Comment */}
      <div className="flex gap-3">
        {/* User Avatar */}
        {comment.user.username ? (
          <Link href={`/@${comment.user.username}`} className="shrink-0">
            <div
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full font-bold text-sm text-white shadow-sm transition-opacity hover:opacity-85 ${accentColor === 'emerald'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                : accentColor === 'violet'
                ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                : 'bg-gradient-to-br from-amber-500 to-orange-500'
                }`}
            >
              {comment.user.avatarUrl ? (
                <img src={comment.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                comment.user.displayName.charAt(0).toUpperCase()
              )}
            </div>
          </Link>
        ) : (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-sm text-white shadow-sm ${accentColor === 'emerald'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
              : accentColor === 'violet'
              ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
              : 'bg-gradient-to-br from-amber-500 to-orange-500'
              }`}
          >
            {comment.user.avatarUrl ? (
              <img src={comment.user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              comment.user.displayName.charAt(0).toUpperCase()
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {comment.user.username ? (
              <Link
                href={`/@${comment.user.username}`}
                className={`text-sm font-semibold transition-colors ${isReaderBgDark ? 'text-white' : 'text-zinc-900 dark:text-white'
                  } ${hoverTextClass}`}
              >
                {comment.user.displayName}
              </Link>
            ) : (
              <span
                className={`text-sm font-semibold ${isReaderBgDark ? 'text-white' : 'text-zinc-900 dark:text-white'
                  }`}
              >
                {comment.user.displayName}
              </span>
            )}

            {/* Chapter Badge */}
            {comment.chapter && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isReaderBgDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-200/70 text-zinc-600 dark:bg-white/10 dark:text-zinc-300'
                  }`}
              >
                Ch.{comment.chapter.number}
              </span>
            )}

            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>

          {/* Comment Text & Sticker */}
          <div className="mt-1.5">
            <CommentContent
              content={comment.content}
              isReaderBgDark={isReaderBgDark}
              className={isReaderBgDark ? 'text-zinc-300' : 'text-zinc-800 dark:text-zinc-200'}
            />
          </div>

          {/* Actions Bar */}
          {!readOnly && (
            <div className="mt-2.5 flex items-center gap-4 text-xs">
              {currentUserId && onPostReply && (
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className={`font-medium transition-colors cursor-pointer ${isReplying
                    ? accentColor === 'emerald'
                      ? 'text-emerald-500'
                      : accentColor === 'violet'
                      ? 'text-violet-500'
                      : 'text-amber-500'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                >
                  {isReplying ? 'Hủy trả lời' : '↩ Trả lời'}
                </button>
              )}

              {currentUserId && (currentUserId === comment.user.id || currentUserId === comment.user.id) && onDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="font-medium text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Xóa
                </button>
              )}

              {(comment._count?.replies || 0) > 0 && (
                <span className="text-zinc-400">{comment._count!.replies} trả lời</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline Reply Form */}
      {isReplying && (
        <div className="mt-3 ml-12">
          <CommentEditor
            placeholder={`Trả lời @${comment.user.displayName}...`}
            submitLabel="Gửi trả lời"
            onSubmit={handleReplySubmit}
            onCancel={() => setIsReplying(false)}
            isSubmitting={isSubmittingReply}
            isReaderBgDark={isReaderBgDark}
            accentColor={accentColor}
            compact
          />
        </div>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div
          className={`mt-3 ml-10 space-y-3 border-l-2 pl-4 ${isReaderBgDark ? 'border-white/10' : 'border-zinc-200 dark:border-white/10'
            }`}
        >
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2.5">
              <Link href={`/@${reply.user.username}`} className="shrink-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ${accentColor === 'emerald' ? 'bg-teal-600' : accentColor === 'violet' ? 'bg-violet-600' : 'bg-amber-600'
                    }`}
                >
                  {reply.user.avatarUrl ? (
                    <img src={reply.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    reply.user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/@${reply.user.username}`}
                    className={`text-xs font-semibold ${isReaderBgDark ? 'text-zinc-200' : 'text-zinc-900 dark:text-zinc-200'
                      } ${hoverTextClass}`}
                  >
                    {reply.user.displayName}
                  </Link>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(reply.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                  {!readOnly && currentUserId === reply.user.id && onDelete && (
                    <button
                      onClick={() => handleDelete(reply.id, comment.id)}
                      className="text-[10px] text-zinc-400 hover:text-red-500 cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <div className="mt-0.5">
                  <CommentContent
                    content={reply.content}
                    isReaderBgDark={isReaderBgDark}
                    className={isReaderBgDark ? 'text-zinc-300' : 'text-zinc-700 dark:text-zinc-300'}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
