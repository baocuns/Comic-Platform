'use client';

import React from 'react';
import Link from 'next/link';
import { CommentItem, CommentData, CommentUser } from './CommentItem';
import { CommentEditor } from './CommentEditor';

interface CommentSectionProps {
  comments: CommentData[];
  totalCount?: number;
  currentUser?: CommentUser | null;
  onSubmitComment?: (content: string) => Promise<void> | void;
  onSubmitReply?: (parentId: string, content: string) => Promise<void> | void;
  onDeleteComment?: (id: string, parentId?: string | null) => Promise<void> | void;
  onLoadMore?: () => void;
  hasNext?: boolean;
  isLoadingMore?: boolean;
  isSubmitting?: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string;
  title?: string;
  isReaderBgDark?: boolean;
  accentColor?: 'violet' | 'emerald';
}

export function CommentSection({
  comments,
  totalCount = comments.length,
  currentUser,
  onSubmitComment,
  onSubmitReply,
  onDeleteComment,
  onLoadMore,
  hasNext = false,
  isLoadingMore = false,
  isSubmitting = false,
  readOnly = false,
  readOnlyMessage,
  title = 'Bình luận',
  isReaderBgDark = false,
  accentColor = 'violet',
}: CommentSectionProps) {
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
        isReaderBgDark
          ? 'border-white/10 bg-white/[0.03] text-white'
          : 'border-zinc-200/80 bg-zinc-50/50 text-zinc-900'
      }`}
    >
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span>💬</span>
          <span>
            {title} ({totalCount})
          </span>
        </h2>
      </div>

      {/* Main Comment Editor or Login Prompt / Readonly Notice */}
      {readOnly ? (
        readOnlyMessage && (
          <div
            className={`mb-6 rounded-xl border p-4 text-xs ${
              isReaderBgDark
                ? 'border-white/10 bg-white/5 text-zinc-400'
                : 'border-zinc-200 bg-zinc-100/70 text-zinc-600'
            }`}
          >
            ℹ️ {readOnlyMessage}
          </div>
        )
      ) : currentUser ? (
        onSubmitComment && (
          <CommentEditor
            placeholder="Bạn nghĩ gì về nội dung này? Hãy viết bình luận..."
            submitLabel="Gửi bình luận"
            onSubmit={onSubmitComment}
            isSubmitting={isSubmitting}
            userAvatarUrl={currentUser.avatarUrl}
            userDisplayName={currentUser.displayName}
            isReaderBgDark={isReaderBgDark}
            accentColor={accentColor}
          />
        )
      ) : (
        <div
          className={`mb-8 rounded-2xl border p-5 text-center transition-colors ${
            isReaderBgDark
              ? 'border-white/10 bg-white/5 text-zinc-400'
              : 'border-zinc-200 bg-white shadow-sm text-zinc-600'
          }`}
        >
          <p className="mb-3 text-sm">Đăng nhập để tham gia bình luận và chia sẻ cảm nghĩ của bạn.</p>
          <Link
            href="/login"
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:brightness-110 ${
              accentColor === 'emerald'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-violet-500/25'
            }`}
          >
            Đăng nhập ngay
          </Link>
        </div>
      )}

      {/* Comments List */}
      {comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUser?.id}
              onPostReply={onSubmitReply}
              onDelete={onDeleteComment}
              isReaderBgDark={isReaderBgDark}
              accentColor={accentColor}
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className={`text-sm ${isReaderBgDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Chưa có bình luận nào. Hãy là người đầu tiên lên tiếng!
          </p>
        </div>
      )}

      {/* Load More Button */}
      {hasNext && onLoadMore && (
        <div className="mt-6 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={`w-full sm:w-auto rounded-xl border px-6 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer ${
              isReaderBgDark
                ? 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                : 'border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900'
            }`}
          >
            {isLoadingMore ? 'Đang tải bình luận...' : 'Xem thêm bình luận'}
          </button>
        </div>
      )}
    </div>
  );
}
